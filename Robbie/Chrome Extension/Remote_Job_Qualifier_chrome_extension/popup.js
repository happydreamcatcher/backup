/* popup.js — asks the active tab's content script for its verdict and renders it. */

const content = document.getElementById("content");
const footer = document.getElementById("footer");

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s == null ? "" : String(s);
  return d.innerHTML;
}

function render(result) {
  if (!result) {
    content.innerHTML =
      '<div class="verdict neutral"><span class="icon">•</span><span>No data for this page. Try reloading the tab.</span></div>';
    footer.textContent = "";
    return;
  }

  if (!result.isJobPage) {
    content.innerHTML =
      '<div class="verdict neutral"><span class="icon">•</span><span>No job posting detected on this page.</span></div>';
    footer.textContent = "The extension only rates pages that look like a single job posting.";
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
      html +=
        '<div class="reason"><div class="label">' +
        esc(r.label) +
        '</div><div class="evidence">“' +
        esc(r.evidence) +
        "”</div></div>";
    }
  }

  // Warnings (soft — don't disqualify, but worth a look)
  for (const w of warnings) {
    html +=
      '<div class="reason warn"><div class="label">⚠ ' +
      esc(w.label) +
      '</div><div class="evidence">' +
      esc(w.evidence) +
      "</div></div>";
  }

  // Posting date info
  if (result.posting) {
    const age = result.posting.ageDays;
    html +=
      '<div class="meta"><span class="datechip">🗓 Posted ' +
      (age <= 0 ? "today" : age + " day" + (age === 1 ? "" : "s") + " ago") +
      " · " +
      esc(result.posting.date && result.posting.date.slice ? result.posting.date.slice(0, 10) : new Date(result.posting.date).toISOString().slice(0, 10)) +
      "</span></div>";
  } else {
    html += '<div class="meta">🗓 Posting date not found on page — age not checked.</div>';
  }

  content.innerHTML = html;
  footer.textContent = "Checked " + new Date(result.checkedAt).toLocaleTimeString() + " · all analysis runs locally.";
}

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];
  if (!tab) return render(null);
  chrome.tabs.sendMessage(tab.id, { type: "GET_RESULT" }, (resp) => {
    if (chrome.runtime.lastError) {
      // content script not present (e.g. chrome:// page, PDF, or not loaded)
      render({ isJobPage: false });
      return;
    }
    render(resp);
  });
});
