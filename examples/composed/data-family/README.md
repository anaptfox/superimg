# Data family

One reusable video card appears twice in a named sequence. The two collection
entries supply complete data patches at `first` and `second`. The child
`resolve()` hook chooses each occurrence's duration, so the short entry is 75
frames and the long entry is 125 frames at 25 fps. The sample source used for
both occurrences remains unchanged.

`data-family.media.ts` is the single sample film cataloged for preview.
`collection/data-family-collection.media.ts` exports both complete entries.

## Rehearse before exporting

For a complete host that prepares a collection, samples difficult entries and
exports those prepared inputs, see [Revision review](../../apps/revision-review/README.md).
Its batch deliberately includes long text and an absent product. Report the
sampled entry, edition and frame coverage separately from the planned matrix;
a captured frame is not evidence that every output frame was reviewed.

A collection snapshot freezes provider rows. A prepared export also retains its
resolved media and declared rendering resources for rehearsal and export. Keep
that preparation alive until export completes, then dispose it. Host-owned
preparation references identify inputs; they do not authorize an export or
publish artifacts. A later source change should require an explicit preparation
policy rather than silently replacing the rehearsed work.

Keep this example's shared imported child intact. Occurrence data and local
`resolve()` results demonstrate reuse; they do not make the imported child's
computed source editable through an exact literal binding.
