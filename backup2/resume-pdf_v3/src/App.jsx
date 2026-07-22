// App.jsx
// Install: npm i @react-pdf/renderer

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Document,
  Page,
  Text,
  View,
  Link,
  StyleSheet,
  PDFDownloadLink,
  PDFViewer,
} from "@react-pdf/renderer";

const NAME_COLOR = "#000000";
const SECTION_TITLE_COLOR = "#6e6e6e";
const SECTION_TITLE_SIZE = 14;

const fixedHeader = {
  name: "Philip Yang",
  bullets: [
    "1(646)553-4085 • philip.yang324@hotmail.com",
    "New York, NY",
  ],
};

const githubAccounts = [
  { stack: "Java, Kotlin", url: "https://github.com/tyrantgit" },
  { stack: "Data Engineering", url: "https://github.com/damklis" },
  { stack: "JavaScript (TypeScript)", url: "https://github.com/happydreamcatcher" },
  { stack: "Java backend + TypeScript frontend", url: "https://github.com/camfrelat" },
  { stack: "AI, ML, NLP, LLM", url: "https://github.com/techguy0717" },
  { stack: "C#, Angular", url: "https://github.com/vopvop" },
];

// Listed newest first; extras render as bullets under their own entry.
const fixedEducation = [
  {
    school: "University of California, Berkeley",
    degree: "Master of Science, Robotics and Computer Science",
    location: "Berkeley, CA",
    years: "2018 - 2019",
    extras: [],
  },
  {
    school: "University of California, Berkeley",
    degree: "Bachelor of Science, Computer Science and Electrical Engineering",
    location: "Berkeley, CA",
    years: "2014 - 2018",
    extras: [
      "Participant - ACM International Collegiate Programming Contest (ICPC)",
      "Contributor to open-source campus initiative",
    ],
  },
];

// Splits a string like "foo **bar** baz" into [{text:"foo ",bold:false},{text:"bar",bold:true},{text:" baz",bold:false}]
function parseBoldSegments(text) {
  const parts = [];
  const regex = /\*\*(.+?)\*\*/g;
  let last = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push({ text: text.slice(last, match.index), bold: false });
    parts.push({ text: match[1], bold: true });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), bold: false });
  return parts.length ? parts : [{ text, bold: false }];
}

function parseLinesToBullets(text) {
  return (text || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);
}

// Join non-empty lines with a space so text flows as one paragraph; preserve blank-line breaks as \n\n
function joinLinesToParagraph(text) {
  return (text || "")
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((para) =>
      para
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .join(" ")
    )
    .filter(Boolean)
    .join("\n\n");
}

function safeFilePart(s) {
  return (s || "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w-]/g, "")
    .replace(/_+/g, "_")
    .slice(0, 80);
}

function buildFileName(order, jobCompany, jobRole) {
  const o = safeFilePart(order) || "001";
  const c = safeFilePart(jobCompany) || "Company";
  const r = safeFilePart(jobRole) || "Role";
  return `${o}_${c}_${r}.pdf`;
}

function buildCoverLetterFileName(order) {
  const o = safeFilePart(order) || "001";
  return `Cover Letter_${o}.pdf`;
}

function normalizeResumeJson(obj) {
  return {
    // Always force this fixed title, ignoring whatever the JSON provides
    // (GPT sometimes appends extra titles like ", Applied AI" based on the JD).
    headerSubtitle: "Senior Software Engineer",
    professionalIdentity: typeof obj?.professionalIdentity === "string" ? obj.professionalIdentity : "",
    roleFitSnapshot: typeof obj?.roleFitSnapshot === "string" ? obj.roleFitSnapshot : "",
    evidenceHighlights: typeof obj?.evidenceHighlights === "string" ? obj.evidenceHighlights : "",
    engineeringStrengths: typeof obj?.engineeringStrengths === "string" ? obj.engineeringStrengths : "",
    certifications: typeof obj?.certifications === "string" ? obj.certifications : "",
    volunteering: typeof obj?.volunteering === "string" ? obj.volunteering : "",
    coverLetter: typeof obj?.coverLetter === "string" ? obj.coverLetter : "",
    experiences: Array.isArray(obj?.experiences)
      ? obj.experiences.map((e) => ({
          bullets: typeof e?.bullets === "string" ? e.bullets : "",
        }))
      : [],
  };
}

function ResumePDF({ fontMode, metaJobs, content, showCerts, showVolunteering, volunteeringMeta, githubUrl }) {
  const fontFamily = fontMode === "bell" ? "Times-Roman" : "Helvetica";

  const piParagraph = joinLinesToParagraph(content.professionalIdentity);
  const roleFitLines = parseLinesToBullets(content.roleFitSnapshot);
  const evidenceItems = parseLinesToBullets(content.evidenceHighlights);
  const engineeringItems = parseLinesToBullets(content.engineeringStrengths);
  const certItems = parseLinesToBullets(content.certifications);
  const volunteeringParagraph = joinLinesToParagraph(content.volunteering);

  const mergedJobs = metaJobs.map((m, idx) => {
    const bulletsText = content.experiences?.[idx]?.bullets || "";
    return { ...m, bullets: parseLinesToBullets(bulletsText) };
  });

  const styles = StyleSheet.create({
    page: {
      paddingTop: 28,
      paddingBottom: 28,
      paddingHorizontal: 32,
      fontFamily,
      fontSize: 10.5,
      lineHeight: 1.25,
      color: "#111",
    },

    name: { fontSize: 18, fontWeight: 700, color: NAME_COLOR },
    subtitle: { fontSize: 11, fontWeight: 700, color: NAME_COLOR, marginTop: 6 },
    headerBullets: { marginTop: 6, paddingLeft: 14 },

    sectionTitleWrap: { marginTop: 12 },
    sectionTitle: {
      fontSize: SECTION_TITLE_SIZE,
      fontWeight: 700,
      color: SECTION_TITLE_COLOR,
      textAlign: "left",
    },
    underline: { height: 1, backgroundColor: "#555", marginTop: 3 },

    paragraph: { marginTop: 6, textAlign: "left" },
    roleFitBlock: { marginTop: 6 },
    roleFitLine: { marginBottom: 3 },

    ul: { marginTop: 6, paddingLeft: 14 },
    liRow: { flexDirection: "row", marginBottom: 3 },
    liBullet: { width: 10, fontWeight: 700 },
    liText: { flex: 1 },
    headerLink: { color: "#111", textDecoration: "none" },

    jobUl: { marginTop: 6, paddingLeft: 14 },
    jobLiLine: { marginBottom: 3 },

    jobHeaderRow: {
      marginTop: 8,
    },
    jobHeaderTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "baseline",
    },
    jobHeaderBottom: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "baseline",
      marginTop: 1,
    },
    jobRole: { fontSize: 11, fontWeight: 700, color: SECTION_TITLE_COLOR },
    jobDates: { fontSize: 11, fontWeight: 400, color: SECTION_TITLE_COLOR },
    jobCompany: { fontSize: 11, fontWeight: 700, color: SECTION_TITLE_COLOR },
    jobLocation: { fontSize: 11, fontWeight: 400, color: SECTION_TITLE_COLOR },

    eduRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 10,
      marginTop: 6,
    },
    eduBold: { fontWeight: 700, color: SECTION_TITLE_COLOR },

    volProjectRow: { marginTop: 8 },
    volProject: { fontSize: 11, fontWeight: 700, color: SECTION_TITLE_COLOR },
    volPositionRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "baseline",
      marginTop: 1,
    },
    volPosition: { fontSize: 11, fontWeight: 700, color: SECTION_TITLE_COLOR },
    volPeriod: { fontSize: 11, fontWeight: 400, color: SECTION_TITLE_COLOR },
    volParagraph: { marginTop: 4, textAlign: "left" },
  });

  const SectionTitle = ({ children }) => (
    <View style={styles.sectionTitleWrap}>
      <Text style={styles.sectionTitle}>{children}</Text>
      <View style={styles.underline} />
    </View>
  );

  const renderSegments = (segments) =>
    segments.map((seg, si) =>
      seg.bold ? (
        <Text key={si} style={{ fontWeight: 700 }}>
          {seg.text}
        </Text>
      ) : (
        <Text key={si}>{seg.text}</Text>
      )
    );

  const BulletList = ({ items }) => {
    if (!items || items.length === 0) return null;
    return (
      <View style={styles.ul}>
        {items.map((t, i) => {
          const segs = parseBoldSegments(t);
          return (
            <View key={i} style={styles.liRow}>
              <Text style={styles.liBullet}>•</Text>
              <Text style={styles.liText}>{renderSegments(segs)}</Text>
            </View>
          );
        })}
      </View>
    );
  };

  // Work Experience bullets: prevent orphan bullet on page break, support bold via **markdown**
  const ExperienceBulletList = ({ items }) => {
    if (!items || items.length === 0) return null;
    return (
      <View style={styles.jobUl}>
        {items.map((t, i) => {
          const segments = parseBoldSegments(t);
          return (
            <View key={i} wrap={false} minPresenceAhead={14}>
              <Text style={styles.jobLiLine}>
                {"• "}
                {renderSegments(segments)}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.name}>{fixedHeader.name}</Text>
        <Text style={styles.subtitle}>{content.headerSubtitle || " "}</Text>

        <View style={styles.headerBullets}>
          {githubUrl ? (
            <View style={styles.liRow}>
              <Text style={styles.liBullet}>•</Text>
              <Link src={githubUrl} style={[styles.liText, styles.headerLink]}>
                {githubUrl}
              </Link>
            </View>
          ) : null}
          {fixedHeader.bullets.map((b, i) => (
            <View key={i} style={styles.liRow}>
              <Text style={styles.liBullet}>•</Text>
              <Text style={styles.liText}>{b}</Text>
            </View>
          ))}
        </View>

        <SectionTitle>Professional Identity</SectionTitle>
        <Text style={styles.paragraph}>
          {renderSegments(parseBoldSegments(piParagraph || " "))}
        </Text>

        {/* <SectionTitle>Role Fit Snapshot</SectionTitle> */}
        {/* 
         */}

        <SectionTitle>Evidence Highlights</SectionTitle>
        <BulletList items={evidenceItems} />

        <SectionTitle>Engineering Strengths</SectionTitle>
        <BulletList items={engineeringItems} />

        <SectionTitle>Work Experience</SectionTitle>
        {mergedJobs.map((job, idx) => (
          <View key={idx}>
            <View style={styles.jobHeaderRow}>
              <View style={styles.jobHeaderTop}>
                <Text style={styles.jobRole}>{job.role}</Text>
                <Text style={styles.jobDates}>{job.dates}</Text>
              </View>
              <View style={styles.jobHeaderBottom}>
                <Text style={styles.jobCompany}>{job.company}</Text>
                <Text style={styles.jobLocation}>{job.location}</Text>
              </View>
            </View>
            <ExperienceBulletList items={job.bullets} />
          </View>
        ))}

        <SectionTitle>Education</SectionTitle>
        {fixedEducation.map((edu, idx) => (
          <View key={idx}>
            <View style={styles.eduRow}>
              <Text style={styles.eduBold}>{edu.school}</Text>
              <Text style={styles.eduBold}>{edu.location}</Text>
            </View>
            <View style={styles.eduRow}>
              <Text style={styles.eduBold}>{edu.degree}</Text>
              <Text style={styles.eduBold}>{edu.years}</Text>
            </View>
            {edu.extras && edu.extras.length > 0 ? (
              <View style={styles.ul}>
                {edu.extras.map((t, i) => (
                  <View key={i} style={styles.liRow}>
                    <Text style={styles.liBullet}>•</Text>
                    <Text style={styles.liText}>{t}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ))}

        {showCerts ? (
          <>
            <SectionTitle>Certifications</SectionTitle>
            <BulletList items={certItems} />
          </>
        ) : null}

        {showVolunteering ? (
          <>
            <SectionTitle>Volunteering</SectionTitle>
            <View style={styles.volProjectRow}>
              <Text style={styles.volProject}>{volunteeringMeta.project}</Text>
            </View>
            <View style={styles.volPositionRow}>
              <Text style={styles.volPosition}>{volunteeringMeta.position}</Text>
              <Text style={styles.volPeriod}>{volunteeringMeta.period}</Text>
            </View>
            <Text style={styles.volParagraph}>
              {renderSegments(parseBoldSegments(volunteeringParagraph || " "))}
            </Text>
          </>
        ) : null}
      </Page>
    </Document>
  );
}

function CoverLetterPDF({ fontMode, content }) {
  const fontFamily = fontMode === "bell" ? "Times-Roman" : "Helvetica";

  // Blank line = new paragraph; single newlines inside a block flow together.
  const paragraphs = joinLinesToParagraph(content.coverLetter)
    .split("\n\n")
    .filter(Boolean);

  const styles = StyleSheet.create({
    page: {
      paddingTop: 28,
      paddingBottom: 28,
      paddingHorizontal: 32,
      fontFamily,
      fontSize: 10.5,
      lineHeight: 1.4,
      color: "#111",
    },
    name: { fontSize: 18, fontWeight: 700, color: NAME_COLOR },
    subtitle: { fontSize: 11, fontWeight: 700, color: NAME_COLOR, marginTop: 6 },
    headerBullets: { marginTop: 6, paddingLeft: 14 },
    liRow: { flexDirection: "row", marginBottom: 3 },
    liBullet: { width: 10, fontWeight: 700 },
    liText: { flex: 1 },
    divider: { height: 1, backgroundColor: "#555", marginTop: 12 },
    paragraph: { marginTop: 10, textAlign: "left" },
  });

  const renderSegments = (segments) =>
    segments.map((seg, si) =>
      seg.bold ? (
        <Text key={si} style={{ fontWeight: 700 }}>{seg.text}</Text>
      ) : (
        <Text key={si}>{seg.text}</Text>
      )
    );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.name}>{fixedHeader.name}</Text>
        <Text style={styles.subtitle}>{content.headerSubtitle || " "}</Text>
        <View style={styles.headerBullets}>
          {fixedHeader.bullets.map((b, i) => (
            <View key={i} style={styles.liRow}>
              <Text style={styles.liBullet}>•</Text>
              <Text style={styles.liText}>{b}</Text>
            </View>
          ))}
        </View>
        <View style={styles.divider} />
        {paragraphs.length ? (
          paragraphs.map((p, i) => (
            <Text key={i} style={styles.paragraph}>
              {renderSegments(parseBoldSegments(p))}
            </Text>
          ))
        ) : (
          <Text style={styles.paragraph}> </Text>
        )}
      </Page>
    </Document>
  );
}

const textInput = {
  width: "100%",
  borderRadius: 8,
  border: "1px solid #e2e4e8",
  padding: "8px 10px",
  fontSize: 13,
  background: "#fff",
  outline: "none",
  boxSizing: "border-box",
};

const textareaBase = {
  width: "100%",
  borderRadius: 8,
  border: "1px solid #e2e4e8",
  padding: 10,
  resize: "vertical",
  fontSize: 13,
  lineHeight: 1.5,
  background: "#fff",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

const miniBtn = {
  border: "1px solid #e2e4e8",
  background: "#fff",
  padding: "6px 10px",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 12,
  color: "#374151",
};

const miniBtnDanger = {
  ...miniBtn,
  border: "1px solid #f1c9c9",
  background: "#fff7f7",
  color: "#b04141",
};

const spinnerBtn = {
  border: "1px solid #e2e4e8",
  background: "#fff",
  padding: 0,
  borderRadius: 4,
  cursor: "pointer",
  color: "#374151",
  fontSize: 8,
  lineHeight: 1,
  minWidth: 22,
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const cardStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 1px 3px rgba(16,24,40,0.06), 0 1px 2px rgba(16,24,40,0.04)",
  border: "1px solid #eef0f3",
};

const sectionBoxStyle = {
  marginTop: 14,
  padding: 14,
  border: "1px solid #eef0f3",
  borderRadius: 10,
  background: "#fafbfc",
};

const sectionLabelStyle = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  color: "#6b7280",
  marginBottom: 10,
};

const cardTitleStyle = {
  fontSize: 14,
  fontWeight: 700,
  color: "#111827",
};

const helpTextStyle = {
  fontSize: 12,
  color: "#6b7280",
  marginBottom: 10,
  lineHeight: 1.5,
};

const downloadBtnPrimary = {
  textDecoration: "none",
  background: "#111827",
  color: "#fff",
  padding: "9px 14px",
  borderRadius: 8,
  fontWeight: 600,
  fontSize: 13,
  whiteSpace: "nowrap",
  border: "1px solid #111827",
};

const downloadBtnSecondary = {
  ...downloadBtnPrimary,
  background: "#fff",
  color: "#111827",
  border: "1px solid #d1d5db",
};

const defaultResumeJson = `{
  "headerSubtitle": "Senior Software Engineer",
  "professionalIdentity": "Full stack developer with strong backend depth across .NET style service design, SQL backed applications, Azure hosted systems, and integration heavy product workflows.\\nStrongest fit is in modular application development, REST APIs, webhook design, tenant level configuration, JSON data mapping, authentication, and cross system debugging.\\nBring practical value by turning invoice, payment, and operational workflows into reliable application features with clear error handling, traceability, and maintainable handoff documentation.",
  "roleFitSnapshot": "Target Fit: Full stack integration developer comfortable across application code, admin screens, SQL, Azure, and automation workflows.\\nProduct Match: Experience with invoice, payment, seller, healthcare, and operational workflow systems where data must move cleanly between platforms.\\nTechnical Match: C#, .NET patterns, SQL, Azure services, REST APIs, webhooks, OAuth, shared secrets, JSON payloads, background processing, and workflow automation.\\nDelivery Style: Builds practical features with QA friendly validation, observable failures, secure configuration, and clear setup notes for handoff.",
  "evidenceHighlights": "Improved integration reliability by adding event validation, correlation friendly logging, and clearer failure visibility across webhook and API based flows.\\nReduced manual reconciliation effort by shaping invoice and payment data into predictable payloads for downstream systems and operational review.\\nStrengthened tenant aware configuration by separating enablement, credentials, endpoint references, permissions, and workflow behavior from core application logic.\\nImproved backend maintainability through modular service boundaries, SQL troubleshooting, API contract cleanup, and deployment ready documentation.\\nSupported UAT and QA validation by making create, update, void, delete, and paid status flows easier to reproduce and verify.",
  "engineeringStrengths": "Application Development: C#, .NET, ASP.NET Core patterns, ABP.IO style modular architecture, REST APIs, webhook endpoints, background jobs, service layer design.\\nData and Persistence: SQL, Azure SQL, schema design, query optimization, data troubleshooting, transaction aware workflow updates, invoice and payment data modeling.\\nCloud and Operations: Microsoft Azure, Azure App Services, Azure Functions, Azure Key Vault, Azure Storage, Application Insights, secure configuration, deployment support.\\nIntegration and Automation: n8n, Zapier style workflows, QuickBooks Online API concepts, third party APIs, JSON mapping, OAuth, API keys, shared secrets, retry handling.\\nFrontend and Configuration: Admin screens, tenant settings, feature toggles, permissions, test webhook actions, configuration validation, user friendly operational controls.\\nQuality and Traceability: Correlation IDs, structured logs, error visibility, integration observability, QA support, UAT troubleshooting, technical setup documentation.",
  "certifications": "AWS Certified Solutions Architect Associate: Amazon Web Services (2023)\\nCertified Kubernetes Application Developer: Cloud Native Computing Foundation (2024)",
  "volunteering": "Worked as a senior full stack developer and a member of over 30-person volunteers, committed to an open-source project for helping to fight COVID-19. Using GraphAware, Hume for COVID-19 identifies people at risk using contact tracing, suggesting who should be informed or quarantined, and more",
  "coverLetter": "Dear Hiring Manager,\\n\\nI am excited to apply for this role. With several years of full stack engineering experience across backend services, cloud platforms, and integration heavy product workflows, I am confident I can contribute meaningful value to your team from day one.\\n\\nIn my recent work I have designed modular service architectures, built REST APIs and webhook based integrations, and shipped reliable features backed by SQL and Azure. I focus on clear error handling, observability, and maintainable handoff documentation so that the systems I build stay dependable in production.\\n\\nI would welcome the opportunity to discuss how my background aligns with your needs. Thank you for your time and consideration.\\n\\nSincerely,\\nEdison Leung",
  "experiences": [
    { "bullets": "Product and Platform Context: Thoughtworks AI works enterprise API modernization engagement supporting modular service migration, Azure aligned delivery, and integration heavy business workflows.\\nBuilt backend features using C# and .NET service patterns with SQL backed persistence, REST APIs, webhook style communication, and secure configuration boundaries.\\nDesigned tenant aware settings for integration enablement, endpoint references, authentication metadata, permissions, and environment specific behavior.\\nCreated admin configuration screens that allowed operations users to manage integration status, validate webhook actions, and review setup issues without engineering support.\\nImplemented JSON payload shaping, event trigger handling, shared secret validation, and correlation friendly logging for cross system workflow visibility.\\nWorked with Azure App Services, Azure SQL, Key Vault, Storage, and Application Insights to support secure deployment, troubleshooting, and runtime observability.\\nImproved integration handoff quality by documenting setup steps, payload expectations, error scenarios, and QA validation paths for client UAT.\\nPlayed a key role in making modernization work more reliable by separating application logic, workflow configuration, and operational diagnostics into maintainable modules." },
    { "bullets": "Product and Platform Context: Amazon Selling Partner API finance, tax, and invoicing capabilities supporting seller and vendor invoice data exchange, payment visibility, and bookkeeping workflows.\\nDeveloped backend services with Java, C#, REST APIs, SQL and DynamoDB data access patterns, and event driven processing for invoice and payment related workflows.\\nImplemented API contracts, JSON payload validation, authentication handling, and integration failure paths for partner facing financial data operations.\\nWorked with AWS Lambda, SQS, CloudWatch, IAM, and secure credential references to support asynchronous processing, retries, and traceable operational behavior.\\nImproved invoice workflow reliability by making submission, update, and exception states easier for support and QA teams to reproduce and diagnose.\\nCollaborated with product, QA, and partner engineering teams to validate edge cases around invoice creation, voiding, reconciliation, and downstream status updates." },
    { "bullets": "Product and Platform Context: Clearstep AI driven conversational healthcare platform supporting virtual triage, care navigation, and structured workflow routing for patients and care teams.\\nBuilt full stack product features using JavaScript, TypeScript, Node.js, React, REST APIs, and SQL backed application data.\\nSupported backend workflow logic for structured intake, routing decisions, status updates, and external system data exchange at an early career level.\\nCreated internal configuration screens that helped non engineering users adjust workflow behavior, content mappings, and operational rules.\\nWorked on JSON payload design, API debugging, authentication handling, and error reporting for healthcare workflow integrations.\\nImproved supportability by adding clearer logs, validation checks, and documentation for recurring integration and data quality issues." }
  ]
}`;

export default function App() {
  const [useBell, setUseBell] = useState(true);
  const [useArial, setUseArial] = useState(false);
  const fontMode = useBell ? "bell" : "arial";

  const [order, setOrder] = useState("001");
  const [jobPostCompany, setJobPostCompany] = useState("");
  const [positionRoleTitle, setPositionRoleTitle] = useState("");
  const customFileName = useMemo(
    () => buildFileName(order, jobPostCompany, positionRoleTitle),
    [order, jobPostCompany, positionRoleTitle]
  );

  const [secondNameOption, setSecondNameOption] = useState("MyResume");
  const secondFileName = useMemo(() => `${secondNameOption}.pdf`, [secondNameOption]);

  // Cover letter shares the resume's `order` number (same job application).
  const coverLetterFileName = useMemo(
    () => buildCoverLetterFileName(order),
    [order]
  );

  // Selected GitHub URL ("" = no bullet). Single choice across the stack→URL pairs.
  const [selectedGithubUrl, setSelectedGithubUrl] = useState(githubAccounts[0].url);

  const [metaJobs, setMetaJobs] = useState([
    { role: "Senior Software Engineer", company: "Accenture", location: "New York, NY", dates: "10/2024 - Present" },
    { role: "Senior Software Engineer", company: "duckie.ai", location: "New York, NY", dates: "04/2023 - 09/2024" },
    { role: "Software Engineer III", company: "Ford", location: "Dearborn, MI", dates: "11/2019 - 04/2023" },
  ]);

  const [resumeJson, setResumeJson] = useState(defaultResumeJson);

  const [jsonError, setJsonError] = useState("");
  const [content, setContent] = useState(() => {
    try {
      return normalizeResumeJson(JSON.parse(resumeJson));
    } catch {
      return normalizeResumeJson({});
    }
  });

  // Per-section editable buffers — synced from JSON, but editable for the final output
  const [piEditable, setPiEditable] = useState(content.professionalIdentity);
  const lastJsonPiRef = useRef(content.professionalIdentity);

  const [rfsEditable, setRfsEditable] = useState(content.roleFitSnapshot);
  const lastJsonRfsRef = useRef(content.roleFitSnapshot);

  const [ehEditable, setEhEditable] = useState(content.evidenceHighlights);
  const lastJsonEhRef = useRef(content.evidenceHighlights);

  const [esEditable, setEsEditable] = useState(content.engineeringStrengths);
  const lastJsonEsRef = useRef(content.engineeringStrengths);

  const [certificationsEditable, setCertificationsEditable] = useState(content.certifications);
  const lastJsonCertsRef = useRef(content.certifications);

  const [volunteeringEditable, setVolunteeringEditable] = useState(content.volunteering);
  const lastJsonVolunteeringRef = useRef(content.volunteering);

  const [coverLetterEditable, setCoverLetterEditable] = useState(content.coverLetter);
  const lastJsonCoverLetterRef = useRef(content.coverLetter);

  // Volunteering meta (editable in UI; description body comes from JSON)
  const [volunteeringMeta, setVolunteeringMeta] = useState({
    project: "Graphs 4 COVID-19 Hume-Covid",
    position: "Senior Full Stack Developer",
    period: "07/2020 - 12/2020",
  });

  // Section visibility toggles (per session)
  const [showCerts, setShowCerts] = useState(true);
  const [showVolunteering, setShowVolunteering] = useState(true);

  // Parse JSON on change (debounced)
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const parsed = JSON.parse(resumeJson);
        const normalized = normalizeResumeJson(parsed);
        setContent(normalized);
        setJsonError("");
      } catch {
        setJsonError("JSON invalid (check commas/quotes). Preview keeps last valid JSON.");
      }
    }, 250);
    return () => clearTimeout(t);
  }, [resumeJson]);

  // When JSON section changes, force-sync the matching edit field
  useEffect(() => {
    const v = content.professionalIdentity || "";
    if (v !== lastJsonPiRef.current) {
      lastJsonPiRef.current = v;
      setPiEditable(v);
    }
  }, [content.professionalIdentity]);

  useEffect(() => {
    const v = content.roleFitSnapshot || "";
    if (v !== lastJsonRfsRef.current) {
      lastJsonRfsRef.current = v;
      setRfsEditable(v);
    }
  }, [content.roleFitSnapshot]);

  useEffect(() => {
    const v = content.evidenceHighlights || "";
    if (v !== lastJsonEhRef.current) {
      lastJsonEhRef.current = v;
      setEhEditable(v);
    }
  }, [content.evidenceHighlights]);

  useEffect(() => {
    const v = content.engineeringStrengths || "";
    if (v !== lastJsonEsRef.current) {
      lastJsonEsRef.current = v;
      setEsEditable(v);
    }
  }, [content.engineeringStrengths]);

  useEffect(() => {
    const v = content.certifications || "";
    if (v !== lastJsonCertsRef.current) {
      lastJsonCertsRef.current = v;
      setCertificationsEditable(v);
    }
  }, [content.certifications]);

  useEffect(() => {
    const v = content.volunteering || "";
    if (v !== lastJsonVolunteeringRef.current) {
      lastJsonVolunteeringRef.current = v;
      setVolunteeringEditable(v);
    }
  }, [content.volunteering]);

  useEffect(() => {
    const v = content.coverLetter || "";
    if (v !== lastJsonCoverLetterRef.current) {
      lastJsonCoverLetterRef.current = v;
      setCoverLetterEditable(v);
    }
  }, [content.coverLetter]);

  // Final content used by PDF (text sections come from right-side editors)
  const finalContent = useMemo(
    () => ({
      ...content,
      professionalIdentity: piEditable,
      roleFitSnapshot: rfsEditable,
      evidenceHighlights: ehEditable,
      engineeringStrengths: esEditable,
      certifications: certificationsEditable,
      volunteering: volunteeringEditable,
      coverLetter: coverLetterEditable,
    }),
    [content, piEditable, rfsEditable, ehEditable, esEditable, certificationsEditable, volunteeringEditable, coverLetterEditable]
  );

  const pdfDoc = useMemo(
    () => (
      <ResumePDF
        fontMode={fontMode}
        metaJobs={metaJobs}
        content={finalContent}
        showCerts={showCerts}
        showVolunteering={showVolunteering}
        volunteeringMeta={volunteeringMeta}
        githubUrl={selectedGithubUrl}
      />
    ),
    [fontMode, metaJobs, finalContent, showCerts, showVolunteering, volunteeringMeta, selectedGithubUrl]
  );

  const coverLetterPdfDoc = useMemo(
    () => <CoverLetterPDF fontMode={fontMode} content={finalContent} />,
    [fontMode, finalContent]
  );

  function bumpOrder(delta) {
    const cleaned = (order || "").replace(/\D/g, "");
    const n = cleaned === "" ? 0 : parseInt(cleaned, 10);
    const next = Math.max(0, n + delta);
    setOrder(String(next).padStart(3, "0"));
  }

  function onToggleBell() {
    setUseBell(true);
    setUseArial(false);
  }
  function onToggleArial() {
    setUseArial(true);
    setUseBell(false);
  }

  function updateMetaJob(idx, patch) {
    setMetaJobs((prev) => prev.map((j, i) => (i === idx ? { ...j, ...patch } : j)));
  }
  function addMetaJob() {
    setMetaJobs((prev) => [...prev, { role: "", company: "", location: "", dates: "" }]);
  }
  function removeMetaJob(idx) {
    setMetaJobs((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <div style={{ padding: 20, background: "#f4f5f7", minHeight: "100vh", color: "#111827" }}>
      <div style={{ maxWidth: 1640, margin: "0 auto" }}>
        {/* TOP BAR */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 20px",
            background: "#fff",
            borderRadius: 12,
            boxShadow: "0 1px 3px rgba(16,24,40,0.06), 0 1px 2px rgba(16,24,40,0.04)",
            border: "1px solid #eef0f3",
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: -0.2 }}>Resume PDF Generator</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Edit on the sides, preview in the middle.</div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <PDFDownloadLink document={pdfDoc} fileName={customFileName} style={downloadBtnPrimary}>
              {({ loading }) => (loading ? "Building…" : "Download PDF")}
            </PDFDownloadLink>
            <PDFDownloadLink document={pdfDoc} fileName={secondFileName} style={downloadBtnSecondary}>
              {({ loading }) => (loading ? "Building…" : "Download 2nd")}
            </PDFDownloadLink>
          </div>
        </div>

        {/* GITHUB ACCOUNT BAR — full width, below header */}
        <div
          style={{
            padding: "10px 20px",
            background: "#fff",
            borderRadius: 12,
            boxShadow: "0 1px 3px rgba(16,24,40,0.06), 0 1px 2px rgba(16,24,40,0.04)",
            border: "1px solid #eef0f3",
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
            <div style={{ minWidth: 160 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>GitHub account</div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                First header bullet in PDF.
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, flex: 1 }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid",
                  borderColor: selectedGithubUrl === "" ? "#111827" : "#e2e4e8",
                  background: selectedGithubUrl === "" ? "#f3f4f6" : "#fff",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedGithubUrl === ""}
                  onChange={() => setSelectedGithubUrl("")}
                />
                <span style={{ fontWeight: 600 }}>None</span>
              </label>
              {githubAccounts.map((acc) => {
                const isSelected = selectedGithubUrl === acc.url;
                return (
                  <label
                    key={acc.url}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid",
                      borderColor: isSelected ? "#111827" : "#e2e4e8",
                      background: isSelected ? "#f3f4f6" : "#fff",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => setSelectedGithubUrl(acc.url)}
                    />
                    <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
                      <span style={{ fontWeight: 600 }}>{acc.stack}</span>
                      <span style={{ color: "#6b7280", fontSize: 10 }}>
                        {acc.url.replace("https://", "")}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        <div
          className="gridWrap"
          style={{
            display: "grid",
            gridTemplateColumns: "380px minmax(640px, 1fr) 380px",
            gap: 16,
            alignItems: "start",
          }}
        >
          {/* LEFT */}
          <div style={cardStyle}>
            <div style={sectionLabelStyle}>Settings</div>

            {/* Font */}
            <div style={{ ...sectionBoxStyle, marginTop: 0 }}>
              <div style={cardTitleStyle}>Font</div>
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <input type="checkbox" checked={useBell} onChange={onToggleBell} />
                  Bell MT <span style={{ color: "#6b7280" }}>(fallback: Times)</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <input type="checkbox" checked={useArial} onChange={onToggleArial} />
                  Arial <span style={{ color: "#6b7280" }}>(fallback: Helvetica)</span>
                </label>
              </div>
            </div>

            {/* File name */}
            <div style={sectionBoxStyle}>
              <div style={cardTitleStyle}>Custom output file name</div>
              <div style={helpTextStyle}>
                Format: <code style={{ fontSize: 11 }}>[order]_[company]_[role].pdf</code>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div style={{ display: "flex", gap: 4 }}>
                  <input
                    value={order}
                    onChange={(e) => setOrder(e.target.value)}
                    style={{ ...textInput, flex: 1 }}
                    placeholder="order (e.g. 001)"
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <button type="button" onClick={() => bumpOrder(1)} style={spinnerBtn} aria-label="Increment order">▲</button>
                    <button type="button" onClick={() => bumpOrder(-1)} style={spinnerBtn} aria-label="Decrement order">▼</button>
                  </div>
                </div>
                <input value={jobPostCompany} onChange={(e) => setJobPostCompany(e.target.value)} style={textInput} placeholder="company" />
              </div>
              <div style={{ marginTop: 8 }}>
                <input value={positionRoleTitle} onChange={(e) => setPositionRoleTitle(e.target.value)} style={textInput} placeholder="role title" />
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
                Preview: <code style={{ fontSize: 12, color: "#111827" }}>{customFileName}</code>
              </div>
            </div>

            {/* Second PDF name */}
            <div style={sectionBoxStyle}>
              <div style={cardTitleStyle}>Second PDF name</div>
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                {["PhilipYang", "PhilipYangResume", "PhilipYang2026"].map((n) => (
                  <label key={n} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                    <input type="checkbox" checked={secondNameOption === n} onChange={() => setSecondNameOption(n)} />
                    {n}
                  </label>
                ))}
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
                Preview: <code style={{ fontSize: 12, color: "#111827" }}>{secondFileName}</code>
              </div>
            </div>

            {/* JSON */}
            <div style={sectionBoxStyle}>
              <div style={cardTitleStyle}>Resume JSON</div>
              <div style={helpTextStyle}>
                Paste JSON once. Preview updates automatically; invalid JSON keeps the last valid version.
              </div>
              {jsonError ? (
                <div style={{ marginBottom: 8, color: "#b04141", fontWeight: 600, fontSize: 12 }}>
                  {jsonError}
                </div>
              ) : null}
              <textarea
                value={resumeJson}
                onChange={(e) => setResumeJson(e.target.value)}
                rows={14}
                style={{
                  ...textareaBase,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  fontSize: 12,
                }}
              />
            </div>

            {/* Work meta */}
            <div style={sectionBoxStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={cardTitleStyle}>Work experience</div>
                <button onClick={addMetaJob} style={miniBtn}>+ Add company</button>
              </div>
              <div style={{ ...helpTextStyle, marginTop: 6, marginBottom: 0 }}>
                Meta only. Bullets come from JSON <code style={{ fontSize: 11 }}>experiences[]</code> by index.
              </div>

              {metaJobs.map((job, idx) => (
                <div
                  key={idx}
                  style={{
                    marginTop: 10,
                    padding: 12,
                    border: "1px solid #eef0f3",
                    borderRadius: 10,
                    background: "#fff",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "#374151" }}>Company #{idx + 1}</div>
                    <button onClick={() => removeMetaJob(idx)} style={miniBtnDanger}>Remove</button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
                    <input value={job.role} onChange={(e) => updateMetaJob(idx, { role: e.target.value })} style={textInput} placeholder="Role" />
                    <input value={job.company} onChange={(e) => updateMetaJob(idx, { company: e.target.value })} style={textInput} placeholder="Company" />
                    <input value={job.location} onChange={(e) => updateMetaJob(idx, { location: e.target.value })} style={textInput} placeholder="Location" />
                    <input value={job.dates} onChange={(e) => updateMetaJob(idx, { dates: e.target.value })} style={textInput} placeholder="Dates" />
                  </div>
                </div>
              ))}
            </div>

            {/* Volunteering meta */}
            <div style={sectionBoxStyle}>
              <div style={cardTitleStyle}>Volunteering meta</div>
              <div style={{ ...helpTextStyle, marginTop: 6 }}>
                Project, position, and period. Description comes from JSON <code style={{ fontSize: 11 }}>volunteering</code>.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                <input
                  value={volunteeringMeta.project}
                  onChange={(e) => setVolunteeringMeta((p) => ({ ...p, project: e.target.value }))}
                  style={textInput}
                  placeholder="Project name"
                />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <input
                    value={volunteeringMeta.position}
                    onChange={(e) => setVolunteeringMeta((p) => ({ ...p, position: e.target.value }))}
                    style={textInput}
                    placeholder="Position title"
                  />
                  <input
                    value={volunteeringMeta.period}
                    onChange={(e) => setVolunteeringMeta((p) => ({ ...p, period: e.target.value }))}
                    style={textInput}
                    placeholder="Period (e.g. 07/2020 - 12/2020)"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* MIDDLE - PDF Preview */}
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              overflow: "hidden",
              boxShadow: "0 1px 3px rgba(16,24,40,0.06), 0 1px 2px rgba(16,24,40,0.04)",
              border: "1px solid #eef0f3",
              minWidth: 640,
              position: "sticky",
              top: 20,
            }}
          >
            <div
              style={{
                padding: "10px 14px",
                borderBottom: "1px solid #eef0f3",
                fontWeight: 600,
                fontSize: 13,
                color: "#374151",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#fafbfc",
              }}
            >
              <span>PDF Preview</span>
              <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 400 }}>selectable text</span>
            </div>
            <div style={{ height: "calc(100vh - 120px)" }}>
              <PDFViewer width="100%" height="100%" style={{ border: "none" }}>
                {pdfDoc}
              </PDFViewer>
            </div>
          </div>

          {/* RIGHT - Section Editors */}
          <div style={cardStyle}>
            <div style={sectionLabelStyle}>Section Editors</div>

            {/* Cover Letter */}
            <div style={{ ...sectionBoxStyle, marginTop: 0 }}>
              <div style={cardTitleStyle}>Cover Letter</div>

              {/* Cover letter file name + download */}
              <div style={{ marginTop: 8, marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
                  File name: <code style={{ fontSize: 11 }}>Cover Letter_[number].pdf</code>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", gap: 4 }}>
                    <input
                      value={order}
                      onChange={(e) => setOrder(e.target.value)}
                      style={{ ...textInput, width: 90 }}
                      placeholder="number (e.g. 001)"
                    />
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <button type="button" onClick={() => bumpOrder(1)} style={spinnerBtn} aria-label="Increment number">▲</button>
                      <button type="button" onClick={() => bumpOrder(-1)} style={spinnerBtn} aria-label="Decrement number">▼</button>
                    </div>
                  </div>
                  <PDFDownloadLink document={coverLetterPdfDoc} fileName={coverLetterFileName} style={downloadBtnPrimary}>
                    {({ loading }) => (loading ? "Building…" : "Download Cover Letter")}
                  </PDFDownloadLink>
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
                  Preview: <code style={{ fontSize: 12, color: "#111827" }}>{coverLetterFileName}</code>
                </div>
              </div>

              <textarea
                value={coverLetterEditable}
                onChange={(e) => setCoverLetterEditable(e.target.value)}
                rows={10}
                style={textareaBase}
              />
            </div>

            {/* Engineering Strengths */}
            <div style={sectionBoxStyle}>
              <div style={cardTitleStyle}>Engineering Strengths</div>
              <div style={helpTextStyle}>
                One bullet per line. Format: <code style={{ fontSize: 11 }}>Category: skills</code>.
              </div>
              <textarea
                value={esEditable}
                onChange={(e) => setEsEditable(e.target.value)}
                rows={8}
                style={textareaBase}
              />
            </div>

            {/* Certifications */}
            <div style={sectionBoxStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={cardTitleStyle}>
                  Certifications
                  {!showCerts && (
                    <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: "#b04141" }}>removed</span>
                  )}
                </div>
                {showCerts ? (
                  <button onClick={() => setShowCerts(false)} style={miniBtnDanger}>Remove section</button>
                ) : (
                  <button onClick={() => setShowCerts(true)} style={miniBtn}>Restore</button>
                )}
              </div>
              {showCerts ? (
                <>
                  <div style={{ ...helpTextStyle, marginTop: 8 }}>
                    One bullet per line. Synced from JSON; editable here for the final output.
                  </div>
                  <textarea
                    value={certificationsEditable}
                    onChange={(e) => setCertificationsEditable(e.target.value)}
                    rows={6}
                    style={textareaBase}
                  />
                </>
              ) : (
                <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280", fontStyle: "italic" }}>
                  Hidden from the PDF for this session.
                </div>
              )}
            </div>

            {/* Volunteering */}
            <div style={sectionBoxStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={cardTitleStyle}>
                  Volunteering
                  {!showVolunteering && (
                    <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: "#b04141" }}>removed</span>
                  )}
                </div>
                {showVolunteering ? (
                  <button onClick={() => setShowVolunteering(false)} style={miniBtnDanger}>Remove section</button>
                ) : (
                  <button onClick={() => setShowVolunteering(true)} style={miniBtn}>Restore</button>
                )}
              </div>
              {showVolunteering ? (
                <>
                  <div style={{ ...helpTextStyle, marginTop: 8 }}>
                    Description paragraph. Newlines join into one paragraph; blank line for an explicit paragraph break.
                  </div>
                  <textarea
                    value={volunteeringEditable}
                    onChange={(e) => setVolunteeringEditable(e.target.value)}
                    rows={5}
                    style={textareaBase}
                  />
                </>
              ) : (
                <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280", fontStyle: "italic" }}>
                  Hidden from the PDF for this session.
                </div>
              )}
            </div>
          </div>
        </div>

        <style>{`
          html, body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
          input:focus, textarea:focus { border-color: #9ca3af !important; box-shadow: 0 0 0 3px rgba(17,24,39,0.08); }
          button:hover { filter: brightness(0.97); }
          a:hover { filter: brightness(1.1); }
          @media (max-width: 1500px) {
            .gridWrap { grid-template-columns: 360px 1fr 360px !important; }
          }
          @media (max-width: 1280px) {
            .gridWrap { grid-template-columns: 360px 1fr !important; }
          }
          @media (max-width: 900px) {
            .gridWrap { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </div>
    </div>
  );
}
