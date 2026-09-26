# FUXA Connection Import Templates

Importable FUXA device/connection JSON files for the Arch-System SCADA
reverse-flow integration.

## `fuxa-portal-connection.json`

A single **WebAPI** device that pulls live telemetry from the portal's
`/api/scada/tags` endpoint (Redis-backed system of record).

| Field               | Value                                  | Notes                                                                                                                                                                                                                                     |
| ------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`              | `Portal`                               | Display name in FUXA Connections.                                                                                                                                                                                                         |
| `type`              | `WebAPI`                               | FUXA pulls tags via HTTP GET.                                                                                                                                                                                                             |
| `polling`           | `1000`                                 | Poll interval in ms (1s).                                                                                                                                                                                                                 |
| `property.getTags`  | `http://127.0.0.1:3000/api/scada/tags` | **Explicit IPv4** — FUXA's node resolves `localhost` to IPv6 `::1`, but the portal (`next dev --hostname 0.0.0.0`) is IPv4-only, so `localhost` gives `ECONNREFUSED`. FUXA runs with `network_mode: host` so it shares the host loopback. |
| `property.postTags` | `""`                                   | Empty — reverse-flow is read-only (portal → FUXA pull); we don't write back.                                                                                                                                                              |
| `tags`              | `{}`                                   | Empty by design — populated by **Load Tags** after import.                                                                                                                                                                                |

## How to import

1. Open the FUXA editor: <http://localhost:1881/editor/> (or
   <http://localhost:1881/device> → Connections).
2. Go to **Connections** → **Import** (the import control accepts a JSON file).
3. Select `templates/fuxa-portal-connection.json`.
4. The **Portal** WebAPI device appears in Connections.
5. Select it → click **Load Tags**. FUXA `GET`s
   `http://127.0.0.1:3000/api/scada/tags` and populates the tag list from the
   portal's Redis cache (e.g. `drill_DR-101_engine_rpm`, `engine_temp`, …).
6. Create a view → add gauges → bind each gauge to a tag → save.
7. The runtime at <http://localhost:1881/> then shows your live dashboard,
   refreshing every 1s.

## Import format (verified from FUXA v1.3.4 source)

The file is a **JSON array of device objects** (FUXA's `importDevices` does
`arr.forEach(d => d.id && d.name && setDevice(d))`). Each device uses the
project device model `{id, name, type, enabled, polling, property, tags}`. A
WebAPI device is identified by `type === "WebAPI"` and requires
`property.getTags` (FUXA's `isWebApiProperty` check).

## Regenerating the device id

The `id` is a random UUID. To generate a fresh one (e.g. to avoid a collision
when re-importing):

```bash
node -e "console.log(require('crypto').randomUUID())"
```
