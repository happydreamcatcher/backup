/*
 * content.js — the single content script for the unified extension.
 *
 * It combines what used to be two separate scripts:
 *   • Remote Job Qualifier — analyzes the page (analyzer.js) and drives the
 *     toolbar badge (green / amber / red).
 *   • Job Saver — extracts the page's job fields (detector.js) for the popup.
 *
 * It ALSO adds the new duplicate-application rule: if the current page's
 * company is one you've already SAVED (= applied to), the verdict is forced to
 * red — on top of whatever the normal rules say — and an extra reason is shown.
 *
 * Handles single-page-app ATSes (Ashby, Workday, Lever) that render job content
 * after load and change routes without a full reload.
 */
(function () {
  "use strict";

  const STORE_KEY = "savedJobs"; // Job Saver's DAILY list (exported + cleared).
  const APPLIED_KEY = "appliedCompanies"; // PERMANENT, cumulative applied ledger.

  let latestResult = null; // last qualifier verdict (augmented with duplicate)
  let lastKey = ""; // url + text length, to skip redundant re-analysis
  let debounceTimer = null;

  // Once we've shown a job status for a given page, we LOCK it: filling out an
  // application form on the same page (or any later DOM change) must NOT change
  // or clear the badge. The lock is keyed by pathname, so genuinely navigating
  // to a *different* job (different path, common on SPA ATSes) still re-checks.
  let lockedPath = null;

  // ---- applied-company database (permanent, cumulative) --------------------
  // The duplicate check reads the PERMANENT ledger, NOT the daily saved list.
  // The ledger keeps every company ever applied to (even months ago) and is
  // never wiped by the daily "Clear all". Keys are normalized company keys
  // (same normCompany the popup writes with); each value carries the "when":
  // { company, firstDate, lastDate, count, lastAppliedAt }.
  function getAppliedMap() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(APPLIED_KEY, (r) => resolve((r && r[APPLIED_KEY]) || {}));
      } catch (e) {
        resolve({});
      }
    });
  }

  // Build the "when did I apply" tail shown in the duplicate reason.
  function appliedWhen(rec) {
    const bits = [];
    if (rec.firstDate) bits.push("first applied " + rec.firstDate);
    if (rec.count > 1 && rec.lastDate && rec.lastDate !== rec.firstDate) bits.push("last " + rec.lastDate);
    if (rec.count > 1) bits.push(rec.count + " applications");
    return bits.length ? " (" + bits.join(", ") + ")" : "";
  }

  // Run the qualifier, then layer the duplicate-company check on top.
  async function analyzeNow() {
    let result;
    try {
      result = window.JobQualifier.analyze(document, { now: new Date(), url: location.href });
    } catch (e) {
      result = { isJobPage: false, error: String(e) };
    }

    // Detect the company so we can compare it against the applied database.
    let info = null;
    try {
      info = window.JobInfo.extract(document, { url: location.href });
    } catch (e) {
      info = null;
    }
    if (info) result.company = info.company;

    // Duplicate-application rule: same company you already saved → force red.
    if (result.isJobPage && info && info.company) {
      const key = window.JobInfo.normCompany(info.company);
      if (key) {
        const map = await getAppliedMap();
        const rec = map[key];
        if (rec) {
          const name = rec.company || info.company;
          result.reasons = result.reasons || [];
          if (!result.reasons.some((r) => r.rule === "duplicate")) {
            // Put it first — it's the most important reason to skip this job.
            result.reasons.unshift({
              rule: "duplicate",
              label: "Already applied to this company",
              evidence: 'You already applied to "' + name + '"' + appliedWhen(rec) + ". Skip duplicate applications.",
            });
          }
          result.qualified = false;
          result.alreadyApplied = true;
          // Carry the "when" details so the popup can show them too.
          result.appliedInfo = {
            company: name,
            firstDate: rec.firstDate || "",
            lastDate: rec.lastDate || "",
            count: rec.count || 1,
            lastAppliedAt: rec.lastAppliedAt || "",
          };
        }
      }
    }

    return result;
  }

  async function run() {
    // Respect the lock: keep the status we already showed for this page.
    if (lockedPath !== null && location.pathname === lockedPath) return;

    const result = await analyzeNow();
    latestResult = result;

    // Tell the service worker how to badge this tab.
    let badge = "";
    let color = "#888888";
    if (result.isJobPage) {
      if (result.qualified) {
        if (result.hasWarnings) {
          badge = "!";
          color = "#bf8700"; // amber — qualified but something to verify
        } else {
          badge = "✓";
          color = "#1a7f37"; // green
        }
      } else if (result.alreadyApplied) {
        // Distinct badge: this is a company you've already applied to, so you
        // can tell it apart from an ordinary rule failure at a glance.
        badge = "DUP";
        color = "#cf222e"; // red
      } else {
        badge = String(result.reasons.length); // number of failed rules
        color = "#cf222e"; // red
      }
      // We have a real verdict for this page — freeze it.
      lockedPath = location.pathname;
    }
    try {
      chrome.runtime.sendMessage({ type: "BADGE", badge, color, isJobPage: !!result.isJobPage });
    } catch (e) {
      /* worker may be asleep; harmless */
    }
  }

  function scheduleRun() {
    // If this page's status is locked, do nothing — keep the badge as-is.
    if (lockedPath !== null && location.pathname === lockedPath) return;
    const key = location.href + "|" + ((document.body && document.body.innerText.length) || 0);
    if (key === lastKey) return;
    lastKey = key;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(run, 600);
  }

  // Initial pass.
  run();

  // Re-analyze as SPA content streams in.
  const observer = new MutationObserver(scheduleRun);
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  // Re-analyze on client-side navigation (pushState / replaceState / back).
  ["pushState", "replaceState"].forEach((fn) => {
    const orig = history[fn];
    history[fn] = function () {
      const r = orig.apply(this, arguments);
      setTimeout(scheduleRun, 50);
      return r;
    };
  });
  window.addEventListener("popstate", () => setTimeout(scheduleRun, 50));

  // When the permanent applied ledger changes (e.g. you just saved or imported
  // THIS company), re-evaluate this tab even if it was locked, so the badge can
  // flip to red immediately.
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes[APPLIED_KEY]) {
        lockedPath = null;
        lastKey = "";
        run();
      }
    });
  } catch (e) {
    /* storage may be unavailable in some frames; harmless */
  }

  // Popup requests.
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === "GET_RESULT") {
      // The qualifier verdict (already includes the duplicate reason if any).
      sendResponse(latestResult);
    } else if (msg && msg.type === "GET_JOB_INFO") {
      // Fresh extract on demand — cheap, and correct for late-rendering SPAs.
      try {
        sendResponse(window.JobInfo.extract(document, { url: location.href }));
      } catch (e) {
        sendResponse({ title: "", company: "", salary: "", link: location.href, error: String(e) });
      }
    }
    return true;
  });
})();
