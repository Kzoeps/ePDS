/**
 * Re-export client metadata utilities from the shared package.
 *
 * Auth-service code imports from this local path for historical reasons;
 * the implementation now lives in @certified-app/shared.
 */
export {
  resolveClientMetadata,
  resolveClientName,
  escapeCss,
  getClientCss,
  clearClientMetadataCache,
} from '@certified-app/shared'
export type { ClientMetadata, ClientBranding } from '@certified-app/shared'
