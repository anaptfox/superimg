import { createServer, type Server } from "node:http";
import { admitAll, type SlotRebindResult } from "@foxworth/boundary";
import { createReachRecord, type ReachRecord } from "@foxworth/boundary/reach";
import { createProtocolHandler } from "@foxworth/boundary/http";
import { sendFetchResponse, toFetchRequest } from "@foxworth/boundary/http/node";
import {
  createMediaInteractionSlot,
  projectMediaReachSurface,
  type MediaInteractionMount,
} from "@foxworth/superimg-interactions";
import { BusClient } from "@foxworth/boundary/bus";
import { defaultBusSocket } from "./boundary-bus.js";

const PROTOCOL_PATH = "/boundary/v1";

export type MediaReachHandle<Context = unknown> = Readonly<{
  readonly record: ReachRecord;
  readonly url: string;
  /** Atomically hot-swap the mounted Media interactions behind this live Reach endpoint. */
  rebind(nextMount: MediaInteractionMount<Context>, revision?: string): Promise<SlotRebindResult>;
  stop(): Promise<void>;
}>;

async function listen(server: Server): Promise<{ url: string; close(): Promise<void> }> {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("media reach server did not bind a TCP port");
  }
  return {
    url: `http://127.0.0.1:${address.port}${PROTOCOL_PATH}`,
    close() {
      return new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}

/**
 * Register a Reach record for the Media Offer surface. The bus holds no
 * authority: closing the socket withdraws the address. Missing bus is skipped
 * so ordinary CLI dispatch still works.
 */
export async function startMediaReach<Context>(
  mount: MediaInteractionMount<Context>,
  context: Context,
): Promise<MediaReachHandle<Context> | undefined> {
  const socketPath = defaultBusSocket();
  let bus: BusClient;
  try {
    bus = await BusClient.connect(socketPath);
  } catch {
    return undefined;
  }

  const installationId = "superimg-cli:media";
  let slot;
  try {
    slot = createMediaInteractionSlot({
      mount,
      installationId,
      revision: "cli",
      projection: projectMediaReachSurface(),
      admit: admitAll,
    });
  } catch {
    bus.close();
    return undefined;
  }

  let handler = createProtocolHandler({
    binding: slot.current,
    path: PROTOCOL_PATH,
    context: () => context,
  });
  const server = createServer((incoming, outgoing) => {
    void (async () => {
      const request = toFetchRequest(incoming, { origin: "http://127.0.0.1" });
      const response = await handler(request);
      await sendFetchResponse(outgoing, response, incoming.method);
    })();
  });
  const listening = await listen(server);
  let activeRecord = await createReachRecord(
    slot.current.manifest.bindingDigest,
    installationId,
    [{ kind: "http", url: listening.url }],
  );
  try {
    await bus.register(activeRecord);
  } catch {
    await listening.close();
    bus.close();
    slot.dispose();
    return undefined;
  }

  let stopped = false;
  return {
    get record() {
      return activeRecord;
    },
    url: listening.url,
    async rebind(nextMount, revision) {
      if (stopped) {
        throw new Error("Cannot rebind a stopped media reach handle");
      }
      const outcome = slot.rebind(nextMount, revision === undefined ? {} : { revision });
      if (outcome.status !== "rebound") return outcome;
      handler = createProtocolHandler({
        binding: slot.current,
        path: PROTOCOL_PATH,
        context: () => context,
      });
      const previousDigest = activeRecord.bindingDigest;
      const nextRecord = await createReachRecord(
        slot.current.manifest.bindingDigest,
        installationId,
        [{ kind: "http", url: listening.url }],
      );
      try {
        await bus.register(nextRecord);
        if (previousDigest !== nextRecord.bindingDigest) {
          await bus.unregister(previousDigest).catch(() => {});
        }
        activeRecord = nextRecord;
      } catch {
        // Live HTTP handler is already rebound; bus re-registration is best-effort.
      }
      return outcome;
    },
    async stop() {
      if (stopped) return;
      stopped = true;
      try {
        await bus.unregister(activeRecord.bindingDigest);
      } catch {
        // Closing the socket still withdraws the record.
      }
      bus.close();
      await listening.close();
      slot.dispose();
    },
  };
}
