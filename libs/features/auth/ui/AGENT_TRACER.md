# Agent Tracer

## 2026-08-25 - Workspace Dependency Links

**Purpose**: Declare local packages imported by `LoginForm`.

**Changes**: Added workspace dependencies on `@repo/auth/data-access` and `@repo/auth/utils`.

**Handoff**: Auth UI local imports are now backed by explicit pnpm workspace links.

## 2026-08-21T00:00:00Z - Login Page UX Improvements

**Purpose**: Implement comprehensive UX improvements to the login and reset password pages based on Erik D. Kennedy's interaction design principles.

**Changes Made**:

### LoginForm Component (`libs/features/auth/ui/src/LoginForm.tsx`)

1. **Autofocus**: Already implemented with `autoFocus` on email field
2. **Mobile keyboard types**: Changed email input from `type="text"` to `type="email"` for specialized mobile keyboards
3. **Field validation on blur**: Added email format validation on blur that allows employee IDs without @ but validates email format when @ is present
4. **Clickable labels with accessibility**:
   - Added `cursor-pointer` to labels for clickability
   - Added proper `aria-labelledby` attributes using span elements with unique IDs
   - Removed redundant `aria-label` in favor of `aria-labelledby`
5. **Password requirements display**: Added real-time password requirements that show when user starts typing, with visual checkmarks for met requirements
6. **Password visibility toggle**: Already implemented, maintained existing functionality
7. **Value-exposing CTAs**: Changed button text from "Sign In" to "Access Arch Systems" and "Signing in..." to "Accessing your workspace..."
8. **Email-based login**: Already implemented, accepts both employee IDs and email addresses
9. **Specific password error messages**: Added `getPasswordRequirements()` function that provides specific feedback about which requirements aren't met
10. **Remember typed values**: Removed password clearing on failed login to preserve user input
11. **Reset password email preservation**: Added email parameter to forgot password link to preserve entered email

### Reset Password Page (`apps/portal/app/(auth)/reset-password/page.tsx`)

1. **Autofocus**: Added `autoFocus` to email input field
2. **Email preservation**: Added `useEffect` to pre-fill email from URL parameter when coming from login page
3. **Clickable labels with accessibility**: Added `cursor-pointer` and proper `aria-labelledby` with span IDs
4. **Value-exposing CTAs**: Changed button text from "Send Reset Link" to "Send Password Reset Link" and "Sending..." to "Sending reset link..."

**Handoff**: Changes improve user experience by reducing interaction friction, providing better feedback, and following accessibility best practices. All changes maintain backward compatibility with existing authentication flow.

## [2026-09-17T19:07:00Z] LoginForm Industry Best Practices Refactoring & Hardening
- **Agent**: Antigravity (frontend-developer)
- **Scope**: `libs/features/auth/ui/src/LoginForm.tsx`, `apps/portal/features/auth/components/LoginForm.test.tsx`
- **Summary**:
  1. **Validation Logic Inversion Fix**: Resolved dead-code condition on email blur validation. Now validates RFC email format when `@` is typed while allowing badge/employee IDs without `@`. Added `noValidate` on form element to avoid native browser popup blocking valid non-email employee IDs.
  2. **WCAG 2.2 AA Accessibility**: Linked error alerts to password field using `aria-invalid` and dynamic `aria-describedby` (including `password-error`, `caps-lock-warning`, `rate-limit-warning`). Added `aria-controls="password"` and `aria-pressed={showPassword}` to the password visibility toggle button.
  3. **Industrial & Mobile Keyboard Ergonomics**: Added `autoCapitalize="none"`, `autoCorrect="off"`, and `spellCheck={false}` to both employee ID and password inputs to prevent unwanted auto-capitalization on mobile devices and barcode/RFID scanner tablets.
  4. **Zero-Magic Named Invariants (REFAC-01)**: Extracted all inline numeric constraints into unit-suffixed, top-of-file constants (`MIN_EMPLOYEE_ID_LENGTH`, `MAX_EMAIL_LENGTH`, `MIN_PASSWORD_LENGTH`, `MAX_PASSWORD_LENGTH`, `BUTTON_HOVER_SCALE`, `BUTTON_TAP_SCALE`, `DEFAULT_AUTH_REDIRECT`, `AUTHENTICATED_HOME_REDIRECT`).
  5. **Tailwind CSS Clean-Up**: Removed invalid opacity modifier on CSS variable hex token (`hover:brightness-95 active:brightness-90`) and cleaned up focus classes.
  6. **Test Parity**: Expanded unit tests from 9 to 12 passing tests, covering ARIA accessibility attributes, mobile keyboard attributes, and email blur validation.
## [2026-09-17T19:22:00Z] Vercel React Best Practices Refactoring & Suspense Optimization
- **Agent**: Antigravity (frontend-developer)
- **Scope**: `apps/portal/app/(auth)/layout.tsx`, `apps/portal/app/(auth)/login/page.tsx`, `libs/features/auth/ui/src/LoginForm.tsx`, `libs/features/auth/ui/src/RefractionGlow.tsx`, `apps/portal/features/auth/components/LoginForm.test.tsx`
- **Summary**:
  1. **RSC Default**: Converted `apps/portal/app/(auth)/layout.tsx` from `"use client"` to a pure React Server Component (RSC), eliminating unnecessary client boundary wrapping and trimming auth chunk bundle size.
  2. **Suspense & Streaming Boundary**: Designed and exported `LoginFormSkeleton` matching form layout for zero-CLS streaming. Wrapped `<LoginForm />` inside `<Suspense fallback={<LoginFormSkeleton />}>` in `login/page.tsx` adhering to Vercel's App Router `useSearchParams()` guidance.
  3. **Server-to-Client Parameter Flow**: Passed server-resolved redirect parameters into `<LoginForm initialRedirect={rawRedirect} />`, avoiding client search parameter parsing delays.
  4. **Zero-Magic Invariants (REFAC-01)**: Extracted `GLOW_CYCLE_DURATION_SEC = 10` in `RefractionGlow.tsx`.
  5. **Test Parity**: Expanded unit tests to 14 passing tests, verifying `LoginFormSkeleton` rendering and `initialRedirect` prop priority.
- **Handoff**: Zero regressions, all tests passing cleanly.
