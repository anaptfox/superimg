//! Canonical ABI glue for the SuperImg thumbnail guest. Domain logic is in
//! `thumbnail.zig`. Copied from Boundary `examples/zig/thumbnail` and retargeted
//! at `media.artifact.thumbnail`.
const std = @import("std");
const domain = @import("thumbnail.zig");

const allocator = std.heap.wasm_allocator;

export fn cabi_realloc(
    ptr: ?[*]u8,
    old_size: usize,
    alignment: usize,
    new_size: usize,
) callconv(.c) ?[*]u8 {
    const a = std.mem.Alignment.fromByteUnits(alignment);
    if (new_size == 0) {
        if (ptr) |p| {
            if (old_size != 0) allocator.rawFree(p[0..old_size], a, @returnAddress());
        }
        return @ptrFromInt(alignment);
    }
    if (ptr) |p| {
        if (old_size != 0) {
            if (allocator.rawRemap(p[0..old_size], a, new_size, @returnAddress())) |grown| {
                return grown;
            }
            const fresh = allocator.rawAlloc(new_size, a, @returnAddress()) orelse
                @panic("cabi_realloc: out of memory");
            const copy_len = @min(old_size, new_size);
            @memcpy(fresh[0..copy_len], p[0..copy_len]);
            allocator.rawFree(p[0..old_size], a, @returnAddress());
            return fresh;
        }
    }
    return allocator.rawAlloc(new_size, a, @returnAddress()) orelse
        @panic("cabi_realloc: out of memory");
}

fn freeBytes(ptr: [*]const u8, len: usize, alignment: usize) void {
    if (len == 0) return;
    const mutable: [*]u8 = @constCast(ptr);
    allocator.rawFree(mutable[0..len], .fromByteUnits(alignment), @returnAddress());
}

fn oom() noreturn {
    @panic("out of memory");
}

extern "boundary:guest/footprints@1.0.0" fn @"media-artifacts"(
    request_ptr: [*]const u8,
    request_len: usize,
    return_area: [*]u8,
) void;

extern "boundary:guest/footprints@1.0.0" fn @"media-thumbnails"(
    request_ptr: [*]const u8,
    request_len: usize,
    return_area: [*]u8,
) void;

const Reply = union(enum) { ok: []const u8, err: []const u8 };

fn callImport(
    import_fn: *const fn ([*]const u8, usize, [*]u8) callconv(.c) void,
    request: []const u8,
) Reply {
    var reply_area: [12]u8 align(4) = undefined;
    import_fn(request.ptr, request.len, &reply_area);
    const tag = reply_area[0];
    const ptr_addr = std.mem.readInt(u32, reply_area[4..8], .little);
    const len = std.mem.readInt(u32, reply_area[8..12], .little);
    const bytes: [*]const u8 = @ptrFromInt(ptr_addr);
    const slice = bytes[0..len];
    return if (tag == 0) .{ .ok = slice } else .{ .err = slice };
}

var export_return_area: [12]u8 align(4) = undefined;

fn writeReturnArea(tag: u8, payload: []const u8) i32 {
    export_return_area[0] = tag;
    std.mem.writeInt(u32, export_return_area[4..8], @intCast(@intFromPtr(payload.ptr)), .little);
    std.mem.writeInt(u32, export_return_area[8..12], @intCast(payload.len), .little);
    return @bitCast(@as(u32, @intCast(@intFromPtr(&export_return_area))));
}

fn errOut(message: []const u8) i32 {
    const encoded = domain.encodeError(allocator, message) catch oom();
    return writeReturnArea(1, encoded);
}

fn errOutFmt(comptime fmt: []const u8, args: anytype) i32 {
    const message = std.fmt.allocPrint(allocator, fmt, args) catch oom();
    defer allocator.free(message);
    return errOut(message);
}

export fn @"media-artifact-thumbnail"(input_ptr: [*]const u8, input_len: usize) callconv(.c) i32 {
    const input_bytes = input_ptr[0..input_len];
    defer freeBytes(input_ptr, input_len, 1);

    const parsed_input = domain.parseInput(allocator, input_bytes) catch |e| {
        return errOutFmt("invalid input: {s}", .{@errorName(e)});
    };
    defer parsed_input.deinit();
    const input = parsed_input.value;

    const request_bytes = domain.encodeSourceRequest(allocator, input.artifactId) catch oom();
    defer allocator.free(request_bytes);

    switch (callImport(@"media-artifacts", request_bytes)) {
        .err => |err_bytes| {
            defer freeBytes(err_bytes.ptr, err_bytes.len, 1);
            const parsed_err = domain.parseErrorPayload(allocator, err_bytes) catch {
                return errOut("artifact lookup failed");
            };
            defer parsed_err.deinit();
            return errOutFmt("artifact lookup failed: {s}", .{parsed_err.value.@"error"});
        },
        .ok => |ok_bytes| {
            defer freeBytes(ok_bytes.ptr, ok_bytes.len, 1);
            const parsed_dims = domain.parseSourceDimensions(allocator, ok_bytes) catch {
                return errOut("malformed source dimensions from host");
            };
            defer parsed_dims.deinit();
            const dims = domain.thumbnailDimensions(parsed_dims.value, input.maxWidth) catch |e| {
                return errOut(@errorName(e));
            };
            const write_bytes = domain.encodeWriteRequest(allocator, input.artifactId, dims.width, dims.height) catch oom();
            defer allocator.free(write_bytes);
            switch (callImport(@"media-thumbnails", write_bytes)) {
                .err => |write_err| {
                    defer freeBytes(write_err.ptr, write_err.len, 1);
                    const parsed_err = domain.parseErrorPayload(allocator, write_err) catch {
                        return errOut("thumbnail write failed");
                    };
                    defer parsed_err.deinit();
                    return errOutFmt("thumbnail write failed: {s}", .{parsed_err.value.@"error"});
                },
                .ok => |write_ok| {
                    // Host JSON is already the interaction output; hand it back.
                    const payload = allocator.dupe(u8, write_ok) catch oom();
                    defer freeBytes(write_ok.ptr, write_ok.len, 1);
                    return writeReturnArea(0, payload);
                },
            }
        },
    }
}

export fn @"cabi_post_media-artifact-thumbnail"(ptr: i32) callconv(.c) void {
    const addr: u32 = @bitCast(ptr);
    const area: [*]const u8 = @ptrFromInt(addr);
    const data_addr = std.mem.readInt(u32, area[4..8], .little);
    const len = std.mem.readInt(u32, area[8..12], .little);
    freeBytes(@ptrFromInt(data_addr), len, 1);
}
