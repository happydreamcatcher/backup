// ============================================================================
// Jobright Auto Apply Clicker  —  content script
// Loop: find topmost Apply button -> click (opens job in new tab) ->
//       wait for "Did you apply?" popup -> click "Yes, I applied!" ->
//       wait for the card to disappear (~3s) -> repeat.
// Runs for a chosen number of minutes, or until you press STOP.
// ============================================================================

(() => {
  "use strict";
  if (window.__jrBotLoaded) return;      // avoid double injection
  window.__jrBotLoaded = true;

  // ------------------------- Tunable timings (ms) ---------------------------
  const CONFIG = {
    popupWaitMs: 10000,     // how long to wait for the "Did you apply?" popup
    cardGoneWaitMs: 6000,   // max wait for the applied card to disappear
    scrollStepPx: 400,      // scroll amount when no apply button is visible
    settleAfterClickMs: 600 // brief pause right after clicking Apply
  };

  // ------------------------- Selectors --------------------------------------
  const SEL = {
    scrollList: '[class*="jobs-list-scrollable"]',
    card: '[class*="job-card__"]',
    applyBtn: 'button[class*="apply-button"]',
    popupYes: 'button[class*="apply-confirm-popup-yes-button"]'
  };

  // ------------------------- Bot state --------------------------------------
  const state = {
    running: false,
    endTime: 0,
    delayMs: 5000,
    appliedCount: 0,
    appliedIds: new Set(),
    lastAction: "idle"
  };

  // ------------------------- Small helpers ----------------------------------
  const now = () => Date.now();

  // Sleep that wakes up early if the bot is stopped or time runs out.
  function sleep(ms) {
    return new Promise((resolve) => {
      const start = now();
      const tick = () => {
        if (!state.running) return resolve();
        if (now() - start >= ms) return resolve();
        if (now() >= state.endTime) return resolve();
        setTimeout(tick, 100);
      };
      tick();
    });
  }

  function isVisible(el) {
    if (!el) return false;
    if (el.offsetParent === null) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function getScrollRoot() {
    return document.querySelector(SEL.scrollList) || document.scrollingElement || document.body;
  }

  // Poll for an element matching selector to appear & be visible.
  function waitFor(selector, timeoutMs) {
    return new Promise((resolve) => {
      const start = now();
      const tick = () => {
        if (!state.running) return resolve(null);
        const el = document.querySelector(selector);
        if (el && isVisible(el)) return resolve(el);
        if (now() - start >= timeoutMs) return resolve(null);
        setTimeout(tick, 200);
      };
      tick();
    });
  }

  // Wait until the card with this id is removed from the DOM (or timeout).
  function waitForCardGone(id, timeoutMs) {
    return new Promise((resolve) => {
      const start = now();
      const tick = () => {
        if (!state.running) return resolve();
        const el = id ? document.getElementById(id) : null;
        if (!el) return resolve();
        if (now() - start >= timeoutMs) return resolve();
        setTimeout(tick, 150);
      };
      tick();
    });
  }

  // Find the topmost Apply button whose card we haven't applied to yet.
  function findNextApply() {
    const root = getScrollRoot();
    const btns = Array.from(root.querySelectorAll(SEL.applyBtn));
    const candidates = [];
    for (const btn of btns) {
      if (!isVisible(btn) || btn.disabled) continue;
      const txt = (btn.textContent || "").trim().toLowerCase();
      if (!txt.startsWith("apply")) continue;           // "APPLY NOW" / "Apply with Autofill"
      const card = btn.closest(SEL.card);
      const id = card ? card.id : null;
      if (id && state.appliedIds.has(id)) continue;     // already handled this card
      candidates.push({ btn, id, top: btn.getBoundingClientRect().top });
    }
    candidates.sort((a, b) => a.top - b.top);           // topmost first
    return candidates[0] || null;
  }

  // ------------------------- The main loop ----------------------------------
  async function runLoop() {
    let emptyTries = 0;

    while (state.running && now() < state.endTime) {
      const next = findNextApply();

      if (!next) {
        // No apply button rendered right now — scroll a little to load more.
        emptyTries++;
        setStatus("searching… (scrolling)");
        getScrollRoot().scrollBy(0, CONFIG.scrollStepPx);
        await sleep(1200);
        if (emptyTries > 8) {           // give the list time to refill
          setStatus("waiting for new jobs…");
          await sleep(3000);
          emptyTries = 0;
        }
        continue;
      }
      emptyTries = 0;

      const { btn, id } = next;
      if (id) state.appliedIds.add(id);

      // Bring the button into view and click it.
      try { btn.scrollIntoView({ block: "center", behavior: "instant" }); } catch (_) {}
      await sleep(CONFIG.settleAfterClickMs);
      if (!state.running) break;

      setStatus("clicking Apply…");
      btn.click();                      // opens the job in a new tab + triggers the popup
      state.appliedCount++;
      updatePanel();

      // Tell the background worker a new tab is about to appear (keeps focus here).
      chrome.runtime.sendMessage({ type: "bot-heartbeat" });

      // Wait for the "Did you apply?" popup, then confirm "Yes, I applied!".
      setStatus("waiting for popup…");
      const yes = await waitFor(SEL.popupYes, CONFIG.popupWaitMs);
      if (yes) {
        setStatus("clicking 'Yes, I applied'…");
        yes.click();
      } else {
        setStatus("popup not found — skipping");
      }

      // Wait for the applied card to disappear (~3s), then the between-jobs delay.
      setStatus("waiting for card to clear…");
      await waitForCardGone(id, CONFIG.cardGoneWaitMs);
      if (!state.running) break;

      setStatus("cooldown…");
      await sleep(state.delayMs);
    }

    stopBot(state.running ? "time's up" : "stopped");
  }

  // ------------------------- Start / Stop -----------------------------------
  function startBot() {
    if (state.running) return;
    const mins = parseFloat(document.getElementById("jr-minutes").value);
    const secs = parseFloat(document.getElementById("jr-delay").value);
    if (!(mins > 0)) { setStatus("enter minutes > 0"); return; }

    state.running = true;
    state.endTime = now() + mins * 60 * 1000;
    state.delayMs = (secs > 0 ? secs : 5) * 1000;
    state.appliedCount = 0;
    state.appliedIds.clear();

    chrome.runtime.sendMessage({ type: "bot-start" });
    document.getElementById("jr-start").disabled = true;
    document.getElementById("jr-stop").disabled = false;
    setStatus("running");
    updatePanel();
    runLoop();
  }

  function stopBot(reason) {
    const wasRunning = state.running;
    state.running = false;
    chrome.runtime.sendMessage({ type: "bot-stop" });
    const startBtn = document.getElementById("jr-start");
    const stopBtn = document.getElementById("jr-stop");
    if (startBtn) startBtn.disabled = false;
    if (stopBtn) stopBtn.disabled = true;
    if (wasRunning || reason) setStatus("stopped" + (reason ? " (" + reason + ")" : ""));
    updatePanel();
  }

  // ------------------------- Floating control panel -------------------------
  function setStatus(txt) { state.lastAction = txt; updatePanel(); }

  function fmt(ms) {
    if (ms < 0) ms = 0;
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return String(m).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
  }

  function updatePanel() {
    const rem = document.getElementById("jr-remaining");
    const cnt = document.getElementById("jr-count");
    const st = document.getElementById("jr-status");
    if (!rem) return;
    rem.textContent = state.running ? fmt(state.endTime - now()) : "--:--";
    cnt.textContent = state.appliedCount;
    st.textContent = state.lastAction;
  }

  function buildPanel() {
    const style = document.createElement("style");
    style.textContent = `
      #jr-bot-panel{position:fixed;bottom:16px;right:16px;width:230px;z-index:2147483647;
        font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:12px;color:#e8f7f0;
        background:#0f1720;border:1px solid #1f2d3a;border-radius:12px;
        box-shadow:0 8px 28px rgba(0,0,0,.45);overflow:hidden;user-select:none}
      #jr-bot-head{display:flex;align-items:center;gap:6px;padding:9px 11px;cursor:move;
        background:linear-gradient(90deg,#00f0a0,#17baff);color:#062018;font-weight:700}
      #jr-bot-body{padding:11px}
      .jr-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
      .jr-row label{opacity:.85}
      .jr-row input{width:64px;padding:4px 6px;border-radius:6px;border:1px solid #2a3a48;
        background:#0b1219;color:#e8f7f0;font-size:12px}
      .jr-btns{display:flex;gap:8px;margin:4px 0 10px}
      .jr-btns button{flex:1;padding:8px 0;border:none;border-radius:8px;font-weight:700;
        cursor:pointer;font-size:12px}
      #jr-start{background:#00f0a0;color:#062018}
      #jr-stop{background:#ff4d5e;color:#fff}
      .jr-btns button:disabled{opacity:.45;cursor:not-allowed}
      .jr-stat{display:flex;justify-content:space-between;padding:3px 0;border-top:1px solid #1b2732}
      .jr-stat b{color:#7ff5cf;font-variant-numeric:tabular-nums}
      #jr-status{color:#bcd;font-style:italic;margin-top:6px;min-height:16px;word-break:break-word}
    `;
    document.documentElement.appendChild(style);

    const p = document.createElement("div");
    p.id = "jr-bot-panel";
    p.innerHTML = `
      <div id="jr-bot-head">🤖 Jobright Bot <span style="margin-left:auto;font-size:10px;opacity:.7">drag</span></div>
      <div id="jr-bot-body">
        <div class="jr-row"><label>Run for</label><span><input id="jr-minutes" type="number" min="1" value="10"> min</span></div>
        <div class="jr-row"><label>Delay / job</label><span><input id="jr-delay" type="number" min="1" value="5"> sec</span></div>
        <div class="jr-btns">
          <button id="jr-start">▶ Start</button>
          <button id="jr-stop" disabled>■ Stop</button>
        </div>
        <div class="jr-stat"><span>Time left</span><b id="jr-remaining">--:--</b></div>
        <div class="jr-stat"><span>Applied</span><b id="jr-count">0</b></div>
        <div id="jr-status">idle</div>
      </div>`;
    document.documentElement.appendChild(p);

    document.getElementById("jr-start").addEventListener("click", startBot);
    document.getElementById("jr-stop").addEventListener("click", () => stopBot("manual"));

    makeDraggable(p, document.getElementById("jr-bot-head"));

    // Tick the countdown once a second.
    setInterval(() => { if (state.running) updatePanel(); }, 1000);
  }

  function makeDraggable(panel, handle) {
    let dx = 0, dy = 0, dragging = false;
    handle.addEventListener("mousedown", (e) => {
      dragging = true;
      const r = panel.getBoundingClientRect();
      dx = e.clientX - r.left; dy = e.clientY - r.top;
      e.preventDefault();
    });
    document.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      panel.style.left = (e.clientX - dx) + "px";
      panel.style.top = (e.clientY - dy) + "px";
      panel.style.right = "auto";
      panel.style.bottom = "auto";
    });
    document.addEventListener("mouseup", () => { dragging = false; });
  }

  // ------------------------- Boot -------------------------------------------
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildPanel);
  } else {
    buildPanel();
  }
})();
