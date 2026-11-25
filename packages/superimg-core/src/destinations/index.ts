export {
  ORGANIC_DESTINATIONS,
  ORGANIC_DESTINATION_IDS,
  ORGANIC_DESTINATION_PLATFORMS,
  getDestination,
} from "./catalog.js";
export {
  DestinationTargetError,
  parseCustomDestinationTarget,
  resolveDestinationTarget,
  type DestinationTargetErrorCode,
} from "./custom-target.js";
export {
  DestinationCatalogError,
  validateDestinationCatalog,
} from "./validate.js";
export { createDestinationRegistry } from "./registry.js";
export type {
  CatalogDestinationTarget,
  CustomDestinationTarget,
  DestinationCanvas,
  DestinationClaim,
  DestinationClaimAuthority,
  DestinationClaimStatus,
  DestinationDefinition,
  DestinationId,
  DestinationImageEncodingDefaults,
  DestinationMedium,
  DestinationPlatform,
  DestinationProvenance,
  DestinationTarget,
  DestinationVideoEncodingDefaults,
} from "./types.js";
