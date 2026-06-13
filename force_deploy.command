#!/bin/bash
cd "$(dirname "$0")"
rm -f .git/index.lock .git/HEAD.lock
echo "Committing latest changes..."
git add server.js src/pages/Conversations.jsx
git commit -m "fix: stable JWT_SECRET via DB_PATH hash; bust media cache with ?v=2" 2>/dev/null || echo "(nothing new to commit)"
echo ""
echo "Force pushing to Railway..."
git push --force origin main
echo ""
echo "Done! Check https://railway.app/dashboard"
read -p "Press Enter to close..."
