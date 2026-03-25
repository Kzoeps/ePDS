Feature: OAuth consent screen
  When a user logs into a new OAuth client for the first time, ePDS shows
  a consent screen asking for approval. Consent decisions are remembered
  per client. New accounts see consent by default, but sign-up consent can
  be skipped for trusted clients when PDS_SIGNUP_ALLOW_CONSENT_SKIP is set,
  the client is listed in PDS_OAUTH_TRUSTED_CLIENTS, and the client's
  metadata opts in via "epds_skip_consent_on_signup": true.

  Background:
    Given the ePDS test environment is running
    And a demo OAuth client is registered

  Scenario: Existing user sees consent screen for a new client
    Given a returning user has a PDS account
    When the demo client initiates an OAuth login
    And the user enters the test email on the login page
    Then an OTP email arrives in the mail trap
    When the user enters the OTP code
    Then a consent screen is displayed
    And it shows the demo client's name
    When the user clicks "Approve"
    Then the browser is redirected back to the demo client with a valid session

  Scenario: User denies consent
    Given a returning user has a PDS account
    When the demo client initiates an OAuth login
    And the user enters the test email on the login page
    Then an OTP email arrives in the mail trap
    When the user enters the OTP code
    Then a consent screen is displayed
    When the user clicks "Deny"
    Then the browser is redirected to the PDS with an access_denied error

  Scenario: Returning user skips consent for a previously-approved client
    Given a returning user has already approved the demo client
    When the demo client initiates an OAuth login
    And the user enters the test email on the login page
    Then an OTP email arrives in the mail trap
    When the user enters the OTP code
    Then no consent screen is shown
    And the browser is redirected back to the demo client with a valid session

  Scenario: New user sees consent screen by default
    Given no PDS account exists for "newuser@example.com"
    And PDS_SIGNUP_ALLOW_CONSENT_SKIP is not set
    When "newuser@example.com" authenticates via OTP through the demo client
    And a PDS account is created
    Then the consent screen is displayed (skipping account selection)
    And it shows the actual OAuth scopes requested by the client
    When the user clicks "Approve"
    Then the browser is redirected to the demo client with a valid session

  Scenario: New user skips consent when all conditions are met
    Given no PDS account exists for "newuser@example.com"
    And PDS_SIGNUP_ALLOW_CONSENT_SKIP is "true"
    And the demo client is listed in PDS_OAUTH_TRUSTED_CLIENTS
    And the demo client's metadata includes "epds_skip_consent_on_signup": true
    When "newuser@example.com" authenticates via OTP through the demo client
    Then a PDS account is created
    And no consent screen is shown
    And the browser is redirected directly to the demo client with a valid session
    And the client's scopes are recorded as authorized

  Scenario: Consent skip requires all three conditions
    Given no PDS account exists for "newuser@example.com"
    And PDS_SIGNUP_ALLOW_CONSENT_SKIP is "true"
    But the demo client is NOT listed in PDS_OAUTH_TRUSTED_CLIENTS
    When "newuser@example.com" authenticates via OTP through the demo client
    Then the consent screen is displayed (client is not trusted)

  Scenario: Consent skip does not affect subsequent OAuth flows
    Given "existinguser@example.com" had consent skipped during sign-up
    And a different OAuth client initiates a login
    When "existinguser@example.com" authenticates via OTP through the new client
    Then the consent screen is displayed for the new client
    And the new client's actual OAuth scopes are shown

  # TODO: automate once custom CSS injection is merged into the consent route
  # (renderConsent() needs to accept and apply clientBrandingCss from client metadata)
  @manual
  Scenario: Consent page shows client branding for trusted clients
    Given the demo client is listed in PDS_OAUTH_TRUSTED_CLIENTS
    And the demo client's metadata includes custom CSS
    When the consent screen is displayed
    Then the client's custom CSS is applied to the page
