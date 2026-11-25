import type { Command } from "commander";
import { desktopClient, parseDesktopInput, readDesktopConnection } from "../utils/desktop-client.js";

type Options = { connectionFile?: string; input?: string };
const print = (value: unknown) => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);

export function registerDesktopCommands(program: Command): void {
  const desktop = program.command("desktop").description("Call the running local JavaScript Boundary host");
  const connection = (command: Command) => command.option("--connection-file <path>", "Private connection file for the desktop profile");
  connection(desktop.command("status").description("Inspect the running desktop session")).action(async (options: Options) => {
    const record = await readDesktopConnection(options.connectionFile);
    print(await desktopClient(record).callRaw("desktop.session.inspect", {}));
  });
  connection(desktop.command("interactions").description("Inspect the live interaction Binding")).action(async (options: Options) => {
    print(await desktopClient(await readDesktopConnection(options.connectionFile)).inspect());
  });
  connection(desktop.command("call <interaction>").description("Invoke one interaction without retries").option("--input <json-or-file>", "JSON object or path to a JSON file")).action(async (interaction: string, options: Options) => {
    const input = await parseDesktopInput(options.input);
    print(await desktopClient(await readDesktopConnection(options.connectionFile)).callRaw(interaction, input));
  });
  connection(desktop.command("mcp").description("Relay MCP stdio to the running desktop; stdout is protocol only")).action(async (options: Options) => {
    const { relayDesktopMcp } = await import("../utils/desktop-mcp.js");
    await relayDesktopMcp(await readDesktopConnection(options.connectionFile));
  });
}
