# Brain API Rotation & Failover

How the AI "brain" uses your 8 API keys so a free-tier limit never stops the work.

---

## 1. The logic (4 rules n8n follows)

1. **Priority order.** Try keys by Priority 1→8 (set in the "Brain API Pool" tab). #1 is your best/most-generous key.
2. **Proactive rotation — *before* a tier finishes.** n8n counts requests per key per day. When a key hits its "Rotate at (~85%)" threshold, it's skipped for the rest of the day and traffic moves to the next key. You never slam into a hard cap mid-job.
3. **Failover — *once* a tier finishes.** If a key still returns a quota / rate-limit error (HTTP 429) or a 5xx, n8n marks it `Cooling`, records when it resets, and **instantly retries the same request on the next available key.** The job completes regardless.
4. **All capped (safety net).** If every key is `Cooling`/`Exhausted`, the job queues and retries after the earliest reset, and the Telegram agent alerts you.

A nightly cron clears "Used today" and reactivates any key whose cooldown has passed.

---

## 2. Where it lives

- **Secrets (the actual keys):** in **n8n credentials only** — never in the Sheet, never in chat.
- **Settings + live status:** the new **"Brain API Pool"** tab in the Command Center. You fill the static columns; n8n writes the live ones.

| Column | Who fills it |
|---|---|
| Priority, Provider, Model, Credential label, Free req/min, Free req/day | **You** |
| Rotate at (~85%) | Auto formula |
| Used today, Status, Cooldown until | **n8n** (live) |

---

## 3. Same provider vs. mixed providers

- **If all 8 are Google Gemini keys** (e.g., from different Google accounts): simplest case — identical endpoint/format, n8n just swaps the key. Highest reliability.
- **If they're mixed** (Gemini + Groq + Mistral + Cohere + OpenRouter…): each provider gets a tiny adapter so the workflow calls one unified "generate" step. Slightly more setup, but more total free capacity and provider-outage resilience.

Either works — I just need to know which so I build the right adapters and set sensible priority order (best model + biggest free quota first).

---

## 4. What YOU need to do

1. **Put all 8 keys into n8n** as credentials. Name each one to match the "n8n credential label" column (e.g., `brain_gemini_1`, `brain_key_2`, …). **Keys go in n8n, not in this chat or the Sheet.**
2. **Fill the "Brain API Pool" tab** for each of the 8: Provider, Model, and the free **req/min** and **req/day** limits (look these up on each provider's pricing/free-tier page — verify, don't guess).
3. **Tell me, here in chat (no secrets):**
   - Are the 8 keys **all Gemini**, or **mixed providers**? If mixed, list provider + model for each (just the names, e.g. "Groq – llama-3.x-70b").
   - Your preferred **priority order** (or let me set it by best model + biggest free quota).
4. That's it — I wire the rotation logic into the n8n weekly-loop workflow.

> Reminder: I'll only record that the keys are *configured* — never the key values themselves.

---

## 5. Quick reference — what to send me
> "All 8 are Gemini keys" — **or** — "Mixed: 1) Gemini flash, 2) Groq llama-3.x, 3) Mistral …" + (optional) your priority preference.

Once I have that + the keys are in n8n, the brain is rotation-ready.
