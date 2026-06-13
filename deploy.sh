#!/bin/bash
# EduExpress CRM — push to Railway (commit already prepared)
cd "$(dirname "$0")"

# Remove the stale lock file left by the sandbox
rm -f .git/index.lock

echo "🚀 Pushing commit 217b854 to origin/main..."
git push origin main

echo ""
echo "✅ Pushed! Railway is building now."
echo "   Watch: https://railway.app/dashboard"
echo "   Live:  https://crm.eduexpressint.com"
