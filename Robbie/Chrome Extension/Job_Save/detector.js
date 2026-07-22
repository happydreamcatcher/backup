/*
 * detector.js — pure, dependency-free job-info extractor.
 *
 * Runs locally in the page. Pulls out the fields you want to save:
 *   • title    — the position/role name
 *   • company  — the hiring organization
 *   • salary   — a sanity-checked pay figure (empty when the page has none)
 *
 * Strategy for every field: trust the page's structured data
 * (JSON-LD JobPosting) first — most ATSes embed it — then fall back to
 * <meta> tags, headings, and finally the visible text / URL.
 *
 * Exposes a single global: window.JobInfo
 */
(function () {
  "use strict";

  // ---- generic helpers -----------------------------------------------------

  function clean(s) {
    return (s == null ? "" : String(s)).replace(/\s+/g, " ").trim();
  }

  function metaContent(doc, selector) {
    const el = doc.querySelector(selector);
    return el ? clean(el.getAttribute("content")) : "";
  }

  // Walk every JSON-LD block and hand each node to `visit`. Handles arrays and
  // @graph wrappers, the two shapes ATSes actually use.
  function eachJsonLdNode(doc, visit) {
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
        if (!item || typeof item !== "object") continue;
        const graph = item["@graph"] ? item["@graph"] : [item];
        for (const node of graph) {
          if (node && typeof node === "object") visit(node);
        }
      }
    }
  }

  function isJobPostingNode(node) {
    const t = node["@type"];
    return t === "JobPosting" || (Array.isArray(t) && t.includes("JobPosting"));
  }

  function firstJobPosting(doc) {
    let found = null;
    eachJsonLdNode(doc, (node) => {
      if (!found && isJobPostingNode(node)) found = node;
    });
    return found;
  }

  // ---- title ---------------------------------------------------------------

  // Company/site suffixes commonly tacked onto <title>: "Senior Eng - Acme",
  // "Senior Eng | Careers at Acme". Strip the trailing site part.
  function stripTitleSuffix(s) {
    // Cut at the first " | ", " - ", " – ", " — ", " at " boundary when what
    // follows looks like a site/company tail, not part of the role name.
    const parts = s.split(/\s+[|–—\-]\s+/);
    if (parts.length > 1) {
      // Keep the first segment — the role almost always comes first.
      return clean(parts[0]);
    }
    return clean(s);
  }

  function detectTitle(doc, job) {
    if (job && job.title) return clean(job.title);
    const og = metaContent(doc, 'meta[property="og:title"]');
    const h1 = doc.querySelector("h1");
    const h1t = h1 ? clean(h1.innerText || h1.textContent) : "";
    // Prefer a short, role-looking <h1>; long ones are usually banners.
    if (h1t && h1t.length <= 90) return h1t;
    if (og) return stripTitleSuffix(og);
    if (doc.title) return stripTitleSuffix(doc.title);
    return h1t || "";
  }

  // ---- company -------------------------------------------------------------
  //
  // Deliberately SITE-AGNOSTIC. There is no per-ATS logic in the happy path:
  // we gather the company name from several independent signals that exist on
  // essentially every job page — structured data, social meta tags, the page
  // <title>, and the URL — then let them CORROBORATE each other. A name that
  // shows up in more than one place (e.g. the page's JSON-LD *and* the domain)
  // is trusted over one that appears alone. No single source is required, so it
  // works the same whether you're on acme.com/careers or an ATS.
  //
  // The only place a host list appears is to answer one narrow question: "is
  // the registrable domain the employer, or a job board?" On a company career
  // page the domain IS the company (stripe.com → Stripe); on an aggregator or
  // shared ATS it is not (the employer lives in the URL's path/subdomain, or
  // only in the page's structured data).

  function norm(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }
  function fuzzy(a, b) {
    return a && b && Math.min(a.length, b.length) >= 3 && (a.includes(b) || b.includes(a));
  }

  function prettySlug(slug) {
    return clean(
      decodeURIComponent(String(slug || ""))
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
    );
  }
  // A bare domain label (no separators): "stripe" → "Stripe".
  function prettyBrand(label) {
    label = decodeURIComponent(String(label || ""));
    if (/[-_]/.test(label)) return prettySlug(label);
    return label ? label.charAt(0).toUpperCase() + label.slice(1) : "";
  }

  // Words that name a job board / ATS / generic page — never a real employer.
  const BOARD_WORDS =
    /^(careers?|jobs?|job\s*board|job\s*search|open\s*(roles?|positions?)|we'?re\s*hiring|now\s*hiring|hiring|apply|application|talent|home|greenhouse|lever|ashby(hq)?|workday|myworkday(jobs)?|workable|bamboohr|smartrecruiters|jobvite|icims|recruitee|breezy|teamtailor|rippling|gem|taleo|successfactors|ukg|adp|paylocity|paycom|dayforce|ceridian|jazzhr|indeed|linkedin|glassdoor|ziprecruiter|dice|monster|builtin|wellfound|angellist|simplyhired)$/i;
  function isGenericBoard(s) {
    return BOARD_WORDS.test(clean(s));
  }

  // Tidy a raw name and reject board/generic strings.
  function cleanCompany(s) {
    if (s == null) return "";
    let out = clean(s);
    out = out.replace(/\s*[-–—|:·]\s*(careers?|jobs?|job\s*board|talent|hiring|open\s*roles?)\s*$/i, "");
    out = out.replace(/\s+(careers?|jobs?)$/i, ""); // "Acme Careers" → "Acme"
    out = out.replace(/^(careers?|jobs?)\s+(?:at|@)\s+/i, ""); // "Careers at Acme" → "Acme"
    out = clean(out);
    if (out.length < 2 || out.length > 60) return "";
    if (isGenericBoard(out)) return "";
    return out;
  }

  // Registrable domains that are job boards / ATSes / aggregators: for these
  // the domain is NOT the employer, so we never derive the company from it.
  const AGGREGATOR_HOST =
    /(greenhouse\.io|lever\.co|ashbyhq\.com|myworkdayjobs\.com|workday\.com|workable\.com|bamboohr\.com|smartrecruiters\.com|jobvite\.com|icims\.com|recruitee\.com|breezy\.hr|teamtailor\.com|rippling\.com|gem\.com|taleo\.net|successfactors\.com|ultipro\.com|jazzhr\.com|applytojob\.com|paylocity\.com|indeed\.com|linkedin\.com|glassdoor\.com|ziprecruiter\.com|dice\.com|monster\.com|builtin\.com|wellfound\.com|angel\.co|simplyhired\.com)/i;

  // Generic sub-domain / path words that are never the company itself.
  const GENERIC_SLUG =
    /^(jobs?|job-?boards?|boards?|careers?|apply|application|ats|secure|www|can|my|talent|recruiting|recruit|hire|hiring|search|en|us|app|portal|external|jobsearch|work)$/i;

  // Company slug out of an aggregator/ATS URL, by sub-domain or first path seg.
  function companyFromAggregatorUrl(u) {
    const sub = u.hostname.toLowerCase().split(".")[0];
    if (!GENERIC_SLUG.test(sub)) {
      // acme.myworkdayjobs.com, acme.bamboohr.com, careers-acme.icims.com, …
      const m = sub.match(/^(?:careers?-)?([a-z0-9][a-z0-9-]*)$/i);
      if (m && !GENERIC_SLUG.test(m[1])) return prettySlug(m[1]);
    }
    for (const s of u.pathname.split("/").filter(Boolean)) {
      if (GENERIC_SLUG.test(s)) continue;
      if (/^[a-z0-9][a-z0-9-]{1,40}$/i.test(s) && /[a-z]/i.test(s)) return prettySlug(s);
      break; // first "real" segment is a job id / title, not a company → stop
    }
    return "";
  }

  // Brand embedded in a company-owned domain: careers.stripe.com → "stripe".
  // Strips leading generic sub-domains and the public suffix (incl. co.uk-style).
  function domainBrand(host) {
    host = host.toLowerCase().replace(/^www\./, "");
    const parts = host.split(".");
    if (parts.length < 2) return "";
    const lastTwo = parts.slice(-2).join(".");
    const tldLen = /^(co|com|org|net|gov|edu|ac|or|ne)\.[a-z]{2}$/.test(lastTwo) ? 2 : 1;
    const labels = parts.slice(0, parts.length - tldLen);
    while (labels.length > 1 && GENERIC_SLUG.test(labels[0])) labels.shift();
    return labels[labels.length - 1] || "";
  }

  // Returns { name, brand, score } from the URL, or null.
  function companyFromUrl(url) {
    let u;
    try {
      u = new URL(url);
    } catch (e) {
      return null;
    }
    const host = u.hostname.toLowerCase();
    if (AGGREGATOR_HOST.test(host)) {
      const s = companyFromAggregatorUrl(u);
      return s && !isGenericBoard(s) ? { name: s, brand: norm(s), score: 70 } : null;
    }
    const b = domainBrand(host);
    if (!b || isGenericBoard(b)) return null;
    const name = prettyBrand(b);
    return name ? { name, brand: norm(b), score: 72 } : null;
  }

  // Any standalone Organization node in the page's JSON-LD.
  function organizationFromJsonLd(doc) {
    let name = "";
    eachJsonLdNode(doc, (node) => {
      if (name) return;
      const t = node["@type"];
      const isOrg = t === "Organization" || (Array.isArray(t) && t.includes("Organization"));
      if (isOrg && node.name) name = clean(node.name);
    });
    return name;
  }

  // Company from <title>, using a brand hint (usually the domain) to pick the
  // right piece: "Senior Engineer at Acme", "Acme | Senior Engineer", …
  function companyFromTitle(doc, brandHint) {
    const raw = clean(doc.title || "");
    if (!raw) return "";
    // "…at Company" (covers Greenhouse's "Job Application for X at Acme").
    const m = raw.match(/\bat\s+([A-Za-z0-9][\w&.,'’\-\s]{1,40})$/);
    if (m) {
      const c = cleanCompany(m[1]);
      if (c) return c;
    }
    // Split on separators and, if we have a hint, take the matching segment.
    const segs = raw.split(/\s*[|•·–—:]\s*|\s+-\s+/).map((s) => s.trim()).filter(Boolean);
    if (segs.length >= 2 && brandHint) {
      const hb = norm(brandHint);
      const hit = segs.find((s) => fuzzy(norm(s), hb));
      if (hit) return cleanCompany(hit);
    }
    return "";
  }

  function detectCompany(doc, job, url) {
    url = url || (doc.location && doc.location.href) || "";

    // 1. Structured JobPosting.hiringOrganization — the standard, authoritative
    //    field. When present (most ATS + many career pages) it's decisive.
    if (job && job.hiringOrganization) {
      const org = job.hiringOrganization;
      const c = cleanCompany(typeof org === "string" ? org : org && org.name);
      if (c) return c;
    }

    // 2. Otherwise gather independent candidates and let them corroborate.
    const cands = [];
    const add = (raw, score) => {
      const name = cleanCompany(raw);
      if (name) cands.push({ name, brand: norm(name), score });
    };

    add(organizationFromJsonLd(doc), 86); //     standalone Organization node
    add(metaContent(doc, 'meta[property="og:site_name"]'), 80); // social meta
    add(metaContent(doc, 'meta[name="application-name"]'), 55);
    add(metaContent(doc, 'meta[name="author"]'), 45);

    const urlC = companyFromUrl(url);
    if (urlC) cands.push(urlC);

    add(companyFromTitle(doc, urlC ? urlC.name : ""), 65);

    if (!cands.length) return "";

    // Corroboration: any candidate that agrees with the URL/domain brand is
    // more trustworthy — nudge it up so agreement beats a lone high score.
    if (urlC) {
      for (const c of cands) if (c !== urlC && fuzzy(c.brand, urlC.brand)) c.score += 20;
    }

    cands.sort((a, b) => b.score - a.score || b.name.length - a.name.length);
    return cands[0].name;
  }

  // ---- salary --------------------------------------------------------------
  //
  // Only accept a figure inside sane US ranges, so "$30 million", "50B",
  // "$5,000 sign-on bonus", or "401k" never get mistaken for pay:
  //   • annual : $100,000 – $500,000
  //   • hourly : $50 – $200 / hr
  //
  // We keep the page's original wording as the saved string, but validate the
  // parsed numbers against those bounds before trusting it.

  const ANNUAL_MIN = 100000,
    ANNUAL_MAX = 500000;
  const HOURLY_MIN = 50,
    HOURLY_MAX = 200;

  // Context words that mean a nearby dollar amount is NOT base pay.
  const NON_SALARY = /\b(bonus|sign[-\s]?on|signing|equity|stock|401\s?\(?k\)?|relocation|stipend|reimburse|per\s+diem|gift|referral|budget)\b/i;

  const HOURLY_UNIT = /\b(?:hourly|per\s+hour|an\s+hour)\b|\/\s?(?:hr|hour)\b/i;
  const ANNUAL_UNIT = /\b(?:annually|annualized|annual|per\s+year|a\s+year|per\s+annum|yearly)\b|\/\s?(?:yr|year|annum)\b/i;

  function within(v, lo, hi) {
    return typeof v === "number" && !isNaN(v) && v >= lo && v <= hi;
  }

  // "120,000" -> 120000 ; "150k" -> 150000 ; "1.2M" -> 1200000 ; "75" -> 75
  function parseAmount(tok) {
    if (!tok) return NaN;
    const hasK = /[kK]/.test(tok);
    const hasM = /[mM]/.test(tok);
    const n = parseFloat(tok.replace(/[^0-9.]/g, ""));
    if (isNaN(n)) return NaN;
    if (hasM) return n * 1e6;
    if (hasK) return n * 1000;
    return n;
  }

  // One dollar-amount, optionally a range "A - B", each with optional k/M.
  const MONEY =
    /\$\s?\d[\d,]*(?:\.\d+)?\s*[kKmM]?(?:\s*(?:-|–|—|to)\s*\$?\s?\d[\d,]*(?:\.\d+)?\s*[kKmM]?)?/g;

  // Validate a candidate; returns true if min/max sit in an allowed range for
  // the detected (or inferred) unit.
  function candidateValid(minV, maxV, unit, isRange) {
    if (unit === "hour") {
      return within(minV, HOURLY_MIN, HOURLY_MAX) && (maxV == null || within(maxV, HOURLY_MIN, HOURLY_MAX));
    }
    if (unit === "year") {
      return within(minV, ANNUAL_MIN, ANNUAL_MAX) && (maxV == null || within(maxV, ANNUAL_MIN, ANNUAL_MAX));
    }
    // No explicit unit word — infer, but stay conservative.
    // Big numbers can only be annual; a lone small number is too ambiguous to
    // trust (could be a $150 gift card), so require a range for hourly.
    if (within(minV, ANNUAL_MIN, ANNUAL_MAX) && (maxV == null || within(maxV, ANNUAL_MIN, ANNUAL_MAX))) {
      return true;
    }
    if (isRange && within(minV, HOURLY_MIN, HOURLY_MAX) && within(maxV, HOURLY_MIN, HOURLY_MAX)) {
      return true;
    }
    return false;
  }

  function salaryFromText(text) {
    let m;
    MONEY.lastIndex = 0;
    while ((m = MONEY.exec(text)) !== null) {
      const raw = m[0];
      const start = m.index;
      const end = start + raw.length;
      // Context, clipped to the CURRENT sentence so a word from a neighbouring
      // sentence (e.g. "Equity up to $50k. Base salary $130k") can't leak in.
      const before = text.slice(Math.max(0, start - 40), start).split(/[.;\n•|]/).pop();
      const after = text.slice(end, end + 24).split(/[.;\n•|]/)[0];
      const ctx = before + " " + raw + " " + after;

      if (NON_SALARY.test(before) || NON_SALARY.test(after)) continue;

      // Split the raw match into its number tokens (1 or 2).
      const nums = raw.match(/\d[\d,]*(?:\.\d+)?\s*[kKmM]?/g) || [];
      const minV = parseAmount(nums[0]);
      const maxV = nums.length > 1 ? parseAmount(nums[1]) : null;
      const isRange = nums.length > 1;

      let unit = null;
      if (HOURLY_UNIT.test(after) || HOURLY_UNIT.test(ctx)) unit = "hour";
      else if (ANNUAL_UNIT.test(after) || ANNUAL_UNIT.test(ctx)) unit = "year";

      if (candidateValid(minV, maxV, unit, isRange)) {
        return normalizeSalaryString(raw, unit);
      }
    }
    return "";
  }

  // Tidy the page's raw text into a compact saved string.
  function normalizeSalaryString(raw, unit) {
    let s = clean(raw).replace(/\s*(-|–|—)\s*/g, "–").replace(/\s+to\s+/i, "–");
    if (unit === "hour" && !/\/\s?(hr|hour)|hour/i.test(s)) s += "/hr";
    if (unit === "year" && !/\/\s?(yr|year)|year|annum/i.test(s)) s += "/yr";
    return s;
  }

  // JSON-LD baseSalary: { value: { minValue, maxValue, value, unitText } }
  function salaryFromJsonLd(job) {
    if (!job || !job.baseSalary) return "";
    const bs = job.baseSalary;
    const v = bs.value && typeof bs.value === "object" ? bs.value : bs;
    const unitText = String(v.unitText || bs.unitText || "").toUpperCase();
    const unit = unitText === "HOUR" ? "hour" : unitText === "YEAR" ? "year" : null;

    let lo = num(v.minValue != null ? v.minValue : v.value);
    let hi = num(v.maxValue);
    if (isNaN(lo) && !isNaN(hi)) lo = hi;
    if (isNaN(lo)) return "";

    // Infer unit by magnitude when unitText is absent/other (skip MONTH/WEEK).
    let u = unit;
    if (!u) {
      if (within(lo, ANNUAL_MIN, ANNUAL_MAX)) u = "year";
      else if (within(lo, HOURLY_MIN, HOURLY_MAX)) u = "hour";
      else return "";
    }
    const isRange = !isNaN(hi) && hi !== lo;
    if (!candidateValid(lo, isRange ? hi : null, u, isRange)) return "";

    const cur = String(bs.currency || v.currency || "USD").toUpperCase();
    if (cur && cur !== "USD") return ""; // only trust USD given the user's ranges

    const fmt = (n) => "$" + Math.round(n).toLocaleString("en-US");
    const suffix = u === "hour" ? "/hr" : "/yr";
    return isRange ? `${fmt(lo)}–${fmt(hi)}${suffix}` : `${fmt(lo)}${suffix}`;
  }

  function num(x) {
    if (typeof x === "number") return x;
    if (typeof x === "string") return parseFloat(x.replace(/[^0-9.]/g, ""));
    return NaN;
  }

  function detectSalary(doc, job, text) {
    const fromLd = salaryFromJsonLd(job);
    if (fromLd) return fromLd;
    return salaryFromText(text);
  }

  // ---- main ----------------------------------------------------------------

  function extract(doc, opts) {
    opts = opts || {};
    const url = opts.url || (doc.location && doc.location.href) || "";
    const job = firstJobPosting(doc);
    const bodyText = (doc.body && doc.body.innerText) || "";
    const title = detectTitle(doc, job);
    const text = (doc.title || "") + "\n" + title + "\n" + bodyText;

    return {
      title: title,
      company: detectCompany(doc, job, url),
      salary: detectSalary(doc, job, text),
      link: url,
      hasStructuredJob: !!job,
    };
  }

  window.JobInfo = { extract };
})();
