> Actualisation layout : les choix de hauteur et safe areas ci-dessous sont remplacés par PWA_IPHONE_NOTES.md. Aucun calcul JavaScript ne dimensionne désormais le shell ; les correctifs d’authentification et d’installation restent applicables.

# PWA installation, screen frame and login

- Full app height uses CSS 100dvh; VisualViewport overrides it only for a focused control with a keyboard-sized reduction. Safe areas are contained in the app, not subtracted again. Root background matches the app below the home indicator; only the status overlay is navy. Landing remains excluded.
- Manifest name and short_name are Faro School. Existing iOS home icons may keep the label entered at installation: rename/re-add that icon if needed.
- iPhone/iPad (including iOS Chrome) get FR/KR manual instructions. Android shows the native install prompt only after beforeinstallprompt. Desktop prompt events are not intercepted, and the profile install button is hidden when unavailable. Cookie/source preferences never prove installed display mode.
- Auth.js authorize reads the request IP, not a submitted IP or a shared loopback address on Cloudflare. Credential error codes are read from SignInResponse.code, so verification/lockout are distinguished after correct credentials. Admin login defaults to the role-aware /app dispatcher; server guards preserve next redirects.
- The dashboard and profile logout controls previously only linked to login: they now await Auth.js signOut (CSRF handled by its client), then hard-navigate to login. Failure stays on the page with FR/KR feedback. The site header no longer sends an extra unprotected signout POST.

## Administrator showing incorrect credentials

The reported production account has not been inspected: no remote Supabase operations are permitted. A profile with role=admin alone is insufficient: user_credentials must contain its Auth.js PBKDF2 hash, and email_verified_at must be set through verification. An old Supabase Auth password cannot authenticate here. Use Forgot password for that address: existing reset_password_atomic safely inserts missing credentials or replaces the hash, increments token_version, and preserves role. A reset does not bypass email verification. Do not paste a plaintext password/hash into SQL or enable a legacy-auth fallback.

## Verification

Local actual-provider tests cover an admin, wrong password, trusted IP, lockout and unverified accounts. Actual provider/component tests cover desktop/Android/iOS install controls and logout success/failure. Browser fixture at 390x844: navigation bottom=844, rootScroll=0 even after scrolling to the final item. Physical iPhone safe areas/keyboard and the real administrator password still require a device/account check. No production database changes or password changes were performed.

Installation reference: https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeinstallprompt_event
