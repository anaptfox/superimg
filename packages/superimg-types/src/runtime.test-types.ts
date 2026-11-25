//! Compile-time probes for the value-first runtime contract.

import {
  image,
  collection,
  type CheckReport,
  type ExportBundle,
  type ExportOptions,
  type InspectReport,
  type MediaRenderOptions,
  type MediaRenderResult,
  type MediaValue,
  type Runtime,
  type RuntimeRenditionCoordinates,
} from "./index.js";
import { MEDIA_ELEMENT, type MediaElement } from "./media-node.js";

function Html(html: string): MediaElement {
  return {
    $$typeof: MEDIA_ELEMENT,
    type: "Html",
    props: { width: "fill", height: "fill", html },
    children: [],
  };
}

const still = image<{ id: string; title: string }>({
  render: ({ data }) => Html(data.title),
});
const family = collection({ entries: [{ id: "hello", title: "Hello" }], media: still });
const stillValue: MediaValue = still;
const familyValue: MediaValue = family;

declare const runtime: Runtime;
const abi: string = runtime.abi;
const canInspect: boolean = runtime.capabilities.inspect;
const disposal: Promise<void> = runtime.dispose();
const asyncDisposal: PromiseLike<void> = runtime[Symbol.asyncDispose]();

const renderOptions = {
  as: "png",
  at: "1s",
  variantId: "default",
} satisfies MediaRenderOptions;

const exportOptions = {
  for: ["youtube", "instagram-square"],
} satisfies ExportOptions;

declare const rendered: MediaRenderResult;
const stream: ReadableStream<Uint8Array> = rendered.stream();
const bytes: Promise<Uint8Array> = rendered.bytes();
const blob: Promise<Blob> = rendered.blob();
const text: Promise<string> = rendered.text();

declare const bundle: ExportBundle;
const bundleDisposal: Promise<void> = bundle.dispose();
const bundleAsyncDisposal: PromiseLike<void> = bundle[Symbol.asyncDispose]();

const coordinates = {
  entryId: "hello",
  variantId: "default",
  editionId: "default",
  renditionId: "youtube",
} satisfies RuntimeRenditionCoordinates;

// Runtime coordinates intentionally have no required host source identity.
const renditionId: string = coordinates.renditionId;

declare const checked: CheckReport;
declare const inspected: InspectReport;
const digest: string = checked.programDigest;
const findings = inspected.findings;

void stillValue;
void familyValue;
void abi;
void canInspect;
void disposal;
void asyncDisposal;
void renderOptions;
void exportOptions;
void stream;
void bytes;
void blob;
void text;
void bundleDisposal;
void bundleAsyncDisposal;
void renditionId;
void digest;
void findings;
