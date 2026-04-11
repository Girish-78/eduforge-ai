export interface GeneratedDocumentMetadata {
  schoolName?: string;
  subject?: string;
  className?: string;
  chapter?: string;
  periods?: string;
  title: string;
  branding?: string;
  logoDataUrl?: string | null;
}

export interface ParsedToolPromptMetadata {
  toolTitle?: string;
  schoolName?: string;
  subject?: string;
  className?: string;
  chapter?: string;
  periods?: string;
}

const FULL_DOCUMENT_BODY_PATTERN = /<body\b[^>]*>([\s\S]*?)<\/body>/i;
const CODE_FENCE_HTML_PATTERN = /^```(?:html)?\s*([\s\S]*?)\s*```$/i;
const HTML_SIGNAL_PATTERN = /<(?:section|article|div|table|svg|p|h[1-6]|ul|ol|li)\b/i;
const DANGEROUS_BLOCK_TAG_PATTERN =
  /<\s*(script|iframe|object|embed|link|meta|form|input|button|textarea|select)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;
const DANGEROUS_SELF_CLOSING_TAG_PATTERN =
  /<\s*(script|iframe|object|embed|link|meta|input|button|textarea|select)\b[^>]*\/?\s*>/gi;
const STYLE_TAG_PATTERN = /<style\b[^>]*>[\s\S]*?<\/style>/gi;
const EVENT_HANDLER_PATTERN = /\s+on[a-z-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const JAVASCRIPT_URL_PATTERN =
  /\s+(?:href|src)\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*'|javascript:[^\s>]+)/gi;

export const GENERATED_DOCUMENT_STYLE = `
  .eduforge-document {
    width: 100%;
    color: #0f172a;
    font-family: Cambria, "Times New Roman", Georgia, serif;
    font-size: 16px;
    line-height: 1.55;
  }

  .eduforge-document__page {
    box-sizing: border-box;
    width: min(100%, 794px);
    margin: 0 auto;
    padding: 0.95in 0.7in 0.9in;
    background: #ffffff;
    border-radius: 22px;
    box-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
  }

  .eduforge-document__header {
    margin-bottom: 26px;
    padding-bottom: 14px;
    border-bottom: 1px solid #d7dee8;
    text-align: center;
  }

  .eduforge-document__logo {
    display: block;
    width: auto;
    max-width: 160px;
    max-height: 60px;
    margin: 0 auto 10px;
    object-fit: contain;
  }

  .eduforge-document__school {
    margin: 0;
    font-size: 24px;
    font-weight: 700;
    line-height: 1.2;
    letter-spacing: 0.01em;
  }

  .eduforge-document__meta,
  .eduforge-document__chapter,
  .eduforge-document__periods {
    margin: 6px 0 0;
    font-size: 14px;
    font-weight: 600;
    color: #475569;
  }

  .eduforge-document__title {
    margin: 10px 0 0;
    font-size: 21px;
    font-weight: 700;
    color: #1e3a8a;
    letter-spacing: 0.02em;
  }

  .eduforge-document__body {
    color: #0f172a;
  }

  .eduforge-document__body > *:first-child {
    margin-top: 0;
  }

  .eduforge-document__body section,
  .eduforge-document__body article,
  .eduforge-document__body figure,
  .eduforge-document__body table,
  .eduforge-document__body svg,
  .eduforge-document__body .formula-box,
  .eduforge-document__body .summary-box,
  .eduforge-document__body .page-break {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .eduforge-document__body .page-break {
    break-before: page;
    page-break-before: always;
  }

  .eduforge-document__body h1,
  .eduforge-document__body h2,
  .eduforge-document__body h3 {
    margin: 0 0 10px;
    color: #1e3a8a;
    line-height: 1.25;
    break-after: avoid;
    page-break-after: avoid;
  }

  .eduforge-document__body h1 {
    margin-top: 0;
    font-size: 26px;
    color: #0f172a;
  }

  .eduforge-document__body h2 {
    margin-top: 28px;
    padding-bottom: 6px;
    border-bottom: 1px solid #dbe5f1;
    font-size: 22px;
  }

  .eduforge-document__body h3 {
    margin-top: 20px;
    font-size: 18px;
  }

  .eduforge-document__body p,
  .eduforge-document__body li {
    margin: 0 0 12px;
    font-size: 16px;
    line-height: 1.55;
  }

  .eduforge-document__body ul,
  .eduforge-document__body ol {
    margin: 0 0 16px 22px;
    padding: 0;
  }

  .eduforge-document__body strong {
    font-weight: 700;
    color: #0f172a;
  }

  .eduforge-document__body sup,
  .eduforge-document__body sub {
    font-size: 0.78em;
    line-height: 0;
    position: relative;
    vertical-align: baseline;
  }

  .eduforge-document__body sup {
    top: -0.48em;
  }

  .eduforge-document__body sub {
    bottom: -0.18em;
  }

  .eduforge-document__body table {
    width: 100%;
    margin: 18px 0 24px;
    border-collapse: separate;
    border-spacing: 0;
    table-layout: fixed;
    border: 1px solid #cbd5e1;
    border-radius: 14px;
    overflow: hidden;
    background: #ffffff;
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
    font-size: 14px;
    line-height: 1.45;
  }

  .eduforge-document__body thead {
    display: table-header-group;
    background: #e8f0ff;
  }

  .eduforge-document__body tfoot {
    display: table-footer-group;
  }

  .eduforge-document__body th,
  .eduforge-document__body td {
    border-right: 1px solid #d9e2ef;
    border-bottom: 1px solid #d9e2ef;
    padding: 10px 11px;
    text-align: left;
    vertical-align: top;
    word-break: break-word;
    overflow-wrap: anywhere;
    background: #ffffff;
  }

  .eduforge-document__body th {
    font-weight: 700;
    color: #0f172a;
    background: #e8f0ff;
  }

  .eduforge-document__body th:last-child,
  .eduforge-document__body td:last-child {
    border-right: 0;
  }

  .eduforge-document__body tbody tr:last-child td {
    border-bottom: 0;
  }

  .eduforge-document__body tbody tr:nth-child(even) td {
    background: #f8fbff;
  }

  .eduforge-document__body td > ul,
  .eduforge-document__body td > ol,
  .eduforge-document__body th > ul,
  .eduforge-document__body th > ol {
    margin: 0 0 0 16px;
  }

  .eduforge-document__body td p:last-child,
  .eduforge-document__body th p:last-child,
  .eduforge-document__body td ul:last-child,
  .eduforge-document__body td ol:last-child {
    margin-bottom: 0;
  }

  .eduforge-document__body table h1,
  .eduforge-document__body table h2,
  .eduforge-document__body table h3 {
    margin-top: 0;
    margin-bottom: 8px;
    padding-bottom: 0;
    border-bottom: 0;
  }

  .eduforge-document__body .lesson-plan-table {
    font-size: 13.25px;
    line-height: 1.38;
  }

  .eduforge-document__body .lesson-plan-table thead tr:first-child th[colspan] {
    background: linear-gradient(180deg, #eef4ff 0%, #dce9ff 100%);
    padding: 14px 16px;
    border-bottom: 2px solid #b7c9e6;
  }

  .eduforge-document__body .lesson-plan-table thead tr:first-child h2 {
    margin: 0 0 6px;
    font-size: 18px;
    color: #0f172a;
  }

  .eduforge-document__body .lesson-plan-table thead tr:first-child p {
    margin: 0;
    font-size: 12.5px;
    color: #334155;
    line-height: 1.45;
  }

  .eduforge-document__body .lesson-plan-table thead tr:last-child th {
    padding: 10px 8px;
    background: #d7e7ff;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .eduforge-document__body .lesson-plan-table th:nth-child(1),
  .eduforge-document__body .lesson-plan-table td:nth-child(1) {
    width: 7%;
    text-align: center;
  }

  .eduforge-document__body .lesson-plan-table th:nth-child(2),
  .eduforge-document__body .lesson-plan-table td:nth-child(2) {
    width: 7%;
    text-align: center;
  }

  .eduforge-document__body .lesson-plan-table th:nth-child(3),
  .eduforge-document__body .lesson-plan-table td:nth-child(3) {
    width: 16%;
  }

  .eduforge-document__body .lesson-plan-table th:nth-child(4),
  .eduforge-document__body .lesson-plan-table td:nth-child(4) {
    width: 18%;
  }

  .eduforge-document__body .lesson-plan-table th:nth-child(5),
  .eduforge-document__body .lesson-plan-table td:nth-child(5) {
    width: 24%;
  }

  .eduforge-document__body .lesson-plan-table th:nth-child(6),
  .eduforge-document__body .lesson-plan-table td:nth-child(6),
  .eduforge-document__body .lesson-plan-table th:nth-child(7),
  .eduforge-document__body .lesson-plan-table td:nth-child(7),
  .eduforge-document__body .lesson-plan-table th:nth-child(8),
  .eduforge-document__body .lesson-plan-table td:nth-child(8) {
    width: 9.3%;
  }

  .eduforge-document__body .formula-box,
  .eduforge-document__body .summary-box,
  .eduforge-document__body blockquote {
    margin: 14px 0 18px;
    padding: 12px 14px;
    border: 1px solid #cbd5e1;
    border-left: 4px solid #2563eb;
    border-radius: 14px;
    background: #f8fbff;
  }

  .eduforge-document__body figure {
    margin: 18px 0;
  }

  .eduforge-document__body figcaption {
    margin-top: 8px;
    font-size: 13px;
    color: #475569;
    text-align: center;
  }

  .eduforge-document__body svg,
  .eduforge-document__body img {
    display: block;
    max-width: 100%;
    height: auto;
    margin: 12px auto;
  }

  .eduforge-document__footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-top: 30px;
    padding-top: 10px;
    border-top: 1px solid #d7dee8;
    font-size: 12px;
    color: #64748b;
  }

  .eduforge-document__footer-page::after {
    content: "1";
  }

  @media print {
    @page {
      size: A4;
      margin: 1in 0.75in;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
    }

    .eduforge-document__page {
      width: auto;
      margin: 0;
      padding: 0;
      border-radius: 0;
      box-shadow: none;
    }

    .eduforge-document__footer-page::after {
      content: counter(page);
    }
  }
`;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function isLikelyHtml(value: string) {
  return HTML_SIGNAL_PATTERN.test(value);
}

function stripCodeFence(value: string) {
  const match = value.trim().match(CODE_FENCE_HTML_PATTERN);
  return match?.[1]?.trim() ?? value.trim();
}

function extractBodyContent(value: string) {
  const normalized = stripCodeFence(value);
  const bodyMatch = normalized.match(FULL_DOCUMENT_BODY_PATTERN);
  return bodyMatch?.[1]?.trim() ?? normalized;
}

function sanitizeHtml(value: string) {
  return value
    .replace(DANGEROUS_BLOCK_TAG_PATTERN, "")
    .replace(DANGEROUS_SELF_CLOSING_TAG_PATTERN, "")
    .replace(STYLE_TAG_PATTERN, "")
    .replace(EVENT_HANDLER_PATTERN, "")
    .replace(JAVASCRIPT_URL_PATTERN, "");
}

function convertPlainTextToHtml(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "<p></p>";
  }

  return trimmed
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function buildMetaLine(metadata: GeneratedDocumentMetadata) {
  return [metadata.subject?.trim(), metadata.className?.trim()].filter(Boolean).join(" | ");
}

function buildHeaderHtml(metadata: GeneratedDocumentMetadata) {
  const metaLine = buildMetaLine(metadata);
  const chapterText = metadata.chapter?.trim();
  const periodsText = metadata.periods?.trim();

  return [
    '<header class="eduforge-document__header">',
    metadata.logoDataUrl
      ? `<img class="eduforge-document__logo" src="${metadata.logoDataUrl}" alt="School logo" />`
      : "",
    metadata.schoolName?.trim()
      ? `<div class="eduforge-document__school">${escapeHtml(metadata.schoolName.trim())}</div>`
      : "",
    metaLine ? `<div class="eduforge-document__meta">${escapeHtml(metaLine)}</div>` : "",
    chapterText
      ? `<div class="eduforge-document__chapter">${escapeHtml(chapterText)}</div>`
      : "",
    periodsText
      ? `<div class="eduforge-document__periods">Periods: ${escapeHtml(periodsText)}</div>`
      : "",
    `<div class="eduforge-document__title">${escapeHtml(metadata.title)}</div>`,
    "</header>",
  ].join("");
}

function buildFooterHtml(metadata: GeneratedDocumentMetadata) {
  const branding = metadata.branding?.trim() || "Eduforge AI";

  return [
    '<footer class="eduforge-document__footer">',
    `<span>${escapeHtml(branding)}</span>`,
    '<span>Page <span class="eduforge-document__footer-page"></span></span>',
    "</footer>",
  ].join("");
}

export function prepareGeneratedBodyHtml(value: string) {
  const extracted = extractBodyContent(value);
  const sanitized = sanitizeHtml(extracted);
  return isLikelyHtml(sanitized) ? sanitized : convertPlainTextToHtml(sanitized);
}

function buildGeneratedDocumentMarkup(
  bodyContent: string,
  metadata: GeneratedDocumentMetadata,
) {
  const bodyHtml = prepareGeneratedBodyHtml(bodyContent);

  return [
    '<div class="eduforge-document">',
    '<article class="eduforge-document__page">',
    buildHeaderHtml(metadata),
    `<main class="eduforge-document__body">${bodyHtml}</main>`,
    buildFooterHtml(metadata),
    "</article>",
    "</div>",
  ].join("");
}

export function buildGeneratedDocumentFragment(
  bodyContent: string,
  metadata: GeneratedDocumentMetadata,
) {
  return [
    `<style>${GENERATED_DOCUMENT_STYLE}</style>`,
    buildGeneratedDocumentMarkup(bodyContent, metadata),
  ].join("");
}

export function buildGeneratedDocumentHtml(
  bodyContent: string,
  metadata: GeneratedDocumentMetadata,
) {
  return [
    "<!DOCTYPE html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8" />',
    `<title>${escapeHtml(metadata.title)}</title>`,
    `<style>${GENERATED_DOCUMENT_STYLE}</style>`,
    "</head>",
    `<body>${buildGeneratedDocumentMarkup(bodyContent, metadata)}</body>`,
    "</html>",
  ].join("");
}

function getPromptLineValue(input: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = input.match(new RegExp(`^${escaped}:\\s*(.+)$`, "mi"));
  return match?.[1]?.trim() ?? "";
}

export function parseToolPromptMetadata(input: string): ParsedToolPromptMetadata {
  return {
    toolTitle: getPromptLineValue(input, "Tool"),
    schoolName: getPromptLineValue(input, "School Name"),
    subject: getPromptLineValue(input, "Subject"),
    className: getPromptLineValue(input, "Class"),
    chapter: getPromptLineValue(input, "Chapter / Topic"),
    periods:
      getPromptLineValue(input, "No. of Periods") ||
      getPromptLineValue(input, "Periods") ||
      getPromptLineValue(input, "Total Periods"),
  };
}
