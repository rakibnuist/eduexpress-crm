# 🎓 EduExpress Core

> **EduExpress Core** is a high-performance, unified **Consultancy Operations ERP (Enterprise Resource Planning)** and **Client Lifecycle Management Suite** engineered specifically for international student consultancy recruitment. 

It serves as the central nervous system for **EduExpress International**, unifying prospective student pipelines, university applications, employee attendance (SSID + geofencing), cashflow ledger, payroll, and a public-facing student portal in a single, high-fidelity operations control center.

---

## 🚀 Key Modules & Capabilities

### 1. 💼 Leads & Pipeline Management
* **Unified Sales Board:** Seamlessly toggles between a data-dense search table and a responsive **Kanban Board** (pipeline).
* **Frictionless Transitions:** Single-click color-coded status dropdowns allow consultants to change lead stages in under **0.5 seconds** (removing the drag-and-drop friction on mobile/tablets).
* **Click-to-WhatsApp Integration:** All phone displays are live-shortlinked (with green status beacons). Clicking a phone number instantly opens a sanitized WhatsApp web/app conversation thread in a new tab.

### 2. ⚡ Automated Messaging & Lead Ad Capture (Webhooks)
* **Passive Lead Ingestion:** Any prospective client initiating a chat on **WhatsApp Business Cloud API**, **Facebook Messenger**, or **Instagram DM** automatically triggers a backend conversion engine that registers them as a **"New Lead"**, captures their name/profile, and saves their first inquiry in their notes.
* **Meta Lead Ads Integration:** Listen for the `leadgen` Meta Webhook to automatically fetch new leads from active Facebook/Instagram campaigns, populate forms, and push updates in real-time.

### 3. 📂 Application & Documentation Hub
* **Unified Stage Tracker:** Track admission checklists across major institutions (such as VCS, NJTech, SUES, and SXU).
* **Google Drive Link Submissions:** Supports seamless, direct link storage for student transcripts, recommendations, and portfolios.
* **Instant Admission Flags:** Color-coded status updates and admission badges dynamically highlight enrolled or returned applications.

### 4. 🛜 Automated Wi-Fi Geofence Attendance
* **Auto Check-in:** Commits employee check-ins automatically when they log in from the office Wi-Fi network (SSID match) inside the designated geofence coordinates.
* **Manual Overrides:** Elegant manual override check-in/out options with geofence distance-tolerance warnings.
* **Workspace Logs:** Features a workspace panel for employees to log their daily goals, accomplishments, and metrics.

### 5. 💰 Finance Ledger & Payroll Controls
* **Ledger Control:** Integrated income and expense ledgers featuring real-time Net Cash balance metrics.
* **PnL Analytics:** Dynamic Profit and Loss monthly summaries and cash flow visualizations (charts powered by Recharts).
* **Payroll Automation:** Generates automated monthly payroll calculations mapping to active check-ins, late deductions, and bonuses.

### 6. 🎓 Student Status Portal
* **Delivery-Style Status Tracker:** Publicly accessible, secure status portal (e.g. `/s/<unique-token>`) where students can track application stages.
* **Direct Uploads:** Enables students to upload missing documents directly by sharing Google Drive links.
* **Support Thread:** Live, staff-to-student text threads.

---

## 🛠️ Technology Stack
* **Client Frontend:** React 19, Vite, TailwindCSS (for sleek, responsive styling), Lucide-React (icons), Recharts (data visualizations).
* **Backend Engine:** Node.js, Express, Better-SQLite3 (database), Server-Sent Events (SSE for instant client synchronization).

---

## ⚙️ Meta & Webhook Setup

To start receiving lead campaigns and chat inquiries automatically:

1. **Callback URL:**
   `https://crm.eduexpressint.com/webhook/meta`
2. **Verify Token:**
   `eduexpress_verify_2024`
3. **Webhook Subscriptions:**
   * **Page Webhook:** Subscribe to the `messages` and `leadgen` fields (for Messenger and Lead Ads).
   * **WhatsApp Account Webhook:** Subscribe to the `messages` field (for WhatsApp).

All credentials, access tokens, and sync history controls are managed directly via the **Meta Integration Channels** panel in **Settings**.

---

## 📦 Local Installation & Setup

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/rakibnuist/eduexpress-crm.git
   cd eduexpress-crm
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Run in Development Mode:**
   ```bash
   npm run dev
   ```

4. **Start the Local Backend Server:**
   ```bash
   npm run server
   ```

5. **Run Concurrently (Frontend + Server):**
   ```bash
   npm run start
   ```

6. **Production Build Compilation:**
   ```bash
   npm run build
   ```

---
*Developed by the EduExpress Engineering Team. Premium operations management built for scale.*
