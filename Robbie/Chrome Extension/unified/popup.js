/*
 * popup.js — one popup, two stacked panels:
 *
 *   1. TOP  — the Qualifier verdict for the current tab (red / amber / green),
 *             including the new "Already applied to this company" red reason.
 *   2. BELOW — the Job Saver form + saved list + CSV export, shown ALWAYS,
 *             whatever color the verdict is.
 *
 * Saving a job also adds its company to the "applied" database, so the next
 * time you open any posting from that company the verdict turns red.
 */

const STORE_KEY = "savedJobs"; // daily working list (exported + cleared)
const APPLIED_KEY = "appliedCompanies"; // permanent, cumulative applied ledger
const LAST_DATE_KEY = "lastDate"; // the "sticky" date, inherited by later jobs

const el = {
  // verdict
  appliedStatus: document.getElementById("applied-status"),
  content: document.getElementById("content"),
  vfoot: document.getElementById("verdict-foot"),
  // saver form
  number: document.getElementById("f-number"),
  date: document.getElementById("f-date"),
  title: document.getElementById("f-title"),
  company: document.getElementById("f-company"),
  salary: document.getElementById("f-salary"),
  link: document.getElementById("f-link"),
  dupWarn: document.getElementById("dup-warn"),
  form: document.getElementById("job-form"),
  save: document.getElementById("save"),
  redetect: document.getElementById("redetect"),
  msg: document.getElementById("msg"),
  list: document.getElementById("list"),
  count: document.getElementById("count"),
  export: document.getElementById("export"),
  clear: document.getElementById("clear"),
  // all-time applied-company ledger
  ledgerCount: document.getElementById("ledger-count"),
  importCompanies: document.getElementById("import-companies"),
  exportCompanies: document.getElementById("export-companies"),
  resetApplied: document.getElementById("reset-applied"),
  importFile: document.getElementById("import-file"),
};

// ---- helpers ---------------------------------------------------------------

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s == null ? "" : String(s);
  return d.innerHTML;
}

// Kept in sync with detector.js's normCompany — the exact, suffix-stripping key
// used to decide whether two company names are "the same company".
const LEGAL_SUFFIX = new Set([
  "inc", "incorporated", "llc", "ltd", "limited", "corp", "corporation",
  "co", "company", "gmbh", "plc", "sa", "ag", "nv", "bv", "srl", "pty", "holdings",
]);
function normCompany(s) {
  if (!s) return "";
  let words = String(s)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  while (words.length > 1 && LEGAL_SUFFIX.has(words[words.length - 1])) words.pop();
  return words.join("");
}

function activeTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs[0] || null));
  });
}
function ask(tabId, type) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type }, (resp) => {
      if (chrome.runtime.lastError) resolve(null);
      else resolve(resp || null);
    });
  });
}

// ---- storage ---------------------------------------------------------------

function getJobs() {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORE_KEY, (r) => resolve(r[STORE_KEY] || []));
  });
}
function setJobs(jobs) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORE_KEY]: jobs }, resolve);
  });
}
function getLastDate() {
  return new Promise((resolve) => {
    chrome.storage.local.get(LAST_DATE_KEY, (r) => resolve(r[LAST_DATE_KEY] || ""));
  });
}
function setLastDate(date) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [LAST_DATE_KEY]: date || "" }, resolve);
  });
}

// ---- permanent applied-company ledger --------------------------------------
// Shape: { [normalizedKey]: { company, firstDate, lastDate, count } }
// This is the source of truth for the red duplicate flag. It is cumulative and
// is NEVER cleared by the daily "Clear all" — only by "Reset history".

function getApplied() {
  return new Promise((resolve) => {
    chrome.storage.local.get(APPLIED_KEY, (r) => resolve(r[APPLIED_KEY] || {}));
  });
}
function setApplied(map) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [APPLIED_KEY]: map }, resolve);
  });
}

// Upsert one company into the ledger map (mutates it). `date` is the application
// date (YYYY-MM-DD); `stamp` is an optional precise ISO timestamp of the record
// (present for jobs saved through the app, absent for CSV imports). Returns
// "new" if the company wasn't in the ledger before, else "updated" / "".
function upsertApplied(map, company, date, stamp) {
  const key = normCompany(company);
  if (!key) return "";
  const name = String(company || "").trim();
  const rec = map[key];
  if (rec) {
    rec.count = (rec.count || 1) + 1;
    if (date && (!rec.firstDate || date < rec.firstDate)) rec.firstDate = date;
    if (date && (!rec.lastDate || date > rec.lastDate)) rec.lastDate = date;
    if (stamp && (!rec.lastAppliedAt || stamp > rec.lastAppliedAt)) rec.lastAppliedAt = stamp;
    if (name && name.length > (rec.company || "").length) rec.company = name; // prefer fuller name
    return "updated";
  }
  map[key] = {
    company: name,
    firstDate: date || "",
    lastDate: date || "",
    count: 1,
    lastAppliedAt: stamp || "",
  };
  return "new";
}

// A compact "first applied … · last … · N×" tail for the ledger UI.
function appliedWhenBits(rec) {
  const bits = [];
  if (rec.firstDate) bits.push("first applied " + rec.firstDate);
  if (rec.count > 1 && rec.lastDate && rec.lastDate !== rec.firstDate) bits.push("last " + rec.lastDate);
  if (rec.count > 1) bits.push(rec.count + "×");
  return bits;
}

// ISO timestamp → short local "when", or "" if absent/unparseable.
function fmtStamp(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d) ? "" : d.toLocaleString();
}

// ---- verdict rendering (top panel) ----------------------------------------

function renderVerdict(result) {
  if (!result) {
    el.content.innerHTML =
      '<div class="verdict neutral"><span class="icon">•</span><span>No data for this page. Try reloading the tab.</span></div>';
    el.vfoot.textContent = "";
    return;
  }
  if (!result.isJobPage) {
    el.content.innerHTML =
      '<div class="verdict neutral"><span class="icon">•</span><span>No job posting detected on this page.</span></div>';
    el.vfoot.textContent = "Only pages that look like a single job posting are rated.";
    return;
  }

  let html = "";
  const warnings = result.warnings || [];

  if (result.qualified) {
    if (warnings.length) {
      html +=
        '<div class="verdict warnbanner"><span class="icon">⚠️</span><span>Qualified — but ' +
        warnings.length +
        " thing" +
        (warnings.length === 1 ? "" : "s") +
        " to verify</span></div>";
    } else {
      html +=
        '<div class="verdict pass"><span class="icon">✅</span><span>Qualified — passes all your rules</span></div>';
    }
  } else {
    const n = result.reasons.length;
    html +=
      '<div class="verdict fail"><span class="icon">❌</span><span>Not Qualified — ' +
      n +
      " issue" +
      (n === 1 ? "" : "s") +
      " found</span></div>";
    for (const r of result.reasons) {
      const cls = r.rule === "duplicate" ? "reason dup" : "reason";
      html +=
        '<div class="' +
        cls +
        '"><div class="label">' +
        (r.rule === "duplicate" ? "🚫 " : "") +
        esc(r.label) +
        '</div><div class="evidence">“' +
        esc(r.evidence) +
        "”</div></div>";
    }
  }

  for (const w of warnings) {
    html +=
      '<div class="reason warn"><div class="label">⚠ ' +
      esc(w.label) +
      '</div><div class="evidence">' +
      esc(w.evidence) +
      "</div></div>";
  }

  if (result.posting) {
    const age = result.posting.ageDays;
    const iso =
      result.posting.date && result.posting.date.slice
        ? result.posting.date.slice(0, 10)
        : new Date(result.posting.date).toISOString().slice(0, 10);
    html +=
      '<div class="meta"><span class="datechip">🗓 Posted ' +
      (age <= 0 ? "today" : age + " day" + (age === 1 ? "" : "s") + " ago") +
      " · " +
      esc(iso) +
      "</span></div>";
  } else {
    html += '<div class="meta">🗓 Posting date not found on page — age not checked.</div>';
  }

  el.content.innerHTML = html;
  el.vfoot.textContent =
    "Checked " + new Date(result.checkedAt).toLocaleTimeString() + " · all analysis runs locally.";
}

let lastVerdict = null; // last verdict from the content script (for banner gating)

async function fetchVerdict() {
  const tab = await activeTab();
  if (!tab) {
    lastVerdict = null;
    return renderVerdict(null);
  }
  const resp = await ask(tab.id, "GET_RESULT");
  lastVerdict = resp || null;
  renderVerdict(resp || { isJobPage: false });
  // Now that we know whether it's a job page, refresh the applied banner so the
  // "you're clear" state can show for new companies.
  await updateDupWarn();
}

// ---- saver: detect + fill --------------------------------------------------

async function detectAndFill() {
  const tab = await activeTab();
  const info = tab ? await ask(tab.id, "GET_JOB_INFO") : null;

  const link = (tab && tab.url) || (info && info.link) || "";
  el.title.value = (info && info.title) || "";
  el.company.value = (info && info.company) || "";
  el.salary.value = (info && info.salary) || "";
  el.link.value = link;

  el.title.placeholder = info ? "Not detected — type it in" : "Open a job page, then reopen";
  el.company.placeholder = el.title.placeholder;

  await updateDupWarn();
}

// Drives BOTH the top applied-status banner and the in-form note, checked
// against the permanent ledger — so it shows the instant the popup opens, for a
// company applied months ago, WITHOUT needing to click Save.
//   • already applied → red banner + red form note (always shown)
//   • new company on a job page → green "you're clear" banner
//   • no company / not a job page → banner hidden
async function updateDupWarn() {
  const raw = el.company.value.trim();
  const key = normCompany(raw);
  if (!key) {
    el.dupWarn.hidden = true;
    el.appliedStatus.hidden = true;
    return;
  }
  const applied = await getApplied();
  const rec = applied[key];

  if (rec) {
    const name = rec.company || raw;
    const bits = appliedWhenBits(rec);
    const stamp = fmtStamp(rec.lastAppliedAt);

    // Top banner — concise: dates + count, and the precise time as a tooltip.
    el.appliedStatus.hidden = false;
    el.appliedStatus.className = "applied-status dup";
    el.appliedStatus.textContent =
      "🚫 Already applied to " + name + (bits.length ? " · " + bits.join(" · ") : "") + " — skip this one.";
    el.appliedStatus.title = stamp ? "Last recorded " + stamp : "";

    // Form note — a little more room, so include the precise recorded time.
    const noteBits = bits.slice();
    if (stamp) noteBits.push("recorded " + stamp);
    el.dupWarn.hidden = false;
    el.dupWarn.textContent =
      "🚫 Already applied to " + name + (noteBits.length ? " (" + noteBits.join(", ") + ")" : "") + ".";
  } else {
    el.dupWarn.hidden = true;
    // Positive "you're clear" only on a real job page, to avoid noise on random
    // sites where a company name happens to be detectable.
    if (lastVerdict && lastVerdict.isJobPage) {
      el.appliedStatus.hidden = false;
      el.appliedStatus.className = "applied-status clear";
      el.appliedStatus.textContent = "✓ " + raw + " — not in your applied list yet.";
    } else {
      el.appliedStatus.hidden = true;
    }
  }
}

async function refreshLedger() {
  const applied = await getApplied();
  const n = Object.keys(applied).length;
  el.ledgerCount.textContent = n ? n + " compan" + (n === 1 ? "y" : "ies") : "";
}

// ---- saver: saved list -----------------------------------------------------

function nextNumber(jobs) {
  let max = 0;
  for (const j of jobs) {
    const n = parseInt(j.number, 10);
    if (!isNaN(n) && n > max) max = n;
  }
  return max + 1;
}

function shortUrl(u) {
  try {
    const url = new URL(u);
    let s = url.hostname.replace(/^www\./, "") + url.pathname;
    return s.length > 46 ? s.slice(0, 45) + "…" : s;
  } catch (e) {
    return u;
  }
}

async function refresh() {
  const jobs = await getJobs();
  el.count.textContent = jobs.length ? jobs.length + " saved" : "";

  if (!el.number.value) el.number.value = nextNumber(jobs);

  if (!jobs.length) {
    el.list.innerHTML = '<div class="empty">No jobs saved yet.</div>';
    return;
  }

  const sorted = jobs
    .slice()
    .sort((a, b) => (parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0));
  el.list.innerHTML = sorted
    .map((j) => {
      const linkHtml = j.link
        ? '<a href="' + esc(j.link) + '" target="_blank" rel="noreferrer">' + esc(shortUrl(j.link)) + "</a>"
        : "";
      const sal = j.salary ? '<span class="sal">' + esc(j.salary) + "</span>" : "";
      const dateChip = j.date ? '<span class="date">' + esc(j.date) + "</span>" : "";
      const meta = sal || dateChip ? '<div class="rowmeta">' + sal + dateChip + "</div>" : "";
      return (
        '<div class="row" data-id="' + esc(j.id) + '">' +
        '<div class="num">' + esc(j.number) + "</div>" +
        "<div>" +
        '<div class="title">' + esc(j.title || "(untitled)") + "</div>" +
        '<div class="sub">' + esc(j.company || "") + "</div>" +
        '<div class="sub">' + linkHtml + "</div>" +
        meta +
        "</div>" +
        '<button class="del" title="Delete">✕</button>' +
        "</div>"
      );
    })
    .join("");
}

function flash(text, kind) {
  el.msg.textContent = text;
  el.msg.className = "msg " + (kind || "");
  if (text)
    setTimeout(() => {
      if (el.msg.textContent === text) {
        el.msg.textContent = "";
        el.msg.className = "msg";
      }
    }, 2500);
}

// ---- actions ---------------------------------------------------------------

el.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const number = el.number.value.trim();
  const date = el.date.value.trim();
  const title = el.title.value.trim();
  const company = el.company.value.trim();
  const salary = el.salary.value.trim();
  const link = el.link.value.trim();

  if (!number) return flash("Enter a number first.", "err");
  if (!title && !company && !link) return flash("Nothing to save — no job detected.", "err");

  const savedAt = new Date().toISOString();
  const jobs = await getJobs();
  const id = "j" + jobs.length + "_" + Math.floor(performance.now() * 1000).toString(36);
  jobs.push({ id, number, date, title, company, salary, link, savedAt });
  await setJobs(jobs);
  await setLastDate(date);

  // Record the company in the PERMANENT ledger (survives daily Clear all),
  // stamping the precise time so "already applied" can show when.
  if (company) {
    const applied = await getApplied();
    upsertApplied(applied, company, date, savedAt);
    await setApplied(applied);
  }

  flash("Saved #" + number + ".", "ok");
  el.number.value = nextNumber(jobs);
  el.date.value = date;
  await refresh();
  await refreshLedger();
  await updateDupWarn();
  // The applied database changed — the content script re-badges the tab; pull
  // the fresh verdict so the top panel reflects the new red flag too.
  setTimeout(fetchVerdict, 200);
});

el.date.addEventListener("change", () => setLastDate(el.date.value.trim()));
el.company.addEventListener("input", updateDupWarn);

el.redetect.addEventListener("click", async () => {
  await detectAndFill();
  await fetchVerdict();
  flash("Re-read the page.", "ok");
});

el.list.addEventListener("click", async (e) => {
  const btn = e.target.closest(".del");
  if (!btn) return;
  const row = btn.closest(".row");
  const id = row && row.getAttribute("data-id");
  if (!id) return;
  const jobs = (await getJobs()).filter((j) => j.id !== id);
  await setJobs(jobs);
  await refresh();
  // Note: the permanent applied ledger is intentionally untouched.
});

el.clear.addEventListener("click", async () => {
  const jobs = await getJobs();
  if (!jobs.length) return;
  if (
    !confirm(
      "Clear the " +
        jobs.length +
        " job(s) in today's list?\n\nYour all-time applied-companies history is kept, so duplicate detection still works."
    )
  )
    return;
  await setJobs([]);
  el.number.value = "";
  await refresh();
});

// ---- CSV export ------------------------------------------------------------

function csvCell(v) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

el.export.addEventListener("click", async () => {
  const jobs = (await getJobs())
    .slice()
    .sort((a, b) => (parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0));
  if (!jobs.length) return flash("Nothing to export.", "err");

  const header = ["number", "date", "position_title", "company", "salary", "job_link"];
  const rows = jobs.map((j) =>
    [j.number, j.date, j.title, j.company, j.salary, j.link].map(csvCell).join(",")
  );
  const csv = "﻿" + header.join(",") + "\n" + rows.join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "saved_jobs.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  flash("Exported " + jobs.length + " jobs.", "ok");
});

// ---- applied-company ledger: export / import / reset -----------------------

// Export the full all-time ledger as its own CSV (distinct from the daily one).
el.exportCompanies.addEventListener("click", async () => {
  const applied = await getApplied();
  const rows = Object.values(applied).sort((a, b) =>
    (a.company || "").localeCompare(b.company || "")
  );
  if (!rows.length) return flash("No applied companies yet.", "err");

  const header = ["company", "first_applied", "last_applied", "times_applied", "last_recorded"];
  const body = rows.map((r) =>
    [r.company, r.firstDate || "", r.lastDate || "", r.count || 1, r.lastAppliedAt || ""].map(csvCell).join(",")
  );
  const csv = "﻿" + header.join(",") + "\n" + body.join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "applied_companies.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  flash("Exported " + rows.length + " companies.", "ok");
});

// Minimal RFC-4180-ish CSV parser (handles quotes, escaped quotes, CRLF, BOM).
function parseCSV(text) {
  text = text.replace(/^﻿/, "");
  const rows = [];
  let row = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQ = false;
      } else field += c;
    } else if (c === '"') {
      inQ = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// Import companies from a saved_jobs.csv / applied_companies.csv export.
el.importCompanies.addEventListener("click", () => el.importFile.click());

el.importFile.addEventListener("change", async () => {
  const file = el.importFile.files && el.importFile.files[0];
  el.importFile.value = ""; // allow re-importing the same file later
  if (!file) return;

  let text;
  try {
    text = await file.text();
  } catch (e) {
    return flash("Couldn't read that file.", "err");
  }

  const rows = parseCSV(text).filter((r) => r.some((c) => c && c.trim()));
  if (!rows.length) return flash("That CSV is empty.", "err");

  // Locate the company (and optional date) columns from the header row.
  const header = rows[0].map((h) => h.trim().toLowerCase());
  let ci = header.indexOf("company");
  let di = header.indexOf("date");
  if (di < 0) di = header.indexOf("first_applied");
  const si = header.indexOf("last_recorded"); // precise timestamp, if present
  let start = 1;
  if (ci < 0) {
    // No recognizable header — treat the file as a single column of names.
    ci = 0;
    di = -1;
    start = 0;
  }

  const applied = await getApplied();
  let added = 0;
  for (let r = start; r < rows.length; r++) {
    const company = (rows[r][ci] || "").trim();
    if (!company) continue;
    const date = di >= 0 ? (rows[r][di] || "").trim() : "";
    const stamp = si >= 0 ? (rows[r][si] || "").trim() : "";
    if (upsertApplied(applied, company, date, stamp) === "new") added++;
  }
  await setApplied(applied);
  await refreshLedger();
  await updateDupWarn();
  setTimeout(fetchVerdict, 200); // current tab may now be a duplicate
  flash(
    added
      ? "Imported " + added + " new compan" + (added === 1 ? "y" : "ies") + "."
      : "No new companies — all were already in the list.",
    "ok"
  );
});

// Reset the permanent ledger — the ONLY action that wipes applied history.
el.resetApplied.addEventListener("click", async () => {
  const applied = await getApplied();
  const n = Object.keys(applied).length;
  if (!n) return flash("Applied history is already empty.", "err");
  if (
    !confirm(
      "Erase your all-time applied-company history (" +
        n +
        " companies)?\n\nThis is what powers duplicate detection. This can't be undone."
    )
  )
    return;
  await setApplied({});
  await refreshLedger();
  await updateDupWarn();
  setTimeout(fetchVerdict, 200);
  flash("Applied history reset.", "ok");
});

// ---- boot ------------------------------------------------------------------

// One-time-ish migration: make sure any jobs already in today's list are also
// represented in the permanent ledger (covers users upgrading from the version
// that derived duplicates straight from savedJobs).
async function seedLedgerFromSavedJobs() {
  const jobs = await getJobs();
  if (!jobs.length) return;
  const applied = await getApplied();
  let changed = false;
  for (const j of jobs) {
    if (!j.company) continue;
    if (!applied[normCompany(j.company)]) {
      upsertApplied(applied, j.company, j.date, j.savedAt || "");
      changed = true;
    }
  }
  if (changed) await setApplied(applied);
}

(async function init() {
  el.date.value = await getLastDate();
  await seedLedgerFromSavedJobs();
  // Fill the company first (so the applied-status banner can resolve), then
  // fetch the verdict (which re-checks the banner now that isJobPage is known).
  await detectAndFill();
  await fetchVerdict();
  await refresh();
  await refreshLedger();
})();
