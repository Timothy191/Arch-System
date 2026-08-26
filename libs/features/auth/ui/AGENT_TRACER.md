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
