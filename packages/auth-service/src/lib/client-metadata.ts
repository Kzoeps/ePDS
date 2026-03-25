/**
 * Re-exports client metadata utilities from @certified-app/shared.
 *
 * The implementation was moved to the shared package so that pds-core can
 * also resolve custom ePDS metadata fields (e.g. epds_skip_consent_on_signup).
 * Auth-service imports are preserved for backwards compatibility.
 */

export { resolveClientMetadata, resolveClientName } from '@certified-app/shared'
export type { ClientMetadata } from '@certified-app/shared'
