#!/bin/bash
mv crm.db crm.db.bak

node server.js > fresh_server.log 2>&1 &
SERVER_PID=$!
sleep 4

curl -s -X POST http://localhost:3001/api/leads \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "ssss",
    "phone": "01987654322"
  }' -w "\nHTTP_STATUS: %{http_code}\n" > fresh_curl.log

kill $SERVER_PID
mv crm.db.bak crm.db
cat fresh_curl.log
grep "exec stmt failed" fresh_server.log
