//! Pure arithmetic for `media.artifact.thumbnail`. No image codecs.
const std = @import("std");

pub const ThumbnailInput = struct {
    artifactId: []const u8,
    maxWidth: i64,
};

pub const ThumbnailOutput = struct {
    bytes: []const u8,
    width: u32,
    height: u32,
};

pub const ErrorPayload = struct {
    @"error": []const u8,
};

pub const SourceDimensions = struct {
    width: u32,
    height: u32,
};

pub const SourceRequest = struct {
    artifactId: []const u8,
};

pub const WriteRequest = struct {
    artifactId: []const u8,
    width: u32,
    height: u32,
};

pub const DimensionError = error{
    InvalidMaxWidth,
    InvalidSourceDimensions,
};

pub fn thumbnailDimensions(source: SourceDimensions, max_width: i64) DimensionError!SourceDimensions {
    if (max_width <= 0) return error.InvalidMaxWidth;
    if (source.width == 0 or source.height == 0) return error.InvalidSourceDimensions;

    const src_w: u64 = source.width;
    const src_h: u64 = source.height;
    const requested: u64 = @intCast(@min(max_width, std.math.maxInt(u32)));
    const out_w = @min(requested, src_w);
    const out_h = @max(1, (src_h * out_w + src_w / 2) / src_w);
    return .{ .width = @intCast(out_w), .height = @intCast(out_h) };
}

pub fn parseInput(allocator: std.mem.Allocator, bytes: []const u8) !std.json.Parsed(ThumbnailInput) {
    return std.json.parseFromSlice(ThumbnailInput, allocator, bytes, .{});
}

pub fn parseSourceDimensions(allocator: std.mem.Allocator, bytes: []const u8) !std.json.Parsed(SourceDimensions) {
    return std.json.parseFromSlice(SourceDimensions, allocator, bytes, .{});
}

pub fn parseOutput(allocator: std.mem.Allocator, bytes: []const u8) !std.json.Parsed(ThumbnailOutput) {
    return std.json.parseFromSlice(ThumbnailOutput, allocator, bytes, .{});
}

pub fn parseErrorPayload(allocator: std.mem.Allocator, bytes: []const u8) !std.json.Parsed(ErrorPayload) {
    return std.json.parseFromSlice(ErrorPayload, allocator, bytes, .{});
}

pub fn encodeError(allocator: std.mem.Allocator, message: []const u8) ![]u8 {
    return std.json.Stringify.valueAlloc(allocator, ErrorPayload{ .@"error" = message }, .{});
}

pub fn encodeSourceRequest(allocator: std.mem.Allocator, artifact_id: []const u8) ![]u8 {
    return std.json.Stringify.valueAlloc(allocator, SourceRequest{ .artifactId = artifact_id }, .{});
}

pub fn encodeWriteRequest(allocator: std.mem.Allocator, artifact_id: []const u8, width: u32, height: u32) ![]u8 {
    return std.json.Stringify.valueAlloc(allocator, WriteRequest{ .artifactId = artifact_id, .width = width, .height = height }, .{});
}

const testing = std.testing;

test "downscale preserves aspect ratio" {
    const result = try thumbnailDimensions(.{ .width = 1920, .height = 1080 }, 480);
    try testing.expectEqual(@as(u32, 480), result.width);
    try testing.expectEqual(@as(u32, 270), result.height);
}
