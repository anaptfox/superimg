//! Setup command - installs SuperImg-owned runtime requirements

export async function setupCommand() {
  const { setup } = await import("@superimg/node");
  console.log("Installing SuperImg runtime requirements...\n");

  try {
    await setup({
      onProgress: (message) => {
        if (message) console.log(message);
      },
    });
    console.log("\nSetup complete! You can now use 'superimg export'.");
  } catch (err) {
    console.error("\nFailed to install SuperImg runtime requirements.");
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
