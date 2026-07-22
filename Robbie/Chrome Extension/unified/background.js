/*
 * background.js — MV3 service worker. Owns the per-tab toolbar badge and, most
 * importantly, KEEPS a job's status once it has been shown.
 *
 * Behavior the user wants: after a tab is badged with a job status, that status
 * sticks — clicking Apply, filling a form (same page or a new page), or any
 * later page change must not wipe it. So we remember the last verdict per tab
 * and re-apply it; we only ever replace it with a *new* job verdict.
 */

let verdicts = {}; // tabId -> { badge, color }
let loaded = false;

async function ensureLoaded() {
  if (loaded) return;
  const stored = await chrome.storage.session.get("jqVerdicts");
  verdicts = stored.jqVerdicts || {};
  loaded = true;
}

function persist() {
  chrome.storage.session.set({ jqVerdicts: verdicts });
}

function applyBadge(tabId, v) {
  chrome.action.setBadgeText({ tabId, text: v ? v.badge : "" });
  if (v) {
    chrome.action.setBadgeBackgroundColor({ tabId, color: v.color || "#888888" });
    if (chrome.action.setBadgeTextColor) chrome.action.setBadgeTextColor({ tabId, color: "#ffffff" });
  }
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!sender.tab || !msg || msg.type !== "BADGE") return;
  const tabId = sender.tab.id;
  ensureLoaded().then(() => {
    if (msg.isJobPage && msg.badge) {
      // A fresh job verdict — store it and show it (replaces any prior one).
      verdicts[tabId] = { badge: msg.badge, color: msg.color };
      persist();
      applyBadge(tabId, verdicts[tabId]);
    } else if (verdicts[tabId]) {
      // Not a job page, but we already have a status for this tab → KEEP it.
      applyBadge(tabId, verdicts[tabId]);
    } else {
      applyBadge(tabId, null);
    }
  });
});

// Chrome resets a tab's badge on navigation; re-apply the stored status so it
// survives clicking Apply / moving to a form page in the same tab.
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status !== "loading" && info.status !== "complete") return;
  ensureLoaded().then(() => {
    if (verdicts[tabId]) applyBadge(tabId, verdicts[tabId]);
  });
});

// Clean up when a tab closes.
chrome.tabs.onRemoved.addListener((tabId) => {
  ensureLoaded().then(() => {
    if (verdicts[tabId]) {
      delete verdicts[tabId];
      persist();
    }
  });
});
