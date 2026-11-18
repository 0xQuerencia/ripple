# Private Ripple lab on sramc

This is a **single-owner pilot** for the local simulation engine, not public multi-user hosting. Keep `ripple.querencia.art` on Vercel while the private lab is tested.

The Cloudflare DNS zone currently points `ripple.querencia.art` at Vercel. The existing healthy `sramc` Tunnel is **locally managed** and its ingress serves other projects. Do not replace its configuration, and do not move the public DNS entry during setup.

## 1. Check the server without changing anything

From your own machine:

```sh
ssh -p 2224 ricky@sramc.mangomans.com
docker compose version
docker ps --format 'table {{.Names}}\t{{.Ports}}'
ss -ltn | grep -E ':(80|18787)\\b' || true
cloudflared --version || true
```

Identify how `cloudflared` runs (service, container or something else), and where its local config is located. Do not restart or replace a shared proxy until you know what other sites depend on it. If port 18787 is occupied, change the **host-side** binding in `docker-compose.private.yml` and the matching Tunnel service address.

This app uses a Node 22 container with a writable, Docker-managed SQLite volume. It never requires modifying other sites on port 80.

## 2. Enable and configure Cloudflare Access

The account must first enable Zero Trust / Access in the Cloudflare dashboard. Create a **Self-hosted** Access application for:

`lab.ripple.querencia.art`

Use a restrictive **Allow** policy listing only your own login email. Do **not** use a Bypass policy. Record the Zero Trust team name and the application's AUD tag from the dashboard.

Access is not a database multi-tenant identity system; this deployment deliberately permits only one owner. Different users will otherwise share the same hardcoded `local` project namespace.

## 3. Build the private service

Clone or update the repository on the server in a **new directory**, not inside an existing project's files:

```sh
git clone https://github.com/0xQuerencia/ripple.git ~/ripple-lab
cd ~/ripple-lab
cp .env.private.example .env.private
chmod 600 .env.private
${EDITOR:-nano} .env.private
```

Fill all four `RIPPLE_...` values. Use your exact Access organization team name, application AUD and permitted email. `GEMINI_API_KEY` is optional; the simulation uses local rule-based agents.

```sh
docker compose -f docker-compose.private.yml up -d --build
docker compose -f docker-compose.private.yml ps
curl -fsS http://127.0.0.1:18787/api/status
```

The service binds **only** `127.0.0.1:18787`. Its project APIs reject requests without a valid signed Cloudflare Access assertion. The database is stored in a persistent Docker volume, not `:memory:`. Health status does not expose private records.

## 4. Update only the relevant Tunnel ingress

In the **existing** locally managed `cloudflared` config, add the following rule **before the final 404 fallback**. Keep the existing `track`, `gst`, `draw` and any other rules unchanged.

```yaml
  - hostname: lab.ripple.querencia.art
    service: http://127.0.0.1:18787
    originRequest:
      access:
        required: true
        teamName: YOUR_ZERO_TRUST_TEAM
        audTag:
          - YOUR_ACCESS_APP_AUDIENCE
```

Replace placeholders with the actual settings. **Do not** override `httpHostHeader`: Ripple verifies that requests were addressed to the private lab hostname. Access token validation happens at **both** the Tunnel connector and the Ripple API.

Before reloading the shared Tunnel:

```sh
cloudflared tunnel ingress validate
cloudflared tunnel ingress rule https://lab.ripple.querencia.art
```

Use the appropriate `--config` path if the service does not use the default config location. Reload the existing service using the method actually installed on that server. The correct service command depends on your friend's setup; an unreviewed restart could interrupt other sites.

## 5. Add DNS only when the origin is healthy

In the Cloudflare zone `querencia.art`, create a **proxied CNAME**:

- Name: `lab.ripple`
- Target: `98bfc847-e7d0-4c74-9619-8e131bd4d2d6.cfargotunnel.com`

Leave the **existing** `ripple` CNAME pointing at Vercel.

Visit `https://lab.ripple.querencia.art`. Verify that Access login is required, your permitted email can log in, and Projects, Simulation, saved jobs, reports and evidence all work. Unauthorized requests must fail. Test a restart to confirm saved records survive.

## Backups and rollback

Docker Compose creates a named volume, typically `ripple-lab_ripple_private_data`. Do not use `down -v` or prune volumes. For a consistent offline backup, stop the service first and archive the volume, then restart. Store backups outside the server and test restore before upgrading.

To roll back the hostname, remove only the new lab ingress rule and lab CNAME. Do not alter the shared Tunnel ID, its existing rules, or the public Vercel DNS entry.

## Limits

This is **not** an open signup product. Production multi-user hosting requires per-user IDs, authentication/authorization throughout storage, migration discipline, abuse controls, documented backup recovery, and validated simulation outcomes. Until those exist, keep the experimental lab behind a single-owner Access policy.
