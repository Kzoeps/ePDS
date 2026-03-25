export default {
  paths: [
    'features/passwordless-authentication.feature',
    'features/oauth-metadata-override.feature',
    'features/email-delivery.feature',
    'features/consent-screen.feature',
    'features/login-hint-resolution.feature',
    'features/account-settings.feature',
    'features/automatic-account-creation.feature',
    'features/pds-behavior-at-risk.feature',
  ],
  import: ['e2e/step-definitions/**/*.ts', 'e2e/support/**/*.ts'],
  format: ['progress-bar', 'html:reports/e2e.html'],
  tags: 'not @manual and not @pending',
  strict: false,
}
