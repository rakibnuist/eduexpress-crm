#!/bin/bash
cd ~/Desktop/webApp/crm-webapp
rm -f .git/index.lock
echo "Pushing to Railway..."
git push origin main
echo ""
echo "Done! Check https://railway.app/dashboard for build progress."
read -p "Press Enter to close..."
