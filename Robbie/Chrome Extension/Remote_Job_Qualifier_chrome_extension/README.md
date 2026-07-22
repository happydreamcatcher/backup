# Remote Job Qualifier — Chrome Extension

Automatically flags job postings that **don't** match your rules, on any ATS
(Ashby, Workday, Workable, Greenhouse, Lever, company career pages, …).

Each open job tab gets a badge on the toolbar icon:

- **green ✓** — Qualified (passes all rules)
- **red number** — Not Qualified (number = how many rules it failed)
- **no badge** — the page isn't a job posting

Click the icon to see **each reason + the exact text found**, so you can trust
or override the call.

## Hard rules — a job is DISQUALIFIED (red ❌) if ANY are true

1. **Location** — on-site, in-office, hybrid, in-person, relocation, commute
2. **Travel** — "ability/willingness to travel", "25% travel", "travel required", …
3. **Clearance** — security clearance, public trust, secret/TS-SCI, polygraph
4. **Seniority** — internship/intern, junior, entry-level, early-career, apprentice
5. **Unpaid** — volunteer, unpaid, pro bono
6. **Stale** — posted **30+ days ago** (uses `datePosted` from the page's data, visible or hidden)

Posting age is tiered:

| Age | Result |
|-----|--------|
| 0–6 days | 🟢 Green |
| 7–29 days | 🟡 Amber (verify it's fresh — may be a repost) |
| 30+ days | 🔴 Red (disqualified) |

## Soft warnings — job stays QUALIFIED but flagged amber ⚠ for a human glance

- **Location/state restriction** — "must reside in CA, NY, TX", "open only to residents in certain states". It's remote, but only if your state is eligible — verify before skipping.
- **Posted 7–30 days ago** — could be a repost of an older listing; double-check freshness.

Smart touches:

- Negated phrases are ignored — "**no** relocation required", "travel is **not** required".
- "hybrid **cloud**", "hybrid **app**" etc. are **not** mistaken for hybrid work.
- Posting date comes from the page's structured data (`JobPosting.datePosted`)
  first, then "X days ago" / "Posted on …" text as a fallback.
- Works on single-page-app ATSes (re-checks when content loads or the route changes).

## Install (load unpacked)

1. Open Chrome → `chrome://extensions`
2. Turn on **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select this folder: `chrome_extension`
5. (Optional) Pin the icon: click the puzzle-piece 🧩 in the toolbar → pin "Remote Job Qualifier"

## Use

1. Open your job tabs as usual.
2. Watch the icon badge for each tab — red number = skip it.
3. Click the icon on any tab to read *why* it was flagged, with the evidence text.

If a tab shows no badge on an ATS you use, reload it once (some SPAs render late).

## Privacy

Everything runs **locally in your browser**. No page content, no data, and no
browsing history is ever sent anywhere. The extension makes zero network requests.

## Tweaking the rules

All rules live in `analyzer.js` under `RULES`, plus the date logic below it.
Add/remove keywords there, then hit the **reload ⟳** button on the extension in
`chrome://extensions` to apply changes.

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | Extension config (MV3) |
| `analyzer.js` | The rule engine (keyword + date logic) |
| `content.js` | Runs the analyzer on each page, drives the badge, handles SPAs |
| `background.js` | Sets the per-tab toolbar badge |
| `popup.html/.css/.js` | The verdict panel shown when you click the icon |
| `icons/` | Toolbar icons |
