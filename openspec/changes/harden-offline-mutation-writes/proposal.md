# Harden Offline Mutation Writes

## Why

The offline mutation endpoint currently writes through a `SECURITY DEFINER`
RPC without authenticating the HTTP caller or deriving the tenant from the
authenticated employee. The RPC trusts its tenant argument, uses unqualified
table names with an empty `search_path`, and retains default execution grants.
These gaps could permit unauthorized or cross-department SMR writes and prevent
the RPC from resolving its target tables.

## What Changes

- Define and export a canonical, bounded request contract for offline SMR
  mutation batches.
- Require an authenticated employee at the portal endpoint, reject viewers
  and employees without a department, and derive the tenant from the employee
  record rather than accepting it from the request.
- Harden the database RPC with independent caller/department authorization,
  bounded and validated batches, schema-qualified object names, and explicit
  function execution grants.
- Add regression coverage for authentication, tenant authorization, payload
  bounds, duplicate replay, and function ACL/RPC invariants.
- Preserve the existing request shape (`clientHlc`, `mutations`) and the
  shift-closeout caller contract.

## Out of Scope

- Applying migrations to the connected/cloud Supabase database.
- Deploying the portal to Vercel.
- Changing the existing migration 165 deletion or changing migration 171.
- Reworking offline synchronization semantics beyond the authorization and
  validation boundary.

## Compatibility

Existing clients keep the same JSON shape. The tenant is now always the
authenticated employee's primary department. Requests without an authenticated
employee and non-empty department are rejected.
