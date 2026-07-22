/*
 * content.js — runs on every page. Analyzes the page, tells the background
 * worker what badge to show, and answers the popup's request for details.
 *
 * Handles single-page-app ATSes (Ashby, Workday, Lever) that render job
 * content after load and change routes without a full reload.
 */
(function () {
  "use strict";

  let latestResult = null;
  let lastKey = ""; // url + text length, to skip redundant re-analysis
  let debounceTimer = null;

  // Once we've shown a job status for a given page, we LOCK it: filling out an
  // application form on the same page (or any later DOM change) must NOT change
  // or clear the badge. The lock is keyed by pathname, so genuinely navigating
  // to a *different* job (different path, common on SPA ATSes) still re-checks.
  let lockedPath = null;

  function run() {
    // Respect the lock: keep the status we already showed for this page.
    if (lockedPath !== null && location.pathname === lockedPath) return;

    let result;
    try {
      result = window.JobQualifier.analyze(document, {
        now: new Date(),
        url: location.href,
      });
    } catch (e) {
      result = { isJobPage: false, error: String(e) };
    }
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

  // Popup asks for the current verdict.
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === "GET_RESULT") {
      sendResponse(latestResult);
    }
    return true;
  });
})();
