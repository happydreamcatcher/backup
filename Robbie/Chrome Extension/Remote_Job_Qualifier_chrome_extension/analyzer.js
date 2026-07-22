/*
 * analyzer.js — pure, dependency-free job-posting rule engine.
 *
 * Everything here is plain text analysis that runs locally in your browser.
 * No data ever leaves the page. Exposes a single global: window.JobQualifier
 */
(function () {
  "use strict";

  // ---- helpers -------------------------------------------------------------

  // Words that, when they appear just before a matched phrase, negate it.
  // e.g. "no relocation required", "travel is not required", "without clearance"
  const NEGATORS = /\b(no|not|never|without|isn't|aren't|won't|don't|doesn't|free of|exempt from|excluding|rather than)\b/i;

  // Pull a readable snippet of text around a match index, for use as evidence.
  function snippet(text, index, matchLen) {
    const before = 90;
    const after = 90;
    let start = Math.max(0, index - before);
    let end = Math.min(text.length, index + matchLen + after);
    let s = text.slice(start, end).replace(/\s+/g, " ").trim();
    if (start > 0) s = "…" + s;
    if (end < text.length) s = s + "…";
    return s;
  }

  // A match is "negated" if it's cancelled out by surrounding wording, either:
  //  - BEFORE it:  "no relocation", "without travel", "does not require relocation"
  //  - AFTER it:   "relocation is not required", "travel is not required", "... is optional"
  function isNegated(text, index, matchLen) {
    const before = text.slice(Math.max(0, index - 40), index);
    if (NEGATORS.test(before)) return true;
    // Look a short window AFTER the keyword for "(is) not required / optional".
    const after = text.slice(index + matchLen, index + matchLen + 26);
    if (/\b(?:not|no|never|isn'?t|aren'?t|no\s+longer)\s+(?:be\s+)?(?:required|expected|necessary|needed|mandatory)\b/i.test(after))
      return true;
    if (/\b(?:is|are)\s+(?:not\s+)?optional\b/i.test(after)) return true;
    return false;
  }

  // Find the first non-negated match for any pattern in a rule.
  function findMatch(text, patterns) {
    for (const re of patterns) {
      re.lastIndex = 0;
      const m = re.exec(text);
      if (m && !isNegated(text, m.index, m[0].length)) {
        return { text: m[0], index: m.index };
      }
    }
    return null;
  }

  // ---- rule definitions ----------------------------------------------------
  // Each rule: id, label (shown to user), and patterns to search for.
  // Patterns are intentionally "qualified" (require context) where a bare
  // keyword would over-trigger — e.g. "travel" or "clearance" alone.
  const RULES = [
    {
      id: "location",
      label: "On-site / hybrid / in-person / relocation",
      patterns: [
        /\bon[-\s]?site\b/i,
        /\bin[-\s]?office\b/i,
        /\bhybrid\s*(?:remote|work\w*|schedule|role|position|model|office|arrangement|setup|environment|—|-|\()/i,
        /\bhybrid\b(?![-\s]?(?:cloud|app|apps|mobile|framework|vehicle|car|integration|architecture))/i,
        /\bin[-\s]person\b/i,
        /\brelocat(?:e|es|ing|ion)\b/i,
        /\b(?:commutable\s+distance|daily\s+commute|commute\s+to\s+(?:the\s+)?(?:office|site)|must\s+commute|able\s+to\s+commute)\b/i,
      ],
    },
    {
      id: "clearance",
      label: "Security clearance / public trust",
      patterns: [
        /\bsecurity\s+clearance\b/i,
        /\bpublic\s+trust\b/i,
        /\b(?:secret|top\s+secret|ts\/sci|active|dod|government)\s+clearance\b/i,
        /\bclearance\s+(?:is\s+)?required\b/i,
        /\bactive\s+.{0,15}\bclearance\b/i,
        /\bpolygraph\b/i,
      ],
    },
    {
      id: "unpaid",
      label: "Volunteer / unpaid",
      patterns: [/\bvolunteer\b/i, /\bunpaid\b/i, /\bpro\s+bono\b/i, /\bno\s+compensation\b/i],
    },
  ];

  // Soft rules — these do NOT disqualify a job. They surface as amber "verify"
  // warnings, because the job is genuinely remote but has a catch worth a
  // human glance (e.g. it only hires in certain states — fine if you're in one).
  const WARN_RULES = [
    {
      id: "georestrict",
      label: "Remote, but has a location/state restriction — verify you're eligible",
      patterns: [
        /\bmust\s+(?:live|reside|be\s+(?:located|based))\b/i,
        /\bopen\s+(?:only\s+)?to\s+(?:candidates|applicants|residents)\s+(?:who\s+(?:live|reside)|located|residing|in|based)\b/i,
        /\b(?:residing|located|reside)\s+in\s+(?:the\s+following|one\s+of|certain)\b/i,
        /\beligible\s+states?\b/i,
      ],
    },
  ];

  // ---- travel logic (custom, number-aware) --------------------------------
  // Per the user's rule, the MINIMUM travel is what matters:
  //   • explicit range starting at 0  ("0-5%", "0-15%")   → OK  (can be 0 travel)
  //   • "up to X%"                                        → FLAG (stated requirement)
  //   • range starting above 0 ("10-15%") / single "25%"  → FLAG
  //   • "travel required / ability to travel / …"         → FLAG (no % given)
  //   • bare "travel" as a perk ("travel reimbursement")  → ignored
  function mkTravel(text, idx) {
    return { rule: "travel", label: "Travel requirement", evidence: snippet(text, idx, 6) };
  }
  function travelIssue(text) {
    const re = /travel/gi;
    let m;
    while ((m = re.exec(text)) !== null) {
      const idx = m.index;
      if (isNegated(text, idx, 6)) continue; // "no travel", "travel is not required"
      const around = text.slice(Math.max(0, idx - 35), idx + 50);

      // "up to X%" — a real requirement, even though its floor is 0.
      if (/\bup\s+to\s+\d{1,3}\s?%/i.test(around)) return mkTravel(text, idx);

      // Explicit range "A-B%" / "A to B%": the minimum is A.
      const range = around.match(/(\d{1,3})\s*(?:[-–—]|to)\s*(\d{1,3})\s*%/i);
      if (range) {
        if (parseInt(range[1], 10) > 0) return mkTravel(text, idx);
        continue; // starts at 0% → acceptable; keep scanning other mentions
      }

      // Single percentage near "travel": "25% travel" / "travel 25%".
      const single = around.match(/(\d{1,3})\s*%/);
      if (single) {
        if (parseInt(single[1], 10) > 0) return mkTravel(text, idx);
        continue; // 0% → acceptable
      }

      // Travel named with a requirement word but no percentage.
      if (
        /\b(required|expected|necessary|mandatory|must|ability|able|willing|willingness|occasional|frequent|regular|periodic)\b/i.test(
          around
        )
      )
        return mkTravel(text, idx);

      // else: bare "travel" with no % and no requirement word → not a flag.
    }
    return null;
  }

  // Does the posting offer a genuine FULLY-REMOTE US option? If so, an
  // on-site/hybrid/relocation mention is just the alternative for people near
  // the office (e.g. "Palo Alto, CA (Hybrid) / Remote (U.S.)") — not a reason
  // to disqualify, because the user can take the remote option.
  // Note: "hybrid remote" / "remote work stipend" do NOT count — we require a
  // remote option tied to the US (or "fully/100% remote").
  function hasRemoteUsOption(text) {
    const patterns = [
      /\bremote\b[\s\-—/,(]*\(?\s*(?:u\.?\s?s\.?(?:a\.?)?|united\s+states|usa|anywhere)/i,
      /\b(?:fully|100%|full[-\s]?time)\s+remote\b/i,
      /\bu\.?\s?s\.?[\s\-]*(?:based\s+)?remote\b/i,
      /\bremote\s*[-—/]\s*u\.?\s?s\.?/i,
    ];
    for (const re of patterns) {
      re.lastIndex = 0;
      const m = re.exec(text);
      if (!m) continue;
      if (isNegated(text, m.index, m[0].length)) continue;
      const after = text.slice(m.index, m.index + m[0].length + 30);
      if (/\b(not\s+available|unavailable|not\s+an?\s+option|not\s+offered|is\s+not)\b/i.test(after)) continue;
      return true;
    }
    return false;
  }

  // ---- posting-date detection ---------------------------------------------

  // Try JSON-LD JobPosting.datePosted first (most reliable — most ATS embed it).
  function dateFromJsonLd(doc) {
    const blocks = doc.querySelectorAll('script[type="application/ld+json"]');
    for (const b of blocks) {
      let data;
      try {
        data = JSON.parse(b.textContent);
      } catch (e) {
        continue;
      }
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        const graph = item && item["@graph"] ? item["@graph"] : [item];
        for (const node of graph) {
          if (!node || typeof node !== "object") continue;
          const type = node["@type"];
          const isJob = type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"));
          if (isJob && node.datePosted) {
            const d = new Date(node.datePosted);
            if (!isNaN(d)) return { date: d, source: "hidden page metadata (datePosted)" };
          }
        }
      }
    }
    return null;
  }

  // Fallback: relative / absolute date phrases in visible text.
  // Flexible parsing of a posting date from visible page text.
  // Strategy: relative phrases ("5 days ago") are unambiguous → scanned anywhere.
  // Absolute dates are trusted ONLY next to a "Posted"-type label, so we never
  // mistake a random date in the description (e.g. "5+ years", "© 2026") for the
  // posting date.
  function dateFromText(text, now) {
    // ---- 1. Relative: "X hours/days/weeks/months/years ago" (optional "+") ----
    let m = text.match(/(\d+)\s*\+?\s*(hour|day|week|month|year)s?\s+ago/i);
    if (m) {
      const n = parseInt(m[1], 10);
      const unit = m[2].toLowerCase();
      const mult = unit === "hour" ? 0 : unit === "day" ? 1 : unit === "week" ? 7 : unit === "month" ? 30 : 365;
      return { date: new Date(now.getTime() - n * mult * 86400000), source: `text: "${m[0]}"` };
    }

    // ---- 2. "today" / "moments/hours ago" / "yesterday" ----
    if (/(?:posted|listed|reposted)\s+(?:just\s+)?today|just\s+posted|posted\s+moments?\s+ago|posted\s+(?:an?|\d+)\s+hours?\s+ago/i.test(text)) {
      return { date: new Date(now), source: "text: posted today" };
    }
    if (/(?:posted|listed|reposted)\s+yesterday/i.test(text)) {
      return { date: new Date(now.getTime() - 86400000), source: 'text: "posted yesterday"' };
    }

    // ---- 3. Absolute dates, anchored to a Posted-type label ----
    // label = posted / reposted / date posted / posted on / listed / published on
    const LABEL = "(?:re-?posted|date\\s+posted|posted\\s+date|posted|listed|published)(?:\\s+on)?[:\\s]+";
    const FORMATS = [
      "[A-Za-z]{3,9}\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4}", // March 15, 2026 / Mar 15 2026 / 15th
      "\\d{1,2}(?:st|nd|rd|th)?\\s+[A-Za-z]{3,9}\\.?,?\\s+\\d{4}", // 15 March 2026 / 15th Mar, 2026
      "\\d{4}-\\d{2}-\\d{2}", // 2026-03-15 (ISO)
      "\\d{1,2}/\\d{1,2}/\\d{4}", // 03/15/2026 (US m/d/y)
    ];
    for (const fmt of FORMATS) {
      m = text.match(new RegExp(LABEL + "(" + fmt + ")", "i"));
      if (m) {
        const d = new Date(m[1].replace(/(\d)(st|nd|rd|th)/i, "$1")); // strip ordinals
        if (!isNaN(d)) return { date: d, source: `text: "${m[0].trim().replace(/\s+/g, " ")}"` };
      }
    }
    return null;
  }

  function daysBetween(a, b) {
    return Math.floor((a.getTime() - b.getTime()) / 86400000);
  }

  // ---- job-page detection --------------------------------------------------
  // Decide whether this page even looks like a single job posting, so we don't
  // badge random websites.
  const ATS_HOST = /(ashbyhq|myworkday(jobs)?|workday|workable|greenhouse|lever\.co|jobs\.|careers?\.|bamboohr|smartrecruiters|jobvite|icims|recruitee|breezy|rippling|gem\.com|ashby)/i;

  function looksLikeJobPage(doc, text, url) {
    if (dateFromJsonLd(doc)) return true;
    if (doc.querySelector('script[type="application/ld+json"]')) {
      // has JSON-LD; check for JobPosting quickly
      if (/"@type"\s*:\s*"?JobPosting/i.test(doc.documentElement.innerHTML)) return true;
    }
    let host = "";
    try {
      host = new URL(url).hostname;
    } catch (e) {}
    const atsHost = ATS_HOST.test(host);
    const applySignal = /\bapply\s+(for\s+this\s+job|now|for\s+this\s+role)\b/i.test(text) || /\bapply\b/i.test(text);
    const jobSignal =
      /\bjob\s+description\b/i.test(text) ||
      (/\bresponsibilities\b/i.test(text) && /\bqualifications\b/i.test(text)) ||
      /\bwhat\s+you'?ll\s+do\b/i.test(text) ||
      /\bemployment\s+type\b/i.test(text);
    if (atsHost && applySignal) return true;
    if (jobSignal && applySignal) return true;
    return false;
  }

  // ---- main analyze --------------------------------------------------------
  function analyze(doc, opts) {
    opts = opts || {};
    const now = opts.now || new Date();
    const url = opts.url || (doc.location && doc.location.href) || "";
    const bodyText = (doc.body && doc.body.innerText) || "";
    const title = (doc.title || "") + " " + (doc.querySelector("h1") ? doc.querySelector("h1").innerText : "");
    const text = title + "\n" + bodyText;

    if (!looksLikeJobPage(doc, text, url)) {
      return { isJobPage: false };
    }

    const reasons = [];
    const warnings = [];

    // Hard keyword rules — any hit disqualifies the job.
    const remoteUsOption = hasRemoteUsOption(text);
    for (const rule of RULES) {
      // If a fully-remote US option is offered, on-site/hybrid/relocation is
      // just the alternative arrangement — skip the location rule.
      if (rule.id === "location" && remoteUsOption) continue;
      const hit = findMatch(text, rule.patterns);
      if (hit) {
        reasons.push({
          rule: rule.id,
          label: rule.label,
          evidence: snippet(text, hit.index, hit.text.length),
        });
      }
    }

    // Travel — custom, number-aware (a range starting at 0% is acceptable).
    const tIssue = travelIssue(text);
    if (tIssue) reasons.push(tIssue);

    // Soft rules — surface as warnings, don't disqualify.
    for (const rule of WARN_RULES) {
      const hit = findMatch(text, rule.patterns);
      if (hit) {
        warnings.push({
          rule: rule.id,
          label: rule.label,
          evidence: snippet(text, hit.index, hit.text.length),
        });
      }
    }

    // Date rule — only HARD-reject on a date the user can actually SEE on the
    // page. A date that lives only in hidden page metadata (JSON-LD datePosted)
    // becomes a soft "verify" warning instead, so a good job is never silently
    // dropped over an invisible/possibly-default date. Pages with no date at
    // all are simply not checked (many ATS pages don't show one).
    let found = dateFromJsonLd(doc);
    let visible = false;
    if (!found) {
      found = dateFromText(text, now);
      visible = !!found;
    }
    let posting = null;
    if (found) {
      const age = daysBetween(now, found.date);
      const iso = found.date.toISOString().slice(0, 10);
      posting = { date: found.date, ageDays: age, source: found.source, visible };
      const src = visible ? found.source : `${found.source}, not shown on page`;
      if (age >= 30) {
        // Old posting → hard disqualify.
        reasons.push({
          rule: "stale",
          label: "Posted 30+ days ago",
          evidence: `Posted ${age} days ago (${iso}) — from ${src}`,
        });
      } else if (age >= 7) {
        // 7–29 days → amber: might be a repost of an older req, verify freshness.
        warnings.push({
          rule: "stale-maybe",
          label: "Posted 7–30 days ago — verify it's fresh",
          evidence: `Posted ${age} days ago (${iso}) — from ${src}. Could be a repost of an older listing; double-check.`,
        });
      }
    }

    return {
      isJobPage: true,
      qualified: reasons.length === 0,
      hasWarnings: warnings.length > 0,
      reasons,
      warnings,
      posting,
      dateKnown: !!found,
      checkedAt: now.toISOString(),
      url,
    };
  }

  window.JobQualifier = { analyze, RULES };
})();
