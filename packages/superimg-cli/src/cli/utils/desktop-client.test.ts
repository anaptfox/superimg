import { describe, expect, it } from "vitest";
import { desktopClient } from "./desktop-client.js";

const connection = {
  version: 1 as const,
  baseUrl: "http://127.0.0.1:4321",
  token: "test-token",
  sessionId: "sess-1",
};

describe("desktopClient.tryCall", () => {
  it("returns typed fault with certainty='unknown' when transport disconnects", async () => {
    const client = desktopClient(connection, async () => {
      throw new TypeError("fetch failed");
    });
    const outcome = await client.tryCall("media.export", { source: "launch" });
    expect(outcome.kind).toBe("fault");
    if (outcome.kind === "fault") {
      expect(outcome.certainty).toBe("unknown");
      expect(outcome.message).toContain("disconnected");
    }
  });
});
