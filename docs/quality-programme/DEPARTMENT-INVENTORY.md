# Arch-System Department Inventory

## Major Departments

The application features several key operational departments under `apps/portal/app/(departments)/`:

- **access-control**
- **control-room**
- **database**
- **drilling**
- **engineering**
- **office**
- **[department]** (A dynamic route likely handling specific generic department sub-routes such as dashboards, shift-compilation, reports, and daily-logs).

## Shared Routes

Other significant routes in `apps/portal/app/` include:

- `(auth)`: Authentication workflows.
- `admin`: Administrative features.
- `hub`: The central hub layout.
- `overview`: Architectural overview.
- `offline`: Offline fallback support.
- `privacy` and `profile`.
