# Job Saver — Chrome Extension

A companion to **Remote Job Qualifier**. Once you've confirmed a job is a fit,
open Job Saver and click **Save job** — it captures the posting for you and lets
you export everything to a CSV (Excel / Google Sheets).

Each saved job has:

| Field | How it's filled |
|-------|-----------------|
| **#** (number) | Auto-suggests the next number (1, 2, 3…). Editable — type any number you want. |
| **Date** | **Sticky / inherited.** Blank the first time — you set it once, and every later job pre-fills with that same date. Change it and the new value becomes the default going forward. |
| **Position title** | Auto-detected from the page. |
| **Company** | Auto-detected from the page. |
| **Job link** | The current tab's URL. |
| **Salary** | Auto-detected **only when it's a sane US figure** — otherwise left empty. |

Every field is editable before you hit save, so you can fix anything the
detector gets wrong.

## How detection works

For title, company, and salary the extension trusts the page's structured data
(`JobPosting` JSON-LD, which most ATSes embed) first, then falls back to
`<meta>` tags, the `<h1>`, the page `<title>`, and the URL.

### Company — site-agnostic by design

Company detection does **not** depend on which site you're using. It gathers the
name from several independent signals that exist on virtually every job page and
lets them **corroborate** each other — a name that appears in more than one place
(e.g. the page's structured data *and* the domain) wins. No single source is
required, so it behaves the same on a company's own careers page or on any ATS:

1. `JobPosting.hiringOrganization` (structured data) — the authoritative source.
2. A standalone `Organization` JSON-LD node.
3. `og:site_name` / `application-name` / `author` meta tags (board/ATS names filtered out).
4. The URL:
   - a **company-owned domain** → the brand *is* the company: `careers.stripe.com` → **Stripe**, `jobs.netflix.com` → **Netflix**, `acmehealth.com` → **Acmehealth**;
   - a **shared ATS / board** → the company lives in the URL's path or sub-domain: `boards.greenhouse.io/airbnb` → **Airbnb**, `nvidia.wd5.myworkdayjobs.com` → **Nvidia**;
   - an **aggregator** (LinkedIn, Indeed, Glassdoor…) → the domain is *never* used as the company — it falls back to structured data / meta / title.
5. The page `<title>`, split using the domain as a hint: `Cloudflare | Senior Backend Engineer` → **Cloudflare**.

The only place a host list is used is to answer one narrow question — "is this
domain the employer, or a job board?" — not to detect companies site-by-site.
Whatever it picks is pre-filled and fully editable before you save.

## Salary — kept honest

Only figures inside real US pay ranges are accepted, so junk never lands in the
salary field:

- **Annual:** `$100,000 – $500,000`
- **Hourly:** `$50 – $200 / hr`

Anything outside those (`$30 million`, `50B`, a `$5,000 sign-on bonus`, a
`401(k)`, a `$150 gift card`) is ignored, and the field is left **empty** when
the page states no qualifying salary. Bonus / equity / relocation figures are
skipped by context.

## Export

Click **Export CSV** to download `saved_jobs.csv`:

```
number,date,position_title,company,job_link,salary,saved_at
1,2026-07-10,Senior Software Engineer,Acme,https://…,"$160,000–$190,000/yr",2026-07-10T…
```

(The file includes a UTF-8 BOM so Excel opens it cleanly.)

## Install (load unpacked)

1. Open Chrome → `chrome://extensions`
2. Turn on **Developer mode** (top-right)
3. Click **Load unpacked**
4. Select this folder: `job_save`
5. (Optional) Pin it: puzzle-piece 🧩 in the toolbar → pin "Job Saver"

## Use

1. On a job page you've decided to keep, click the Job Saver icon.
2. The form is pre-filled — adjust the **#** or fix any field if needed.
3. Click **Save job**. It appears in the **Saved** list below.
4. When ready, **Export CSV**.

Use **↻** to re-read the page if it rendered after you opened the popup.

## Privacy

Everything runs **locally in your browser**. Saved jobs live in
`chrome.storage.local`; the CSV is generated on your machine. The extension
makes **zero network requests** and sends your data nowhere.

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | Extension config (MV3) |
| `detector.js` | Pure extractor for title / company / salary |
| `content.js` | Answers the popup's request for the current page's job info |
| `popup.html/.css/.js` | The save form, saved list, and CSV export |
| `icons/` | Toolbar icons |
