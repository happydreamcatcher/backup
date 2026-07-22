# Remote Job Qualifier + Saver — Unified Chrome Extension

The two extensions — **Remote Job Qualifier** and **Job Saver** — merged into
one. A single toolbar icon, a single popup:

- **Top of the popup** — the Qualifier verdict for the current tab (🟢 green /
  🟡 amber / 🔴 red) with each reason and the evidence text.
- **Below it, always** — the Job Saver form + your saved-jobs list + CSV export,
  shown no matter what color the verdict is.

## New: no duplicate applications

There are **two separate stores**, on purpose:

| Store | What it is | Cleared when? |
|-------|-----------|---------------|
| **Saved today** (`savedJobs`) | Your daily working list. Exported as `saved_jobs.csv`. | You hit **Clear all** each day. |
| **Applied companies · all-time** (`appliedCompanies`) | A **permanent, cumulative** ledger of every company you've ever applied to. Powers the red duplicate flag. | **Never** by "Clear all" — only by the dedicated **Reset history** button. |

Every job you **save** adds its company to the permanent ledger. Because the
ledger is independent of the daily list, a company you applied to **three months
ago still flags red today**, even though you cleared and re-exported the daily
list dozens of times since.

Whenever you open **any** posting from a company in the ledger, the Qualifier
flags it **automatically on page load** — no Save needed:

- **Toolbar badge** shows a distinct red **`DUP`** (instead of a rule-count
  number), so you can tell an already-applied company apart from an ordinary
  red at a glance, without even opening the popup.
- **Popup** shows a banner at the very top the instant it opens:
  🚫 *"Already applied to Acme · first applied 2026-04-10 · last 2026-06-02 · 2× — skip this one"*
  (red) for a duplicate, or ✓ *"… — not in your applied list yet"* (green) for a
  new company — so a new company gives a clear "you're clear" signal instead of
  showing nothing.
- The message tells you **when** you applied: the first-applied date, the
  most-recent date, and how many times, all pulled from the ledger. The Save
  form note adds the precise recorded time (e.g. *"recorded 6/2/2026, 9:15 AM"*),
  and hovering the banner shows it as a tooltip.
- The Save form also repeats the 🚫 note under the Company field.

> **Note:** a company only pre-flags if it's already in the ledger — i.e. you
> **saved it before** or **imported** it. The very first time you encounter a
> company it won't flag (there's nothing recorded yet); saving it is what
> teaches the ledger. Run **Import companies…** once to seed your history so
> past applications pre-flag immediately.

Everything is local (`chrome.storage.local`) — no network, ever.

### Loading your history (import) and backing it up (export)

- **Import companies…** — reads your existing `saved_jobs.csv` (or
  `applied_companies.csv`) exports and loads every company into the permanent
  ledger. Use this once to seed it with your past applications so old jobs flag
  red immediately. Re-importing the same file adds nothing new. A plain
  one-company-per-line list works too.
- **Export companies** — downloads `applied_companies.csv`
  (`company, first_applied, last_applied, times_applied, last_recorded`) — your
  all-time list with timestamps, distinct from the daily `saved_jobs.csv`.
  Re-importing it preserves those dates and the precise `last_recorded` time.
- **Reset history** — the only thing that wipes the ledger (with confirmation).

- **Matching is exact but forgiving of formatting.** `Acme, Inc.`, `ACME`, and
  `acme incorporated` all count as the same company (case, punctuation, and
  common legal suffixes like *Inc / LLC / Ltd / Corp* are ignored). Genuinely
  different names like `Meta` vs `Metabase` are **not** merged, so you won't get
  false red flags.
- **It updates live.** Save a job and any open tab from that company re-flags to
  red immediately (no reload). Delete the saved job (or **Clear all**) and the
  company is no longer treated as applied.

## The normal Qualifier rules (unchanged)

A posting is disqualified (🔴 red) if any are true: on-site / hybrid / in-person
/ relocation (waived if a fully-remote US option is offered), a travel
requirement above 0%, a security clearance, or posted 30+ days ago. Postings
7–29 days old or with a state restriction stay qualified but show a 🟡 amber
"verify" note. See the rule engine in `analyzer.js`.

## Install (load unpacked)

1. Open Chrome → `chrome://extensions`
2. Turn on **Developer mode** (top-right)
3. Click **Load unpacked**
4. Select this **`unified`** folder
5. (Optional) Pin it: puzzle-piece 🧩 in the toolbar → pin the extension

If you previously had the two separate extensions loaded, remove them so you
don't get two badges.

## Use

1. **First time:** open the popup and **Import companies…**, picking your old
   `saved_jobs.csv` exports so your past applications start blocking duplicates.
2. Open a job tab. The icon badges it green / amber / red automatically (red if
   it's a company you've already applied to).
3. Click the icon to read *why*, and — right below — to save the job.
4. Adjust the **#** or any field, then **Save job**. Its company is added to the
   permanent ledger and now blocks future duplicates.
5. At the end of the day, **Export CSV** (that day's list), then **Clear all** —
   your all-time applied history is kept, so duplicate detection keeps working.
6. Occasionally **Export companies** to back up the all-time ledger.

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | Extension config (MV3) — one popup, one service worker |
| `analyzer.js` | The Qualifier rule engine (keyword + date logic) |
| `detector.js` | Job-field extractor (title / company / salary) + `normCompany` |
| `content.js` | Runs the analyzer + detector, applies the duplicate rule, drives the badge, answers the popup |
| `background.js` | Sets and *keeps* the per-tab toolbar badge |
| `popup.html` / `.css` / `.js` | The stacked verdict panel + save form + saved list + CSV export |
| `icons/` | Toolbar icons |

## Privacy

Everything runs **locally in your browser**. Saved jobs and the applied-company
list live in `chrome.storage.local`; the CSV is generated on your machine. The
extension makes **zero network requests** and sends your data nowhere.
