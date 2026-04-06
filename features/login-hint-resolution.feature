Feature: Login hint resolution
  ePDS resolves OAuth login_hint parameters so the auth service can skip
  the email form and go straight to OTP verification. Hints can be emails
  or AT Protocol handles.

  The parsing and internal API call logic is unit-tested in
  resolve-login-hint.test.ts. These E2E scenarios test the observable
  user-facing behavior.

  Background:
    Given the ePDS test environment is running
    And a returning user has a PDS account

  Scenario: Email login hint skips the email form
    When the demo client initiates OAuth with the test email as login_hint
    Then the login page renders directly at the OTP verification step
    And an OTP email is auto-sent to the test email

  Scenario: Handle login hint is resolved and skips the email form
    When the demo client initiates OAuth with the user's handle as login_hint
    Then the login page renders directly at the OTP verification step
    And an OTP email is auto-sent to the test email

  # @pending: DID hint requires the demo to support a ?did= query param
  # which is not yet implemented.
  @pending
  Scenario: DID login hint is resolved and skips the email form
    When the demo client initiates OAuth with the user's DID as login_hint
    Then the login page renders directly at the OTP verification step
    And an OTP email is auto-sent to the test email

  # --- PAR body hint ---

  # @pending: requires login_hint in the PAR body — the demo currently only
  # passes it in the redirect URL. Implement when PAR body hint support is
  # added to the demo.
  @pending
  Scenario: Login hint from PAR body is used when not on query string
    When the demo client submits login_hint in the PAR request body (not the redirect URL)
    Then the auth service retrieves the hint from the stored PAR request
    And the login page renders at the OTP step with the hint resolved

  # --- Unknown hint ---

  # @pending: the unknown hint causes the demo to attempt handle resolution which
  # fails before reaching the auth service (redirects to /?error=auth_failed).
  # Testing this properly requires hitting the auth service /oauth/authorize
  # directly with an unknown login_hint, bypassing the demo.
  @pending
  Scenario: Unknown login hint falls back to email form
    When the demo client initiates OAuth with login_hint="unknown.pds.test"
    Then the login page shows the email input form (hint could not be resolved)
