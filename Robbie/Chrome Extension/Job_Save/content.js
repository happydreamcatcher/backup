/*
 * content.js — thin bridge between the page and the popup.
 *
 * The popup asks "what job is on this page?" and we answer with the freshly
 * extracted fields. Extraction is cheap and always run on demand, so SPA
 * ATSes that render late (Ashby, Workday, Lever) still give a current answer
 * whenever the user opens the popup.
 */
(function () {
  "use strict";

  function currentInfo() {
    try {
      return window.JobInfo.extract(document, { url: location.href });
    } catch (e) {
      return { title: "", company: "", salary: "", link: location.href, error: String(e) };
    }
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === "GET_JOB_INFO") {
      sendResponse(currentInfo());
    }
    return true;
  });
})();
