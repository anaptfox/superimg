// Start the Vite host from README.md, then run this file from the repo root.
import assert from "node:assert/strict";
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:4188/");
  await page.waitForFunction(() => !document.querySelector("button")?.disabled);
  const diagram = page.frameLocator("#player iframe");
  const steps = [
    ["DNS", "dns", "Resolve the hostname to an IP address."],
    ["Connect", "connect", "Open a connection to the server."],
    ["Server", "server", "The origin builds the response."],
    ["Response", "response", "Bytes become a rendered page."],
  ];
  for (const [label, id, note] of steps) {
    // Normal clicks also detect an iframe that spills over its host controls.
    await page.getByRole("button", { name: label, exact: true }).click();
    await page.waitForFunction(
      (label) => document.querySelector('button[aria-current="step"]')?.textContent === label,
      label,
    );
    assert.equal(await page.locator("#status").innerText(), note);
    assert.ok((await diagram.locator("body").innerText()).includes(note));
    assert.equal(await diagram.locator(`[data-si-node="${id}"]`).evaluate(
      (element) => getComputedStyle(element).opacity,
    ), "1");
  }
  assert.deepEqual(errors, []);
  console.log("Request journey: all four guide states and visible diagrams passed.");
} finally {
  await browser.close();
}
