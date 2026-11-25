import { homedir } from "node:os";
import { join } from "node:path";

export function defaultBusSocket(): string {
  return process.env.BOUNDARY_BUS_SOCKET?.trim() || join(homedir(), ".boundary", "bus.sock");
}
