# Debugging

## 1. VS Code launch configuration

- Source: <https://nextjs.org/docs/app/guides/debugging>
- Rule: `.vscode/launch.json` at the repo root provides server-side (`node-terminal`, `pnpm dev --inspect`), client-side (`chrome`/`firefox` on `http://localhost:3000`), and full-stack (`node` with `--inspect` + `serverReadyAction`) configurations. The portal runs from `apps/portal`, so `cwd` targets that directory.

## 2. Server-side debugging with `--inspect`

- Source: <https://nextjs.org/docs/app/guides/debugging>
- Rule: Start the dev server with `pnpm dev --inspect` (portal) and attach via `chrome://inspect` / Firefox Remote Targets. Use `NODE_OPTIONS=--inspect-brk` to break on start; `--inspect=0.0.0.0` only for containerized remote access.

## 3. Client-side debugging with Browser DevTools + React Developer Tools

- Source: <https://nextjs.org/docs/app/guides/debugging>
- Rule: Client breakpoints live in the browser Sources/Debugger tab (source paths prefixed `webpack://_N_E/./`). The React Developer Tools extension is installed for component inspection, props/state editing, and the Suspense panel.

## 4. Prerender errors use `--debug-prerender`

- Source: <https://nextjs.org/docs/app/guides/debugging>
- Rule: `next build --debug-prerender` enables server source maps and continues checking other routes when a route fails prerendering, so CI does not stop at the first blocking route.
