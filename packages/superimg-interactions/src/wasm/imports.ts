/**
 * Host-authored import offer for the thumbnail guest.
 *
 * The map is never derived from Program footprints. Choosing what a guest
 * may import is a host decision; a declaration is not a grant. Bind compares
 * the component binary's actual imports against this offer using the Boundary
 * instance-name law (`boundary:guest/footprints@1.0.0`, not the bare `footprints`
 * suffix).
 */
/** WIT instance the thumbnail world imports. Package and version are identity. */
export const THUMBNAIL_GUEST_INTERFACE = "boundary:guest/footprints@1.0.0";

/** Thumbnail guest may read decoded artifacts and write thumbnails. Nothing else. */
export const THUMBNAIL_IMPORT_FOOTPRINTS = Object.freeze([
  "media.artifacts",
  "media.thumbnails",
] as const);
