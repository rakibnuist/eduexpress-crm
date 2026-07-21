# 🚀 EduExpress CRM — Railway Deployment Guide

## Quick Deploy (One-Time Setup)

### Step 1: Connect Railway to GitHub
1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click **New Project** → **Deploy from GitHub repo**
3. Select `rakibnuist/eduexpress-crm`
4. Railway will auto-detect `nixpacks.toml` and build

### Step 2: Set Environment Variables
In Railway Dashboard → Project → Variables, add:

```env
NODE_ENV=production
PORT=3000
# Database auto-created by Railway, no need for DB_PATH

# Meta / Facebook
FB_PAGE_ACCESS_TOKEN=your_long_lived_page_token_here
FB_PAGE_CHINA_ID=your_china_page_id
FB_PAGE_BD_ID=your_bd_page_id

# n8n (your n8n instance URL)
N8N_PUBLISH_WEBHOOK=https://vibeacademy.cloud/webhook/eduexpress-publish

# Internal key (keep secret, n8n uses this)
INTERNAL_API_KEY=eduexpress-n8n-2024

# Emergency admin-reset key (REQUIRED for /api/auth/emergency-reset to work).
# Without it the reset endpoint is disabled (returns 404). Use a long random string.
RESET_KEY=change-me-to-a-long-random-secret
```

### Emergency admin password reset
If you're locked out, visit (with your RESET_KEY):

```
https://crm.eduexpressint.com/api/auth/emergency-reset?key=YOUR_RESET_KEY
```

It returns a new random password for `admin@eduexpressint.com`. Log in, then
change it in Settings. Optionally set your own: `&password=YourNewPass123`.
If `RESET_KEY` is not configured, the endpoint stays disabled for security.

### Step 3: Add Custom Domain
Railway Dashboard → Settings → Domains → Add `crm.eduexpressint.com`

Update your DNS A record to point to Railway's provided IP.

### Step 4: Verify Deploy
```bash
curl https://crm.eduexpressint.com/api/auth/me
curl -H "x-api-key: eduexpress-n8n-2024" https://crm.eduexpressint.com/api/marketing/publish/n8n-config
```

---

## GitHub Actions Auto-Deploy (Optional)

### 1. Get Railway Token
Railway Dashboard → Account → Tokens → Generate Token

### 2. Add to GitHub Secrets
GitHub Repo → Settings → Secrets and variables → Actions → New repository secret
- Name: `RAILWAY_TOKEN`
- Value: paste the token from Railway

### 3. Push to main triggers deploy
Every push to `main` will auto-deploy via `.github/workflows/railway-deploy.yml`

---

## Files Added for Deployment

| File | Purpose |
|------|---------|
| `Dockerfile` | Container build (fallback if Nixpacks fails) |
| `nixpacks.toml` | Railway-native build + start config |
| `.github/workflows/railway-deploy.yml` | GitHub Actions auto-deploy |
| `DEPLOY.md` | This guide |

---

## Troubleshooting

### "No such column" errors after deploy
Railway uses a fresh SQLite file. Run the seed script once:
```bash
railway run -- node seed_social_engine.js
```

### Webhook not receiving events
1. Check Meta Developer Console → Webhooks → callback URL is `https://crm.eduexpressint.com/webhook/meta`
2. Verify token matches: `eduexpress_verify_2024`
3. Ensure Page is subscribed to the app

### Build fails
Check Railway logs. Common issues:
- Missing `npm run build` step (fixed by `nixpacks.toml`)
- `vite` not found (needs `npm ci` before `npm run build`)
