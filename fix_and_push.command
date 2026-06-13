#!/bin/bash
cd "$(dirname "$0")"

# Remove any stale git lock files
find .git -name "*.lock" -delete 2>/dev/null

# Stage the changed files
git add src/pages/Settings.jsx src/api.js server.js \
        src/pages/Dashboard.jsx src/pages/Reports.jsx \
        src/pages/Cockpit.jsx src/pages/MyDay.jsx

# Commit if there are staged changes
if git diff --cached --quiet; then
  echo "Nothing new to commit — just pushing."
else
  git commit -m "Fix CAPI (action_source + SHA-256 PII hashing); dashboard server-side aggregations; redesign Dashboard, Reports, Cockpit, Daily Workspace; fix MyDay Tailwind typos"
fi

# Push to origin
git push

echo ""
echo "Done! Press any key to close."
read -n 1
