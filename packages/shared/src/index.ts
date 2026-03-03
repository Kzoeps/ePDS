export { EpdsDb } from './db.js'
export type {
  VerificationTokenRow,
  BackupEmailRow,
  EmailRateLimitRow,
  AuthFlowRow,
} from './db.js'
export {
  generateVerificationToken,
  hashToken,
  timingSafeEqual,
  generateCsrfToken,
  generateRandomHandle,
  signCallback,
  verifyCallback,
} from './crypto.js'
export type { CallbackParams } from './crypto.js'
export type {
  EpdsLinkConfig,
  EmailConfig,
  AuthConfig,
  RateLimitConfig,
} from './types.js'
export { DEFAULT_RATE_LIMITS } from './types.js'
export { createLogger } from './logger.js'
export {
  resolveClientMetadata,
  resolveClientName,
  escapeCss,
  getClientCss,
} from './client-metadata.js'
export type { ClientMetadata, ClientBranding } from './client-metadata.js'
export { validateLocalPart, LOCAL_PART_MIN, LOCAL_PART_MAX } from './handle.js'
export {
  escapeHtml,
  maskEmail,
  formatOtpPlain,
  formatOtpHtmlGrouped,
} from './html.js'
