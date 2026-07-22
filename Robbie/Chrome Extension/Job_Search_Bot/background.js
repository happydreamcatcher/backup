// Background service worker.
// Purpose: whenever the Apply click opens a NEW tab (which steals focus),
// immediately switch focus back to the Jobright list tab. This does two things:
//   1) Fulfills the "go back to Jobright" requirement automatically.
//   2) Keeps the Jobright tab in the foreground so Chrome does NOT throttle
//      the bot's timers (background tabs get heavily throttled).

let botRunning = false;
let jobrightTabId = null;
let jobrightWindowId = null;

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || !msg.type) return;

  if (msg.type === "bot-start") {
    botRunning = true;
    if (sender.tab) {
      jobrightTabId = sender.tab.id;
      jobrightWindowId = sender.tab.windowId;
    }
  } else if (msg.type === "bot-stop") {
    botRunning = false;
  } else if (msg.type === "bot-heartbeat") {
    // Refresh which tab is the Jobright tab in case the user reloaded it.
    if (sender.tab) {
      jobrightTabId = sender.tab.id;
      jobrightWindowId = sender.tab.windowId;
    }
  }
});

// When a new tab is created while the bot is running, snap focus back to Jobright.
chrome.tabs.onCreated.addListener(() => {
  if (!botRunning || jobrightTabId == null) return;
  // Small delay so the new tab fully registers, then re-focus Jobright.
  setTimeout(() => {
    try {
      chrome.tabs.update(jobrightTabId, { active: true }, () => void chrome.runtime.lastError);
      if (jobrightWindowId != null) {
        chrome.windows.update(jobrightWindowId, { focused: true }, () => void chrome.runtime.lastError);
      }
    } catch (e) {
      // ignore
    }
  }, 250);
});

// If the Jobright tab goes away, stop tracking it.
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === jobrightTabId) {
    jobrightTabId = null;
    botRunning = false;
  }
});
