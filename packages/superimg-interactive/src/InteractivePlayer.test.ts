import { afterEach, describe, expect, it } from "vitest";
import { createInteractiveMount } from "./InteractivePlayer.js";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("InteractivePlayer React boundary", () => {
  it("isolates a late session from the next StrictMode effect mount", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    const first = createInteractiveMount(host);
    first.remove();
    const second = createInteractiveMount(host);

    // The first async load may commit after cleanup. It remains attached only
    // to its detached private mount and cannot erase or duplicate the live one.
    first.appendChild(document.createElement("iframe"));
    second.appendChild(document.createElement("iframe"));

    expect(first.querySelectorAll("iframe")).toHaveLength(1);
    expect(host.querySelectorAll("iframe")).toHaveLength(1);

    second.remove();
    expect(host.querySelectorAll("iframe")).toHaveLength(0);
  });
});
