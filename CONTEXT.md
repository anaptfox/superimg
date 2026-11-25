# SuperImg

SuperImg separates authored media meaning, deterministic delivery, and
host-owned execution. This glossary names the values that cross those
boundaries without collapsing one into another.

## Authored media

**Media Definition**:
The canonical authored value describing one deterministic piece of media and
its render behavior.
_Avoid_: Template, render job

**Media Source**:
A host-identified source that can produce a Media Definition or Collection.
_Avoid_: File, template path

**Media IR**:
A portable semantic representation of authored media, distinct from both its
source and its rendered artifacts.
_Avoid_: Source bundle, export

**Variant**:
A named content or data treatment that preserves the authored geometry and
delivery contract.
_Avoid_: Size variant, format variant

**Edition**:
Named art direction for an exact aspect or canvas that genuinely needs a
different composition.
_Avoid_: Responsive breakpoint, variant

**Collection**:
One media definition materialized for a set of durably identified entries.
_Avoid_: Playlist, batch job

**Collection Snapshot**:
A frozen, portable set of collection entries from one provider evaluation.
_Avoid_: Live provider, cache

## Delivery

**Destination**:
A named delivery intent that resolves to one or more concrete renditions.
_Avoid_: Output path, encoder preset

**Rendition**:
One exact artifact request identified by entry, variant, edition, size, and
encoding coordinates.
_Avoid_: Variant, destination

**Export Bundle**:
An unpublished, portable set of verified rendition artifacts and its manifest.
_Avoid_: Publication, receipt

**Publication**:
A host-owned durable placement of an Export Bundle.
_Avoid_: Export Bundle, URL

**Publication Receipt**:
A portable statement identifying a committed Publication and its manifest.
_Avoid_: Export Bundle, progress record

## Hosted interactions

**Media Program**:
The portable, handler-free set of contracts through which a host exposes
project media work.
_Avoid_: Application, runtime

**Interaction Execution**:
One host-identified invocation of a Media Program interaction.
_Avoid_: Job, render

**Progress Record**:
An immutable, portable observation of an Interaction Execution at an interaction,
stage, or item boundary.
_Avoid_: Authority, receipt, effect proof

**Stage**:
A stable named phase within an Interaction Execution.
_Avoid_: Log message, percentage bucket

**Item**:
A durably identified unit observed within a Stage, such as one rendition.
_Avoid_: Array index, display name

**Work**:
An exact count of completed units with a total only when that total is known.
_Avoid_: Percentage, estimate

**Uncertain Outcome**:
A terminal classification for an effect that may have started when available
evidence proves neither completion nor non-application.
_Avoid_: Failure, automatic retry
