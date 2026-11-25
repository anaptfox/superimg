import { expect, it } from "vitest";
import { prepareMovieExportReview } from "./movie-review.js";

const description = { sourceKind: "media" as const, animated: true, variantIds: [], editionIds: ["default"] };

it("accepts catalog video destinations and a custom size with a default mp4 format", async () => {
  await expect(prepareMovieExportReview("/tmp/superimg-missing-film.media.ts", description, { for: ["youtube"] })).resolves.toEqual(
    expect.objectContaining({ retainSource: expect.any(Function) }),
  );
  await expect(prepareMovieExportReview("/tmp/superimg-missing-film.media.ts", description, { for: ["1080x1920"] })).resolves.toEqual(
    expect.objectContaining({ retainSource: expect.any(Function) }),
  );
  await expect(prepareMovieExportReview("/tmp/superimg-missing-film.media.ts", description, { for: ["tiktok"] })).resolves.toEqual(
    expect.objectContaining({ retainSource: expect.any(Function) }),
  );
  await expect(prepareMovieExportReview("/tmp/superimg-missing-film.media.ts", description, { for: ["1080x1920.png"] })).rejects.toMatchObject({
    code: "UNSUPPORTED_SELECTION",
  });
});
