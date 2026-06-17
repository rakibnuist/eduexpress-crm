# Data Center + Google API Setup

How your curated data feeds the automation, where files live, and exactly what to give n8n to make it "proper."

---

## 1. Two layers: structured data + files

**Structured data → Google Sheets** (`EduExpress-Data-Center.xlsx`, import to Sheets):
Universities · Scholarships · Research Library (source links) · Competitor Intel · Brochures & Docs index.
This is what the AI *reads as facts*.

**Files (brochures, university PDFs, forms, images) → Google Drive.**
The Sheet's "Drive link" columns point to these files. The system links them into posts when relevant.

---

## 2. Google Drive structure (data + assets in one place)

```
/EduExpress/
  /Data Center/
      EduExpress-Data-Center  (the live Sheet)
      /Brochures/          China brochure, Korea guide, etc.
      /University PDFs/     admission info, fee sheets per uni
      /Scholarship Docs/    official notices you download
      /Forms & Checklists/
  /Social/                 (from the content engine — Phase 0)
      /Brand/ /Templates/ /Student Assets/ /Auto-Graphics/ /2026-Wxx/
```

---

## 3. How the weekly loop uses the Data Center

```
LISTEN  → reads Research Library links + Competitor Intel + auto-research
THINK   → cross-checks against Scholarships (Open? deadline near?) + Universities
PLAN    → writes posts using VERIFIED numbers from the Data Center, not guesses;
          links the matching Brochure/PDF from Drive when useful
```

**Rule the system follows:** if a scholarship's `Status = Closed` or `Last verified` is stale, it won't promote it without flagging you first. Your data always overrides the AI's research.

---

## 4. What to give n8n (the "proper" Google setup)

n8n needs its own Google credentials to read/write your Sheets, Docs, and Drive. **Recommended: a Google Service Account** (cleaner than personal OAuth for an always-on automation).

**Steps (one-time, ~15 min):**
1. In **Google Cloud Console** → create/select a project.
2. Enable APIs: **Google Sheets API**, **Google Drive API**, **Google Docs API**.
3. Create a **Service Account** → generate a **JSON key**.
4. **Share** the `/EduExpress/` Drive folder + the Data Center Sheet with the service account's email (gives it access without exposing your whole Drive).
5. In n8n → add **Google Service Account** credentials → paste the JSON.

That's all I need to wire the live read/write. (Alternatively, OAuth2 with your Google account works too — service account is just more robust for scheduled runs.)

> Security note: the JSON key is a secret. Share it into n8n's credential store directly — don't paste it into chat. I'll store the *fact* that it's configured, never the key itself.

---

## 5. What I need from you to make the Data Center live
1. **Connect Google** (service account JSON for n8n, or authorize the Google connector here) so I can create the live Sheet + Drive folders in proper structure.
2. **Start adding data** — even partial is fine: your real university list, brochures, and any scholarship source links you already have.
3. Confirm you want the Data Center Sheet and the Command Center Sheet as **two separate Sheets** (recommended — data vs. workflow) or merged into one.

Until Google is connected, both workbooks live as `.xlsx` in your Marketing Automation folder — fully usable now, and import-ready the moment you connect.

---

## 6. Timeline check
Posting starts **July 2026**. Plan:
- **Now → late June:** you load the Data Center; I connect Google + build the n8n weekly loop; we run it draft-only to calibrate.
- **Early July:** first approved week goes live (Facebook both pages), then IG/TikTok follow.
