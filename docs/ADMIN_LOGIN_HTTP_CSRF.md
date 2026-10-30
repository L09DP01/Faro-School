# Admin login blocked before credentials verification

## Confirmed production evidence

Worker tail observed two POST /api/auth/callback/credentials failures with Auth.js MissingCSRF. Their Origin and Referer were http://faroschool.com and x-forwarded-proto was http. No cookie header was present. An anonymous HTTPS GET /api/auth/csrf returned a token and valid Secure, HttpOnly, Path=/ __Host-authjs.csrf-token cookie, with private/no-store caching.

Thus these requests failed CSRF validation before authorize checked a password or role. LoginForm previously mapped all unknown Auth.js errors to incorrect credentials, hiding the cause. No remote Supabase query, mutation, password or code was used for this diagnosis. Raw troubleshooting logs were discarded after extracting sanitized metadata and were never committed.

## Fix

custom-worker.mjs redirects HTTP faroschool.com/www.faroschool.com to the same HTTPS URL with 308, before invoking OpenNext. This covers the landing, PWA, login, and API paths excluded by Next middleware. Path/query remain intact; HTTPS is passed through unchanged; localhost remains usable. Secure cookies and CSRF checks are retained.

The login UI now distinguishes MissingCSRF, CredentialsSignin, email verification, lockout and infrastructure errors in FR/KR. No auth bypass or change to role authorization was made. Its outdated eight-character hint now says ten characters.

## Checks

Worker tests assert both public hosts and auth paths upgrade without reaching OpenNext, HTTPS does not loop, and cron/local development behavior is preserved. The actual LoginForm submit handler is tested against Auth.js error responses. Existing encrypted-cookie middleware tests cover admin/instructor/student roles.

Optional defense in depth: Cloudflare zone SSL/TLS > Edge Certificates > Always Use HTTPS (https://developers.cloudflare.com/ssl/edge-certificates/additional-options/always-use-https/). The code fix does not depend on that manual setting.
