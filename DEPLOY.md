# EduExpress CRM — Hostinger VPS deployment

Production URL: [crm.eduexpressint.com](https://crm.eduexpressint.com)

The application runs with Docker Compose behind the existing Traefik reverse
proxy on the Hostinger VPS. Traefik handles HTTPS and routes the production
domain to the CRM container.

## Data-safety rules

The Compose volumes `crm-data` and `crm-uploads` contain production data. Their
installed Docker names include the Compose project name. Code deployments must
preserve both volumes.

- Never run `docker compose down -v`.
- Never delete or recreate either named volume.
- Never replace `/data/crm.db` during a normal code deployment.
- Keep `RUN_DATA_BACKFILLS=false` unless a reviewed migration is intentional.
- Download and verify a current database backup before any restore operation.

Running `docker compose up -d --build` replaces only the application container
and image; it preserves the named volumes.

## First deployment

```bash
ssh root@srv1774770.hstgr.cloud
mkdir -p /docker
cd /docker
git clone https://github.com/rakibnuist/eduexpress-crm.git crm
cd crm
cp .env.example .env
chmod 600 .env
nano .env
docker compose config
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 crm
```

Fill every required secret in `.env` before starting the container. Generate
different long random values for `JWT_SECRET`, `RESET_KEY`,
`INTERNAL_API_KEY`, and `WEBSITE_WEBHOOK_SECRET`. Keep
`RUN_DATA_BACKFILLS=false`.

The deployment is ready when the container is healthy and the following returns
`"status":"ready"`:

```bash
curl --fail https://crm.eduexpressint.com/health
```

## Routine code deployment

```bash
ssh root@srv1774770.hstgr.cloud
cd /docker/crm
git pull --ff-only
docker compose config
docker compose up -d --build
docker compose ps
curl --fail https://crm.eduexpressint.com/health
```

This procedure does not import, overwrite, or delete CRM records.

## Operations

```bash
docker compose ps
docker compose logs --tail=200 crm
docker compose logs -f crm
docker compose restart crm
docker volume ls --filter label=com.docker.compose.project
```

Use `docker compose down` only when a full stop is necessary. It preserves data
as long as the `-v` option is not used.

## Emergency admin reset

The reset endpoint is disabled when `RESET_KEY` is blank. When required, send a
POST request using the secret stored on the VPS:

```bash
curl -X POST https://crm.eduexpressint.com/api/auth/emergency-reset \
  -H 'Content-Type: application/json' \
  -H 'x-reset-key: YOUR_RESET_KEY' \
  --data '{"password":"A-new-strong-password"}'
```

## Webhook checks

- Meta callback: `https://crm.eduexpressint.com/webhook/meta`
- The Meta app secret must match `META_APP_SECRET`.
- The verification token must match the CRM integration setting or
  `META_WEBHOOK_VERIFY_TOKEN`.
- Website lead requests must include the configured shared secret.

## Troubleshooting

If the health check fails, inspect `docker compose logs --tail=200 crm` and
confirm the environment file is present. If database initialization fails, stop
and investigate the existing volume—do not replace the database with an empty
file.
