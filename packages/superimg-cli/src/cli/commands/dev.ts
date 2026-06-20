//! Dev command - thin CLI wrapper over startDevServer

import { execa } from "execa";
import { formatError } from "@superimg/core/errors";
import { startDevServer } from "../../dev-server.js";

interface DevOptions {
  port: string;
  open: boolean;
}

export async function devCommand(template: string | undefined, options: DevOptions) {
  let server: Awaited<ReturnType<typeof startDevServer>>;
  try {
    server = await startDevServer(template, { port: parseInt(options.port, 10) });
  } catch (err) {
    process.stderr.write(formatError(err).ansi + "\n");
    process.exit(1);
  }

  console.log(`\n  SuperImg dev server running at ${server.url}\n`);

  if (options.open) {
    const openCmd =
      process.platform === "win32" ? "start" : process.platform === "darwin" ? "open" : "xdg-open";
    execa(openCmd, [server.url]).catch(() => {});
  }

  const cleanup = async () => {
    console.log("\n  Shutting down dev server...\n");
    await server.close();
    process.exit(0);
  };

  process.once("SIGINT", cleanup);
  process.once("SIGTERM", cleanup);
}
