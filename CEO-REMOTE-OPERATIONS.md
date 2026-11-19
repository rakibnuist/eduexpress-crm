# EduExpress Command — Simple CEO Operating Plan

**For:** Abdullah Al Rakib, Founder & CEO, EduExpress International  
**Purpose:** A short, realistic answer to: what does a CEO actually need to run the Dhanmondi office remotely?

---

## 1. The business in one paragraph

EduExpress is a written-proof, visa-first education consultancy. It was founded in 2018, established a China entity in 2019, relaunched in Bangladesh in 2023, and now operates from Dhanmondi with a China flagship and 10–12 active destinations. The China package is BDT 200,000, with no EduExpress service fee before visa approval and a documented cost sheet. The brand depends on its four proof documents: EduFit report, ClearCost sheet, Application Proof Pack and Visa Readiness Record.

Sources: [about](https://eduexpressint.com/about), [services](https://eduexpressint.com/services), [fees](https://eduexpressint.com/fees-and-transparency), [country status](https://eduexpressint.com/country-status).

---

## 2. What the CEO actually needs

Not another dashboard. Not staff surveillance. Five things:

1. **See what is off-track** — cash, stale leads, missing documents, visa deadlines, unanswered families.
2. **Make the few decisions only the CEO can make** — spending, refunds, fee waivers, original-document release.
3. **Give work an owner and a due date** — and see whether it was completed.
4. **Trust the numbers** — know when data is missing or stale.
5. **Keep the written-proof promise** — every decision has a reason and a record.

Industry benchmarks support the same pattern: tasks, document checklists and company summaries are standard in agency CRMs ([Agentcis](https://agentcis.com/improve-operations-with-the-business-summary-report/)); approvals need triggers, approvers and an audit log ([Mimo](https://support.mimohq.com/en/articles/9820163-multi-step-approval-workflows-in-mimo)); remote teams should be measured on outcomes, not invasive monitoring ([Clockify](https://clockify.me/blog/workforce-management/remote-team-monitoring/)).

---

## 3. What was built now

### Command Center

One page, four numbers, one combined attention list:

- Cash recorded
- Pipeline
- Approvals waiting
- Open risks

The attention list combines pending approvals, overdue tasks and the highest-cost exceptions. A small team panel shows check-in and daily-log status. Nothing else.

### Approvals — only five real types

- Expense
- Refund
- Fee waiver
- Document release
- Other

Flow: create → review → approve or reject with a required note. The requester cannot approve their own request. Every action is recorded in `approval_events` and the activity log.

### Tasks — simple ownership

- Task, owner, due date, priority
- Open / In progress / Done
- Overdue flag
- Staff see only their own; managers see all
- Assigned tasks also appear on the Daily Workspace

### Navigation

The sidebar is grouped into Command, Operations, Growth, Control and Administration. Badges show pending approvals and open tasks. Existing CRM modules stay where they were.

---

## 4. What was deliberately not built

These are real needs, but they cannot be done honestly yet without more design and integration work:

- **Automatic expense approval routing.** It requires the Finance ledger to support pending/posted expenses. The current ledger has no approval state.
- **Document-custody release workflow.** It must be tied to a specific student document, receipt and custody record. The generic approval object is not enough.
- **Partner commission ledger.** Partner records exist, but commission accrual, payable and payment stages do not.
- **Payroll, leave or access approvals.** These need their own rules and should not be mixed into a generic request inbox yet.

I did not pretend these are finished.

---

## 5. A simple, realistic next plan

**Step 1 — Fix the data first (highest value).**  
The local snapshot has 353 leads, 294 in New Lead, 280 unassigned, 312 without a destination, and the newest lead dated 21 July 2026. Fix ingestion and ownership before adding more automation.

**Step 2 — Connect Finance to approvals.**  
Add a pending/posted state to expenses and route expenses above a threshold into the existing approval queue. This is the next real control gain.

**Step 3 — Add document release to the student file.**  
Create a release approval from the lead’s document record, with a receipt and custody note. Do this only after the Finance step is stable.

Everything else can wait.

---

## 6. Data warning

The local database is a historical snapshot. The Command Center explicitly shows the date of the newest lead so stale data cannot be mistaken for current performance. Validate production numbers before using them for board or cash decisions.
