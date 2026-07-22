/*
 * popup.js — the form + saved-jobs list.
 *
 *  1. On open: pull the detected job info from the active tab and pre-fill the
 *     form (every field stays editable). The # auto-suggests the next number.
 *  2. Save: validate, append to chrome.storage.local, refresh the list.
 *  3. Export: build a CSV from all saved jobs and download it.
 */

const STORE_KEY = "savedJobs";
const LAST_DATE_KEY = "lastDate"; // the "sticky" date, inherited by later jobs

const el = {
  number: document.getElementById("f-number"),
  date: document.getElementById("f-date"),
  title: document.getElementById("f-title"),
  company: document.getElementById("f-company"),
  salary: document.getElementById("f-salary"),
  link: document.getElementById("f-link"),
  form: document.getElementById("job-form"),
  save: document.getElementById("save"),
  redetect: document.getElementById("redetect"),
  msg: document.getElementById("msg"),
  list: document.getElementById("list"),
  count: document.getElementById("count"),
  export: document.getElementById("export"),
  clear: document.getElementById("clear"),
};

// ---- storage helpers -------------------------------------------------------

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

// ---- detection -------------------------------------------------------------

function activeTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs[0] || null));
  });
}

function askContent(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: "GET_JOB_INFO" }, (resp) => {
      if (chrome.runtime.lastError) resolve(null); // no content script here
      else resolve(resp || null);
    });
  });
}

async function detectAndFill(preferTabUrl) {
  const tab = await activeTab();
  const info = tab ? await askContent(tab.id) : null;

  // The tab's own URL is the most reliable "page link".
  const link = (tab && tab.url) || (info && info.link) || "";

  el.title.value = (info && info.title) || "";
  el.company.value = (info && info.company) || "";
  el.salary.value = (info && info.salary) || "";
  el.link.value = link;

  el.title.placeholder = info ? "Not detected — type it in" : "Open a job page, then reopen";
  el.company.placeholder = el.title.placeholder;
}

// ---- rendering -------------------------------------------------------------

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s == null ? "" : String(s);
  return d.innerHTML;
}

function nextNumber(jobs) {
  let max = 0;
  for (const j of jobs) {
    const n = parseInt(j.number, 10);
    if (!isNaN(n) && n > max) max = n;
  }
  return max + 1;
}

async function refresh() {
  const jobs = await getJobs();
  el.count.textContent = jobs.length ? jobs.length + " saved" : "";

  // Auto-suggest the next number only if the user hasn't typed one.
  if (!el.number.value) el.number.value = nextNumber(jobs);

  if (!jobs.length) {
    el.list.innerHTML = '<div class="empty">No jobs saved yet.</div>';
    return;
  }

  const sorted = jobs.slice().sort((a, b) => (parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0));
  el.list.innerHTML = sorted
    .map((j) => {
      const linkHtml = j.link
        ? '<a href="' + esc(j.link) + '" target="_blank" rel="noreferrer">' + esc(shortUrl(j.link)) + "</a>"
        : "";
      const sal = j.salary ? '<span class="sal">' + esc(j.salary) + "</span>" : "";
      const dateChip = j.date ? '<span class="date">' + esc(j.date) + "</span>" : "";
      const meta = sal || dateChip ? '<div class="rowmeta">' + sal + dateChip + "</div>" : "";
      return (
        '<div class="row" data-id="' +
        esc(j.id) +
        '">' +
        '<div class="num">' +
        esc(j.number) +
        "</div>" +
        "<div>" +
        '<div class="title">' +
        esc(j.title || "(untitled)") +
        "</div>" +
        '<div class="sub">' +
        esc(j.company || "") +
        "</div>" +
        '<div class="sub">' +
        linkHtml +
        "</div>" +
        meta +
        "</div>" +
        '<button class="del" title="Delete">✕</button>' +
        "</div>"
      );
    })
    .join("");
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

function flash(text, kind) {
  el.msg.textContent = text;
  el.msg.className = "msg " + (kind || "");
  if (text) setTimeout(() => {
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

  const jobs = await getJobs();
  // A time-independent unique id (Date.now may be unavailable in some contexts).
  const id = "j" + jobs.length + "_" + Math.floor(performance.now() * 1000).toString(36);
  jobs.push({ id, number, date, title, company, salary, link, savedAt: new Date().toISOString() });
  await setJobs(jobs);
  await setLastDate(date); // this date is inherited by the next job

  flash("Saved #" + number + ".", "ok");
  el.number.value = nextNumber(jobs); // advance the suggestion
  el.date.value = date; // keep the inherited date shown for the next save
  await refresh();
});

// Editing the date makes it the new inherited default right away.
el.date.addEventListener("change", () => setLastDate(el.date.value.trim()));

el.redetect.addEventListener("click", async () => {
  await detectAndFill(true);
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
});

el.clear.addEventListener("click", async () => {
  const jobs = await getJobs();
  if (!jobs.length) return;
  if (!confirm("Delete all " + jobs.length + " saved jobs? This can't be undone.")) return;
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
  const jobs = (await getJobs()).slice().sort(
    (a, b) => (parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0)
  );
  if (!jobs.length) return flash("Nothing to export.", "err");

  const header = ["number", "date", "position_title", "company", "job_link", "salary", "saved_at"];
  const rows = jobs.map((j) =>
    [j.number, j.date, j.title, j.company, j.link, j.salary, j.savedAt].map(csvCell).join(",")
  );
  // BOM so Excel reads UTF-8 correctly.
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

// ---- boot ------------------------------------------------------------------

(async function init() {
  // Inherit the last-used date (blank the very first time — you set it once).
  el.date.value = await getLastDate();
  await detectAndFill(true);
  await refresh();
})();
