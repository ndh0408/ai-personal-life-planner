# Cloudflare Tunnel — public API access

The LifeOS AI API is served from the home dev box (`huy-server`, no public IPv4).
A Cloudflare Tunnel (`cloudflared`) brings it onto the public internet at:

| Hostname                     | Origin                  | Purpose                       |
| ---------------------------- | ----------------------- | ----------------------------- |
| `api.tothanhthuy.cloud`      | `http://localhost:3000` | LifeOS AI API (this project)  |
| `admin.phogamechill.cloud`   | `http://localhost:8080` | Palworld admin (separate svc) |

Both are routed by a **single tunnel** so we only run one `cloudflared` daemon.

- Tunnel ID: `fb6e3a5e-de7e-4fbd-9bf2-861e5b7bc38f`
- Cloudflare account email: `huy04082000@gmail.com`
- Zone for the API: `tothanhthuy.cloud` (zone id `164fe3a1132109d49aa8030ec767809e`)
- The tunnel terminates HTTPS at Cloudflare's edge, so mobile clients only
  ever talk to `https://api.tothanhthuy.cloud` — no certificate management on
  our side.

## Files

- `/etc/cloudflared/config.yml` — ingress rules (root-owned).
- `/etc/cloudflared/palworld-admin.json` — tunnel credentials (root-owned, do
  not commit, do not copy off the box).
- Systemd unit: `cloudflared.service` (`active`, `enabled`).

## Current ingress

```yaml
tunnel: fb6e3a5e-de7e-4fbd-9bf2-861e5b7bc38f
credentials-file: /etc/cloudflared/palworld-admin.json

ingress:
  - hostname: admin.phogamechill.cloud
    service: http://localhost:8080
  - hostname: api.tothanhthuy.cloud
    service: http://localhost:3000
    originRequest:
      noTLSVerify: false
      connectTimeout: 30s
  - service: http_status:404
```

## Operating

```bash
# Validate config before reloading — catches typos.
sudo cloudflared --config /etc/cloudflared/config.yml tunnel ingress validate

# cloudflared.service does not implement reload — must restart.
sudo systemctl restart cloudflared

# Live status + recent logs.
sudo systemctl status cloudflared
sudo journalctl -u cloudflared -n 50 --no-pager

# Confirm a hostname is routed correctly. http_code:
#   200/whatever from the API → end-to-end healthy
#   502                       → tunnel reached, but origin (e.g. :3000) isn't listening
#   1033                      → DNS exists but no tunnel is connected
curl -sS -o /dev/null -w "%{http_code}\n" https://api.tothanhthuy.cloud/api/health
```

If you see **502**, the tunnel is fine — the API just isn't running. Start it
with `npm run dev:api` (or whatever production process manager you use).

## Adding a new hostname

1. Add a CNAME in Cloudflare DNS:
   `<sub>` → `fb6e3a5e-de7e-4fbd-9bf2-861e5b7bc38f.cfargotunnel.com`, **Proxied
   = ON**, TTL = Auto.
   - Via dashboard, or via API:
     ```bash
     curl -X POST "https://api.cloudflare.com/client/v4/zones/<ZONE_ID>/dns_records" \
       -H "X-Auth-Email: $CF_EMAIL" \
       -H "X-Auth-Key: $CF_KEY" \
       -H "Content-Type: application/json" \
       --data '{"type":"CNAME","name":"<sub>","content":"fb6e3a5e-de7e-4fbd-9bf2-861e5b7bc38f.cfargotunnel.com","ttl":1,"proxied":true}'
     ```
2. Add an `ingress` block (above the catch-all `http_status:404`) in
   `/etc/cloudflared/config.yml`.
3. `sudo cloudflared ... tunnel ingress validate`, then
   `sudo systemctl restart cloudflared`.

## Mobile app wiring

The Expo mobile app reads `EXPO_PUBLIC_API_BASE_URL` from env at build time
([apps/mobile/app.config.ts](../apps/mobile/app.config.ts)). For
production/staging builds the value is now:

```
EXPO_PUBLIC_API_BASE_URL=https://api.tothanhthuy.cloud/api
```

See:
- [apps/mobile/.env.production.example](../apps/mobile/.env.production.example)
- [apps/mobile/.env.staging.example](../apps/mobile/.env.staging.example)

`app.config.ts` enforces HTTPS-only and refuses localhost in production —
the tunnel hostname satisfies both.

## Security notes

- **Never commit** `/etc/cloudflared/palworld-admin.json` — it grants control
  over this tunnel.
- **Never store the Cloudflare Global API Key in the repo.** If you must
  automate against the Cloudflare API, mint a **scoped API Token** (Zone:DNS
  edit + Account:Cloudflare Tunnel edit only) instead of the Global key, and
  put it in a secret manager — not in `.env*` files inside the repo.
- Recommend enabling 2FA on the Cloudflare account.
- Cloudflare's edge sees all traffic to/from the API. That is acceptable
  for this project (tunnel terminates at Cloudflare → forwards to origin
  over an outbound QUIC connection from the box), but be aware of it for
  any future PII / health-data routing decisions documented in
  [docs/PRIVACY_COMMUNICATION_DATA.md](PRIVACY_COMMUNICATION_DATA.md).
