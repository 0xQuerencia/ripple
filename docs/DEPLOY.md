# Deploying Ripple

Ripple is one small Node container with no database and nothing to back up. These steps put it behind HTTPS on a server you control, for example at `ripple.example.com`.

## What you need

- A Linux server with Docker and the Compose plugin.
- A domain name you can add a DNS record to.
- A Gemini API key from https://aistudio.google.com/apikey. **Make a separate key for the server**, and never reuse one that has been pasted into a chat or a ticket.
- If the repository is private, a way for the server to read it (a deploy key, or a token), or copy the files across.

## 1. Point the domain at the server

Add a DNS record for the hostname:

- **Server has a public address:** an `A` (and `AAAA`) record to it. Forward ports 80 and 443 to the machine on your router.
- **No public address, or you would rather not open ports:** use a Cloudflare Tunnel (or similar) from the hostname to `http://localhost:8787`, and skip the reverse proxy below.

## 2. Get the code and set it up

```sh
git clone <your repo url> ripple && cd ripple
cp .env.example .env
nano .env          # set GEMINI_API_KEY, and TRUSTED_PROXY_HOPS (see step 4)
chmod 600 .env     # only your user can read the key
```

## 3. Start it

```sh
docker compose up -d --build
docker compose ps                       # should say "healthy" after a few seconds
curl -s http://127.0.0.1:8787/api/status   # {"ai":true,"model":"gemma-4-26b-a4b-it"}
```

The container runs as a non-root user with a read-only filesystem, and is published on `127.0.0.1:8787` only, so nothing outside the machine can reach it except through your proxy.

## 4. Put HTTPS in front

Ripple streams its answer, so the proxy **must not buffer responses**, and must allow a ripple to take up to two minutes.

**Caddy** (gets certificates by itself):

```
ripple.example.com {
    reverse_proxy 127.0.0.1:8787 {
        flush_interval -1
        transport http {
            response_header_timeout 150s
        }
    }
}
```

**nginx**:

```
location / {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_buffering off;
    proxy_read_timeout 150s;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

Now set `TRUSTED_PROXY_HOPS` in `.env` to the number of proxies between the internet and the container, then `docker compose up -d`:

| In front of Ripple | `TRUSTED_PROXY_HOPS` |
|---|---|
| Nothing (not recommended) | `0` |
| Caddy or nginx on the same machine | `1` |
| Cloudflare (orange cloud) in front of Caddy or nginx | `2` |
| Cloudflare Tunnel straight to the container | `1` |

This number decides who counts as "one visitor" for the rate limit. Too low and everyone shares one limit; too high and a visitor can dodge it by faking a header.

## 5. Check it works

1. Open the site, type a question, press Enter.
2. The "Gemma is thinking" panel should tick up and the effects should appear **one at a time**. If they all appear at once at the end, something is buffering: re-check step 4.
3. The top-left badge should say "gemma 4 is live". If it says "offline demo", the key is missing or wrong: `docker compose logs ripple`.

## Settings

All optional, all in `.env`:

| Variable | Default | What it does |
|---|---|---|
| `GEMINI_API_KEY` | none | Without it, only the offline demo works |
| `GEMMA_MODEL` | `gemma-4-26b-a4b-it` | `gemma-4-31b-it` is larger and slower |
| `TRUSTED_PROXY_HOPS` | `0` | See step 4 |
| `RATE_LIMIT_PER_MINUTE` | `12` | Questions per visitor per minute |
| `GLOBAL_LIMIT_PER_HOUR` | `300` | Gemma calls across everyone per hour; past it, the offline demo answers |
| `PORT`, `HOST` | `8787`, `0.0.0.0` | Where the server listens inside the container |

## Updating, logs, and stopping

```sh
git pull && docker compose up -d --build   # update
docker compose logs -f ripple              # watch it
docker compose down                        # stop it
```

## If something is off

- **Everyone gets "slow down" after a few questions:** `TRUSTED_PROXY_HOPS` is too low, so all visitors look like one.
- **The map appears all at once:** the proxy is buffering. Add `flush_interval -1` (Caddy) or `proxy_buffering off` (nginx).
- **"Gemma did not answer this time":** Google's API returned errors three times. Check `docker compose logs ripple` for the status code. A 400/401/403 means the key or model name is wrong.
- **A ripple stops after about a minute:** a proxy or tunnel read timeout is shorter than a ripple. Raise it.
