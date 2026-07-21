# EduExpress CRM — Deploy to Hostinger VPS (Docker + Traefik)

Live URL after deploy: **https://crm.eduexpressint.com**

VPS: `srv1774770.hstgr.cloud` · IP `147.93.107.210` · Ubuntu 24.04 (Docker + Traefik)

DNS is already pointed: `crm.eduexpressint.com` → `147.93.107.210` (A record).
Traefik on this VPS auto-issues the SSL certificate via Let's Encrypt once the
container is running and DNS has propagated.

---

## One-time deploy

SSH into the VPS (from your Mac terminal):

```bash
ssh root@147.93.107.210
```

Then run:

```bash
# 1. Get the code (you'll be asked for your GitHub username + a token/password)
mkdir -p /docker && cd /docker
git clone https://github.com/rakibnuist/eduexpress-crm.git crm
cd crm

# 2. Create the environment file with your reset secret
cp .env.example .env
nano .env          # (optional) change RESET_KEY to your own long random string

# 3. Build and start (Traefik picks it up automatically)
docker compose up -d --build

# 4. Watch it start / get the SSL cert
docker compose logs -f
```

When logs show `Database ready ✅`, open **https://crm.eduexpressint.com**.
The first certificate can take 30–60 seconds.

---

## First login

The database starts empty. Create the admin once:

```
https://crm.eduexpressint.com/api/auth/emergency-reset?key=YOUR_RESET_KEY
```

Use the `RESET_KEY` from your `.env`. It returns a random password for
`admin@eduexpressint.com`. Log in, then change it in Settings.

---

## Connect WhatsApp

Settings → Integrations → **WhatsApp — Scan & Connect** → Generate QR Code →
scan from WhatsApp Business (⋮ → Linked devices → Link a device).
The session persists on the `crm-data` volume (survives restarts/redeploys).

---

## Updating later (new code)

```bash
cd /docker/crm
git pull
docker compose up -d --build
```

Your data is safe — `crm.db`, the WhatsApp session, and uploads live on Docker
volumes (`crm-data`, `crm-uploads`), not inside the image.

---

## Useful commands

```bash
docker compose ps                 # status
docker compose logs -f crm        # live logs
docker compose restart crm        # restart
docker compose down               # stop (keeps volumes/data)
docker volume ls | grep crm       # see data volumes
```

## Notes
- Port 3000 is internal only; Traefik terminates HTTPS on 443 and proxies to it.
- `RESET_KEY` empty ⇒ the emergency-reset endpoint is disabled (404).
- To move the old Railway data here, copy your `crm.db` into the `crm-data`
  volume before first start (ask and I'll give exact steps).
