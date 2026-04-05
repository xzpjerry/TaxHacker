# Self-Hosted Password-Based Auth Design

## Problem

Self-hosted mode currently has zero auth — no login, no logout, no user management.
A single hardcoded user (`taxhacker@localhost`) owns all data.
We need proper password-based auth with admin-managed user accounts, without relying on email (Resend) since self-hosted instances run on LAN.

## Env Variables

Add two new variables to `.env.example`:

- `SELF_HOSTED_ADMIN_EMAIL` — defaults to `taxhacker@localhost` (backwards compatible)
- `SELF_HOSTED_ADMIN_PASSWORD` — the admin user's password (required when self-hosted mode is enabled)

The admin user with this email/password is auto-created on app startup if it doesn't exist.

## Auth Backend Changes

### better-auth config (`lib/auth.ts`)

Add the `email-password` plugin to the existing email OTP configuration. This gives us `signIn.email()` and `signUp.email()` methods that handle passwords natively.

No changes to the email OTP plugin — cloud mode keeps it unchanged.

### Session handling

Both `getSession()` and `getCurrentUser()` must route through `auth.api.getSession()` in self-hosted mode (same as cloud). The current bypass that returns `getSelfHostedUser()` directly is removed. This enables real session management — logout, user switching, etc.

### Admin user seeding

On app startup, if `SELF_HOSTED_MODE=true`, check whether the admin user (matching `SELF_HOSTED_ADMIN_EMAIL`) exists. If not, create it via `auth.api.signUpEmail()` which stores the hashed password in the `Account` table (already has a `password` field).

## New Pages & UI

### Admin User Management (`/settings/admin`)

A new settings page, visible to self-hosted users, accessible only to the admin role.

**Layout:** Simple table listing all users with columns: Name, Email, Created.
**Actions:** Admin can:
- **Create user** — dialog/form with Name, Email, Password fields. Creates user via server action that wraps `auth.api.signUpEmail()`.
- **Delete user** — deletes a user (and their data via existing cascade rules).
- **Reset user password** — opens a dialog where admin enters a new password for the user.

### Settings layout

Keep the existing sidebar navigation layout. Add "Admin" as a new menu item (visible in self-hosted mode only).

### Sidebar logout button (`components/sidebar/sidebar-user.tsx`)

Remove the `!isSelfHosted` guard around the logout button. The existing `signOut()` function works — it calls `authClient.signOut()` and redirects to `/`.

### Welcome / setup flow (`app/(auth)/self-hosted/page.tsx`)

The self-hosted welcome page currently auto-creates the user on first visit. With real auth, this changes:

- If the admin user doesn't exist yet, show a simple "Admin account created on startup. You can now log in." message, with a link to `/enter`.
- If the admin user exists, redirect to `/` (which will then redirect to `/dashboard` if authenticated, or show the landing page).

The old LLM provider / API key setup form moves to the admin's settings or dashboard onboarding.

### Login page (`app/(auth)/enter/page.tsx`)

Add a conditional login form variant for self-hosted mode:

- **Self-hosted mode:** Email + password login form using `authClient.signIn.email()` from better-auth's email-password plugin.
- **Cloud mode:** Keep the existing OTP-based login form.

### Registration

No public registration page. All users are created via the admin panel.

The `disableSignup` better-auth option stays `true` for self-hosted mode, so nobody can self-register. The admin creates users via the settings page, which uses the server-side API directly.

## Data Flow

```
[Self-hosted startup]
  → Check admin user exists by email
  → If not: auth.api.signUpEmail(email=ADMIN_EMAIL, password=ADMIN_PASSWORD)
  → User can now log in at /enter

[Login]
  → /enter shows email+password form (self-hosted) or OTP form (cloud)
  → Auth via authClient.signIn.email()
  → Session stored in DB via better-auth
  → Redirect to /dashboard

[Logout]
  → Sidebar dropdown → "Log out"
  → authClient.signOut() → redirect to /

[Admin creates user]
  → /settings/admin → "Create User" dialog
  → Server action → auth.api.createUser() or signUpEmail bypass
  → New user appears in table with "Reset Password" / "Delete" actions
```

## Self-Review

- No TBDs or incomplete sections.
- Architecture matches feature descriptions.
- Scope is focused on self-hosted auth only; cloud mode left untouched besides being unaffected by plugin addition.
- All requirements are explicit: admin-only user management, password auth, no email dependency.
