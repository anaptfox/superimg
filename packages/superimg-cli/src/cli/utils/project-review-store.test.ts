import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { createReviewCapture, projectReviewDirectory, publishProjectReview, publishReviewIndex } from "./project-review-store.js";

it("keeps captures and atomically publishes a stable project review index", async () => {
  const root = await mkdtemp(join(tmpdir(), "superimg-project-review-"));
  try {
    await writeFile(join(root, "package.json"), "{}");
    const source = join(root, "board.json");
    const first = await createReviewCapture(source, "square");
    await writeFile(join(first.directory, "frame.png"), "first evidence");
    await publishReviewIndex(first.indexPath, { capture: first.directory });
    const second = await createReviewCapture(source, "square");
    expect(second.indexPath).toBe(first.indexPath);
    expect(second.directory).not.toBe(first.directory);
    const aborted = new AbortController(); aborted.abort();
    await expect(publishReviewIndex(second.indexPath, { capture: second.directory }, aborted.signal)).rejects.toThrow();
    expect(JSON.parse(await readFile(first.indexPath, "utf8"))).toEqual({ capture: first.directory });
    expect(await readFile(join(first.directory, "frame.png"), "utf8")).toBe("first evidence");
    await publishReviewIndex(second.indexPath, { capture: second.directory });
    expect(JSON.parse(await readFile(second.indexPath, "utf8"))).toEqual({ capture: second.directory });
    expect(projectReviewDirectory(source, "../square")).not.toBe(projectReviewDirectory(source, "square"));
    expect(projectReviewDirectory(source, "../square")).toContain(join(root, ".superimg", "reviews"));
  } finally { await rm(root, { recursive: true, force: true }); }
});

it("keeps stable selection indexes independently of the latest edition pointer", async () => {
  const root = await mkdtemp(join(tmpdir(), "superimg-review-selections-"));
  try {
    await writeFile(join(root, "package.json"), "{}");
    const capture = await createReviewCapture(join(root, "board.json"), "square");
    const first = await publishProjectReview(capture.indexPath, { frame: 1, size: [100, 100] }, { reportPath: "capture-a", value: "a" });
    const second = await publishProjectReview(capture.indexPath, { size: [100, 100], frame: 2 }, { reportPath: "capture-b", value: "b" });
    expect(first.selectionPath).not.toBe(second.selectionPath);
    expect(JSON.parse(await readFile(first.selectionPath, "utf8"))).toMatchObject({ value: "a", reportPath: first.selectionPath });
    expect(JSON.parse(await readFile(capture.indexPath, "utf8"))).toMatchObject({ value: "b", selectionPath: second.selectionPath });
    const repeat = await publishProjectReview(capture.indexPath, { size: [100, 100], frame: 1 }, { reportPath: "capture-c", value: "c" });
    expect(repeat.selectionPath).toBe(first.selectionPath);
    expect(JSON.parse(await readFile(first.selectionPath, "utf8")).value).toBe("c");
    const aborted = new AbortController(); aborted.abort();
    await expect(publishProjectReview(capture.indexPath, { frame: 1, size: [100, 100] }, { reportPath: "capture-d", value: "d" }, aborted.signal)).rejects.toThrow();
    expect(JSON.parse(await readFile(first.selectionPath, "utf8")).value).toBe("c");
  } finally { await rm(root, { recursive: true, force: true }); }
});
