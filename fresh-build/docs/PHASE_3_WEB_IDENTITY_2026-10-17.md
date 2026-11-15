# Phase 3 local web identity journey — 17 October 2026

The isolated fresh-build Supabase stack and local Next web server were used
with two disposable synthetic Auth users: System Admin and Member. No real
person or production data was used. The System Admin provisioned the Member
through `/api/v1/users`. All test users and sessions are removed by the final
local database reset.

## Observed browser and API results

- The Member's issued temporary password signed in through the actual web
  form and opened its change-password screen. The sign-in password field was
  empty after the mode switched. The new Sign out button returned to an empty
  sign-in form.
- A local API password change revoked the temporary session and cleared its
  gate. A fresh browser sign-in with the new password reached the Member's
  read-only contributor roster.
- System Admin reset the Member password through the real local API. Reloading
  the old browser session showed a sign-in link instead of protected data.
  The reset password returned the browser to the temporary-password screen.
- Before correction, direct navigation to `/contributors` with a temporary
  session showed a false read-only label and the raw `not_authorized` error.
  It now shows only a password-change link. The login page restores a saved
  temporary session directly to the change screen without another login
  attempt.
- After completing the reset password through the local API, the old browser
  session returned to sign-in. The new password reached the roster. Normal
  Sign out hid the roster and cleared the page's role and donor data.
- Deliberate repeated sign-ins reached the shared five-attempt limit and the
  UI showed `RATE_LIMITED`. The shared client now renders a clear retry
  message. Only this synthetic user's disposable local rate bucket was
  cleared to continue the reset journey; no product limit was changed.

## Code and verification

The web login button stays disabled until hydration, preventing a silent
pre-hydration POST of credentials to the page route. Separate keyed forms
clear the old password when switching between sign-in and change-password
modes. Web and Android temporary-password screens offer Sign out. Android
also disables password submission outside the server's 12–128 character
range. Shared identity client errors retain stable codes while showing safe,
readable text.

Seventy-six Node tests, lint, typecheck, formatting, Next production build,
and Android bundle export passed. The browser showed the real first-password
and reset gates, fresh login, protected-route denial and Sign out. Browser
automation did not submit the new-password form because the computer-use
policy requires a human handoff for changing a credential. The API password
change and complete server lifecycle passed separately. Android UI behavior
has source/build evidence only and still needs device interaction.
