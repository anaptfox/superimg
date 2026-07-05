//! Setup command - installs SuperImg-owned runtime requirements

export async function setupCommand() {
  const { installRuntime } = await import("@superimg/node");
  console.log("Installing SuperImg runtime requirements...\n");

  try {
    await installRuntime({ onProgress: (message) => {
      if (message) console.log(message);
    } });
    console.log("\nSetup complete! You can now use 'superimg render'.");
  } catch (err) {
    console.error("\nFailed to install SuperImg runtime requirements.");
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
