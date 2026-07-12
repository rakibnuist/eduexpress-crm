#!/bin/bash
node server.js &
SERVER_PID=$!
sleep 2

curl -X POST http://localhost:3001/api/leads \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "ssss",
    "phone": "01987654322",
    "email": "student@example.com",
    "nationality": "Bangladesh",
    "passport": "A12345678",
    "date_added": "12/07/2026",
    "destination": "pick",
    "intake_term": "September 2026",
    "degree": "pick",
    "major": "International Economy",
    "age": ""
  }' -w "\nHTTP_STATUS: %{http_code}\n"

kill $SERVER_PID
