# React 19 Patterns

## 1. Use `use()` in client components

- Source: <https://react.dev/reference/react/use>
- Rule: Unwrap promises/context with `use()` inside `<Suspense>` instead of `useEffect` + state.

## 2. `useActionState` for form state

- Source: <https://react.dev/reference/react/useActionState>
- Rule: Use `useActionState(action, initialState)` paired with `useFormStatus` in submit buttons.

## 3. `useOptimistic` for instant UI feedback

- Source: <https://react.dev/reference/react/useOptimistic>
- Rule: Use `useOptimistic` for mutations >100ms; reconcile on server response with rollback.

## 4. `ref` as a prop (no `forwardRef`)

- Source: <https://react.dev/blog/2024/12/05/react-19>
- Rule: Pass `ref` as a regular prop (`React.Ref<HTMLElement>`); omit `forwardRef`.

## 5. Suspense streaming

- Source: <https://react.dev/reference/react/Suspense>
- Rule: Wrap slow Server Component subtrees in `<Suspense fallback={...}>` and stream.
