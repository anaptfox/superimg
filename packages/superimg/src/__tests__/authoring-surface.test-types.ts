//! Compile-time proof that the root owns the complete authoring type surface.

import type {
  AssetDeclaration as RootAssetDeclaration,
  AssetKind as RootAssetKind,
  CollectionEntryIdResolver as RootCollectionEntryIdResolver,
  DefineHtmlAnimatedInput as RootDefineHtmlAnimatedInput,
  DefineHtmlStaticInput as RootDefineHtmlStaticInput,
  DefineSvgAnimatedInput as RootDefineSvgAnimatedInput,
  DefineSvgStaticInput as RootDefineSvgStaticInput,
  TailwindConfig as RootTailwindConfig,
} from "../index.js";

type RootAuthoringTypes = readonly [
  RootAssetDeclaration,
  RootAssetKind,
  RootCollectionEntryIdResolver<{ slug: string }>,
  RootDefineHtmlAnimatedInput,
  RootDefineHtmlStaticInput,
  RootDefineSvgAnimatedInput,
  RootDefineSvgStaticInput,
  RootTailwindConfig,
];

export const authoringTypeParity: RootAuthoringTypes extends readonly unknown[] ? true : false = true;
