#!/bin/bash
cd "$(dirname "$0")"

# Remove stale git lock files
rm -f .git/HEAD.lock .git/index.lock

# Stage the changed files
git add server.js src/pages/Conversations.jsx src/pages/Finance.jsx src/pages/HR.jsx

# Commit
git commit -m "fix: Messenger history sync returning 0 messages

- Add platform=messenger filter to conversations API URL (required for correct FB response)
- Add fallback: use meta_config page_access_token if channel-level token is empty
- Add pageId null guard with error logging (prevents silent empty-data call to FB API)
- Add detailed FB API error logging (code, subcode, message) for easier debugging
- Fix sync endpoint guard to use effective token (channel token OR global fallback)
- Previous commits: payroll whitelist, KPI fix, CAPI token, investors modal, professional chat UI"

# Push
git push origin main

echo ""
echo "✅ Done! Press any key to close."
read -n 1
