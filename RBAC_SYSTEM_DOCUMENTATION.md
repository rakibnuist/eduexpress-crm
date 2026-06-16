# EduExpress CRM — Role-Based Access Control (RBAC) System

## Overview

The CRM now implements a **multi-role access control system** where one employee can hold **2-3 roles simultaneously**. Navigation, dashboards, and permissions are dynamically calculated based on the user's assigned roles.

---

## Roles & Hierarchy

| Role Key | Display Name | Access Level |
|----------|-------------|--------------|
| `founder_ceo` | Founder & CEO | Full access — everything |
| `managing_director` | Managing Director | Full access — everything |
| `investor` | Investor | Read-only executive access |
| `consultant` | Consultant | Own leads, own WhatsApp, all other channels |
| `application_manager` | Application Manager | Applications, all chats, reports |
| `marketing_manager` | Marketing Manager | Marketing, automation, all chats, reports |

### Role Combinations
One employee can have **2-3 roles**. Examples:
- `consultant` + `application_manager` → Can manage own leads + all applications
- `marketing_manager` + `consultant` → Can run marketing + handle own leads
- `founder_ceo` + `application_manager` → Full access + application focus

---

## Navigation Per Role

### Founder & CEO / Managing Director
- **Executive Dashboard** — Full KPI, pipeline, leaderboard, broadcasts
- **Executive Cockpit** — Live activity, alerts, 7-day trends
- **Reports & Analytics** — Weekly/monthly digests, printable PDFs
- **Daily Workspace** — End-of-day reflection logs
- **Leads & Pipeline** — All leads, full CRUD
- **Applications Hub** — China + Bangladesh, full management
- **Chat Inbox** — All conversations, all channels
- **Marketing Hub** — Content calendar, evergreen bank, competitor intel
- **Automation Hub** — Rules, templates, analytics
- **Finance** — Income, expenses, payroll, P&L
- **HR** — Attendance, employees, KPI targets
- **Settings** — Office config, broadcast campaigns, users

### Investor
- **Executive Dashboard** — Read-only KPIs and pipeline
- **Reports & Analytics** — Read-only reports
- **Daily Workspace** — Can log reflections
- **Leads & Pipeline** — View all (read-only)
- **Applications Hub** — View all (read-only)
- **Finance** — View financials (read-only)
- **Marketing, Automation, HR, Settings** — ❌ No access
- **Chat Inbox** — ❌ No access

### Consultant
- **My Dashboard** — Personal KPIs, own leads only, no leaderboard
- **Daily Workspace** — End-of-day reflection logs
- **My Leads** — Only leads assigned to them
- **Chat Inbox** — Own WhatsApp account + all other channels (Messenger, Instagram, TikTok)
- **Applications Hub** — View only (read-only)
- **Broadcasts** — Can view, cannot dismiss
- **Reports, Cockpit, Marketing, Automation, Finance, HR, Settings** — ❌ No access

### Application Manager
- **Application Dashboard** — Application-focused KPIs
- **Applications Hub** — Full management of all applications
- **Add Application (China)** — Can create China applications
- **Leads & Pipeline** — View all leads (read-only, for sourcing)
- **Chat Inbox** — All conversations (for application support)
- **Daily Workspace** — Can log reflections
- **Reports & Analytics** — Can view analytics
- **Marketing, Automation, Finance, HR, Settings** — ❌ No access

### Marketing Manager
- **Marketing Dashboard** — Marketing-focused KPIs
- **Marketing Hub** — Full content management
- **Automation Hub** — Rules, templates, analytics
- **Chat Inbox** — All conversations (for campaign responses)
- **Leads & Pipeline** — View all leads (read-only)
- **Daily Workspace** — Can log reflections
- **Reports & Analytics** — Can view analytics
- **Broadcasts** — Can send and view
- **Applications, Finance, HR, Settings** — ❌ No access

---

## Lead Flow Rules

### Chat Inbox → Bangladesh (Automatic)
When a lead is converted from any chat channel (WhatsApp, Messenger, Instagram, TikTok):
- **Destination** automatically set to `Bangladesh`
- **Source** automatically set to `In-House`
- The lead appears in the **Bangladesh** tab of the Applications Hub
- **No manual intervention required**

### China Applications (Manual Only)
- Only **Application Managers** and **Administrators** (Founder & CEO, Managing Director) can create China applications
- Consultants **cannot** convert a chat lead to China
- Consultants **cannot** change a Bangladesh lead's destination to China
- The **China** tab in Applications Hub shows an **"Add Application"** button only for authorized roles
- Backend enforces: `403 Forbidden` if unauthorized user attempts to create a China application

---

## Chat Inbox Access Rules

### Multi-Account Per Channel
- Each channel (WhatsApp, Messenger, Instagram, TikTok) can have **multiple accounts/users**
- The `channel_access` table maps users to channels with access types: `reply`, `view_only`, `admin`

### Consultant Chat Rules
| Channel Type | Access Rule |
|-------------|-------------|
| **WhatsApp** | Only their **own WhatsApp account** (matched by `consultant_name` or `channel_access` table) |
| **Messenger** | **All** conversations — full access |
| **Instagram** | **All** conversations — full access |
| **TikTok** | **All** conversations — full access |
| **Other** | **All** conversations — full access |

### Full Admin / App Manager / Marketing Manager
- **All channels**, **all conversations** — full access

### Investor
- **No chat access** — the inbox returns empty for investors

---

## Database Schema Changes

### New Tables

```sql
-- Multi-role support (one user → many roles)
CREATE TABLE user_roles (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  PRIMARY KEY (user_id, role)
);

-- Channel access per user (many-to-many)
CREATE TABLE channel_access (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_type TEXT DEFAULT 'reply', -- reply | view_only | admin
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(channel_id, user_id)
);
```

### Migration
- On startup, all legacy users are automatically migrated:
  - `admin` → `founder_ceo`
  - `manager` → `application_manager`
  - `consultant` → `consultant`

---

## Permission System (Frontend)

The `src/lib/roles.js` file defines all permissions and helpers:

```javascript
// Check if user has a specific permission
hasPermission(user, PERMISSIONS.VIEW_REPORTS)

// Check if user has any of multiple permissions
hasAnyPermission(user, PERMISSIONS.MANAGE_APPLICATIONS, PERMISSIONS.VIEW_APPLICATIONS)

// Check if user has full admin access
isFullAdmin(user)

// Check if user is an investor
isInvestor(user)

// Get navigation items for a user
getNavForUser(user)

// Get primary role label for display
getPrimaryRoleLabel(user)

// Can this user access a specific conversation?
canAccessConversation(user, conversation)

// Can this user add a China application?
canAddChinaApplication(user)
```

---

## API Changes

### Auth Endpoints
- `POST /api/auth/login` → Returns `{ ..., roles: ['founder_ceo'] }`
- `GET /api/auth/me` → Returns `{ ..., roles: ['founder_ceo'] }`
- JWT token includes `roles` array for stateless validation

### User Management (Admin only)
- `GET /api/users` → Returns all users with `roles` array attached
- `POST /api/users` → Accepts `roles` array (e.g., `["consultant", "application_manager"]`)
- `PUT /api/users/:id` → Accepts `roles` array to update multi-role assignment
- `DELETE /api/users/:id` → Also deletes associated `user_roles` records

### Role-Based Guards (Backend)
```javascript
isFullAdmin(user)           // Founder & CEO, Managing Director, or legacy admin
isInvestor(user)            // Investor role
canViewAllLeads(user)       // Admin, Investor, App Manager, Marketing Manager
canViewOwnLeadsOnly(user)   // Consultant only
canViewAllConversations(user) // Admin, App Manager, Marketing Manager
canManageApplications(user)   // Admin, App Manager
canManageMarketing(user)      // Admin, Marketing Manager
canViewFinance(user)          // Admin, Investor
canViewHR(user)               // Admin only
canViewSettings(user)         // Admin only
```

### Dashboard Endpoint
- `GET /api/dashboard` → Now filters KPIs by user role:
  - **Consultant**: Only their own lead counts, pipeline, and recent leads
  - **Admin/Investor/App Manager/Marketing Manager**: Full company-wide data

### KPI Endpoint
- `GET /api/kpi/:month` → Now filters by role:
  - **Consultant**: Only their own KPI data
  - **Others**: All consultants' KPI data

### Conversations Endpoints
- `GET /api/conversations` → Filters by role (WhatsApp scoped for consultants, all channels for managers)
- `GET /api/conversations/:id` → RBAC check via `userHasAccessToConversation`
- `POST /api/conversations/:id/messages` → RBAC check before sending
- `PUT /api/conversations/:id` → RBAC check before updating
- `DELETE /api/conversations/:id` → RBAC check before deleting

### Leads Endpoints
- `POST /api/leads` → Blocks unauthorized China applications
- `PUT /api/leads/:id` → Blocks unauthorized destination changes to China

---

## Security Enforcement

### Location-Based Login
- **Founder & CEO** and **Managing Director** are **exempt** from office Wi-Fi and geofence restrictions
- All other roles must be at the office or on office Wi-Fi to log in

### Data Scoping
- Consultants **cannot** see other consultants' leads, revenue, or client phone numbers (read-only display)
- Consultants **cannot** access the executive cockpit, reports, or leaderboard
- Investors **cannot** access chat conversations or modify any data
- Application Managers **cannot** access finance or HR data
- Marketing Managers **cannot** access finance or HR data

---

## How to Assign Roles

### Via API (Admin Only)
```bash
curl -X POST /api/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "rakib@eduexpress.com",
    "name": "Rakib",
    "password": "secure123",
    "roles": ["consultant", "application_manager"],
    "consultant_name": "Rakib"
  }'
```

### Via Database
```sql
-- Add a role to a user
INSERT INTO user_roles (user_id, role) VALUES (1, 'application_manager');

-- Remove a role from a user
DELETE FROM user_roles WHERE user_id = 1 AND role = 'consultant';

-- View all users with their roles
SELECT u.id, u.name, u.email, GROUP_CONCAT(ur.role) as roles
FROM users u
LEFT JOIN user_roles ur ON ur.user_id = u.id
GROUP BY u.id;
```

---

## Legacy Compatibility

- The old `users.role` column is preserved for backward compatibility
- The `role` field in API responses still shows the **legacy single role**
- A new `roles` array is added alongside it for the new system
- Frontend code uses the `roles` array; legacy code can continue using `role`

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/roles.js` | **NEW** — Role definitions, permissions, navigation helpers |
| `src/App.jsx` | Updated route guards to use role-based permissions |
| `src/components/Layout.jsx` | Dynamic navigation generation from `getNavForUser()` |
| `src/pages/Dashboard.jsx` | Role-aware dashboard (personal vs executive view) |
| `src/pages/Applications.jsx` | Conditional Add Application button based on role |
| `server.js` | Schema updates, auth middleware, role guards, API endpoint changes |
| `sqldb.js` | No changes (schema handled in server.js) |

---

## Testing Checklist

- [ ] Login as **Founder & CEO** → See all navigation items, full dashboard
- [ ] Login as **Consultant** → See only My Dashboard, My Leads, Chat Inbox, Daily Workspace
- [ ] Login as **Application Manager** → See Applications Hub, Add Application (China), all chats
- [ ] Login as **Marketing Manager** → See Marketing Hub, Automation Hub, all chats
- [ ] Login as **Investor** → See Dashboard (read-only), Reports, Finance, no Chat
- [ ] Convert WhatsApp chat to lead → Lead automatically goes to Bangladesh
- [ ] Consultant tries to access Cockpit → 403 or redirect to Dashboard
- [ ] Consultant tries to create China application → 403 error
- [ ] Application Manager creates China application → Success
- [ ] Assign multiple roles to one user → Navigation merges correctly
- [ ] Chat inbox shows only own WhatsApp for consultant, all other channels visible
