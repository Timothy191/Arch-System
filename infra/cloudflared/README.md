# Cloudflare Tunnel Setup for On-Prem FUXA SCADA

This directory contains the production Cloudflare Tunnel (`cloudflared`) configuration bridging the on-site SCADA controller hardware to the Plantcor Mining Operations Portal (`NEXT_PUBLIC_FUXA_URL`).

## Architecture

```
[ Field Machines / SCADA Controllers ]
                 │ (OPC-UA / Modbus)
                 ▼
     [ FUXA SCADA Server :8088 ]
                 │ (Local Network HTTP/WS)
                 ▼
        [ cloudflared daemon ]
                 │ (Outbound Encrypted Tunnel)
                 ▼
       [ Cloudflare Edge CDN ] ────► [ Arch-Systems Portal (apps/portal) ]
```

## Running the Tunnel

```bash
# Validate configuration
cloudflared tunnel ingress validate --config infra/cloudflared/fuxa-tunnel.yml

# Run locally or on mine-site gateway
cloudflared tunnel --config infra/cloudflared/fuxa-tunnel.yml run
```
