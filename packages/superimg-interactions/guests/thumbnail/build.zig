const std = @import("std");

pub fn build(b: *std.Build) void {
    const optimize = b.option(
        std.builtin.OptimizeMode,
        "optimize",
        "Prioritize performance, safety, or binary size (default: ReleaseSmall)",
    ) orelse .ReleaseSmall;

    const domain_tests = b.addTest(.{
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/thumbnail.zig"),
            .target = b.graph.host,
            .optimize = optimize,
        }),
    });
    const test_step = b.step("test", "Run the pure thumbnail-arithmetic tests natively");
    test_step.dependOn(&b.addRunArtifact(domain_tests).step);

    const wasm_target = b.resolveTargetQuery(.{
        .cpu_arch = .wasm32,
        .os_tag = .freestanding,
    });
    const core_module = b.createModule(.{
        .root_source_file = b.path("src/main.zig"),
        .target = wasm_target,
        .optimize = optimize,
    });
    const core = b.addExecutable(.{
        .name = "core",
        .root_module = core_module,
    });
    core.entry = .disabled;
    core.rdynamic = true;

    const embed = b.addSystemCommand(&.{ "wasm-tools", "component", "embed" });
    embed.addDirectoryArg(b.path("wit"));
    embed.addArgs(&.{ "--world", "guest" });
    embed.addFileArg(core.getEmittedBin());
    const embedded = embed.addPrefixedOutputFileArg("--output=", "embedded.wasm");

    const componentize = b.addSystemCommand(&.{ "wasm-tools", "component", "new" });
    componentize.addFileArg(embedded);
    const component = componentize.addPrefixedOutputFileArg("--output=", "thumbnail.component.wasm");

    const install_component = b.addInstallFile(component, "thumbnail.component.wasm");
    b.getInstallStep().dependOn(&install_component.step);

    const validate = b.addSystemCommand(&.{ "wasm-tools", "validate", "--features", "component-model" });
    validate.addFileArg(component);
    const validate_step = b.step("validate", "Validate the component with wasm-tools");
    validate_step.dependOn(&validate.step);
}
