import katex from "katex";

import type { GenerateType } from "@/lib/prompt-templates";

export interface ExportHeaderMetadata {
  title: string;
  toolType: GenerateType;
  schoolName?: string;
  className?: string;
  subject?: string;
  chapter?: string;
  periods?: string;
}

export interface PreparedExportMarkdown {
  content: string;
  exportTextContent: string;
  blocks: ExportContentBlock[];
  invalidMathCount: number;
  mathExpressionCount: number;
  strippedHeaderLineCount: number;
}

export interface ExportVisualAsset {
  placeholder: string;
  type: "image" | "svg";
  source: string;
  width: number;
  height: number;
  altText: string;
  caption?: string;
}

export type ExportContentBlock =
  | {
      type: "heading";
      level: 1 | 2 | 3;
      text: string;
    }
  | {
      type: "paragraph";
      text: string;
    }
  | {
      type: "list";
      ordered: boolean;
      items: string[];
    }
  | {
      type: "table";
      headerCells: string[];
      bodyRows: string[][];
    }
  | {
      type: "visual";
      asset: ExportVisualAsset;
    };

type MathSegment =
  | { type: "text"; value: string }
  | { type: "math"; displayMode: boolean; value: string };

const INLINE_MATH_SIGNAL_PATTERN =
  /\\[A-Za-z]+|[_^]|[=<>+\-*/]|[A-Za-z]\d|\d[A-Za-z]|[\u0370-\u03FF\u221E\u221A\u2211\u220F\u2248\u2264\u2265\u2260\u00B1\u00D7\u00F7\u2202\u2207\u2080-\u209C\u2070-\u207F]/u;

const UNICODE_SUBSCRIPT_MAP: Record<string, string> = {
  "\u2080": "0",
  "\u2081": "1",
  "\u2082": "2",
  "\u2083": "3",
  "\u2084": "4",
  "\u2085": "5",
  "\u2086": "6",
  "\u2087": "7",
  "\u2088": "8",
  "\u2089": "9",
  "\u208A": "+",
  "\u208B": "-",
  "\u208C": "=",
  "\u208D": "(",
  "\u208E": ")",
  "\u2090": "a",
  "\u2091": "e",
  "\u2095": "h",
  "\u1D62": "i",
  "\u2C7C": "j",
  "\u2096": "k",
  "\u2097": "l",
  "\u2098": "m",
  "\u2099": "n",
  "\u2092": "o",
  "\u209A": "p",
  "\u1D63": "r",
  "\u209B": "s",
  "\u209C": "t",
  "\u1D64": "u",
  "\u1D65": "v",
  "\u2093": "x",
};

const UNICODE_SUPERSCRIPT_MAP: Record<string, string> = {
  "\u2070": "0",
  "\u00B9": "1",
  "\u00B2": "2",
  "\u00B3": "3",
  "\u2074": "4",
  "\u2075": "5",
  "\u2076": "6",
  "\u2077": "7",
  "\u2078": "8",
  "\u2079": "9",
  "\u207A": "+",
  "\u207B": "-",
  "\u207C": "=",
  "\u207D": "(",
  "\u207E": ")",
  "\u1D43": "a",
  "\u1D47": "b",
  "\u1D9C": "c",
  "\u1D48": "d",
  "\u1D49": "e",
  "\u1DA0": "f",
  "\u1D4D": "g",
  "\u02B0": "h",
  "\u2071": "i",
  "\u02B2": "j",
  "\u1D4F": "k",
  "\u02E1": "l",
  "\u1D50": "m",
  "\u207F": "n",
  "\u1D52": "o",
  "\u1D56": "p",
  "\u02B3": "r",
  "\u02E2": "s",
  "\u1D57": "t",
  "\u1D58": "u",
  "\u1D5B": "v",
  "\u02B7": "w",
  "\u02E3": "x",
  "\u02B8": "y",
  "\u1DBB": "z",
};

const LATEX_COMMAND_TO_UNICODE: Record<string, string> = {
  alpha: "\u03B1",
  beta: "\u03B2",
  gamma: "\u03B3",
  delta: "\u03B4",
  epsilon: "\u03B5",
  varepsilon: "\u03B5",
  zeta: "\u03B6",
  eta: "\u03B7",
  theta: "\u03B8",
  vartheta: "\u03D1",
  iota: "\u03B9",
  kappa: "\u03BA",
  lambda: "\u03BB",
  mu: "\u03BC",
  nu: "\u03BD",
  xi: "\u03BE",
  pi: "\u03C0",
  varpi: "\u03D6",
  rho: "\u03C1",
  sigma: "\u03C3",
  varsigma: "\u03C2",
  tau: "\u03C4",
  upsilon: "\u03C5",
  phi: "\u03C6",
  varphi: "\u03C6",
  chi: "\u03C7",
  psi: "\u03C8",
  omega: "\u03C9",
  Gamma: "\u0393",
  Delta: "\u0394",
  Theta: "\u0398",
  Lambda: "\u039B",
  Xi: "\u039E",
  Pi: "\u03A0",
  Sigma: "\u03A3",
  Upsilon: "\u03A5",
  Phi: "\u03A6",
  Psi: "\u03A8",
  Omega: "\u03A9",
  times: "\u00D7",
  cdot: "\u00B7",
  pm: "\u00B1",
  mp: "\u2213",
  div: "\u00F7",
  neq: "\u2260",
  ne: "\u2260",
  leq: "\u2264",
  geq: "\u2265",
  approx: "\u2248",
  sim: "\u223C",
  propto: "\u221D",
  to: "\u2192",
  rightarrow: "\u2192",
  leftarrow: "\u2190",
  leftrightarrow: "\u2194",
  degree: "\u00B0",
  percent: "%",
  infty: "\u221E",
  partial: "\u2202",
  nabla: "\u2207",
  sum: "\u2211",
  prod: "\u220F",
};

const HTML_BREAK_PATTERN = /<br\s*\/?>/gi;
const HTML_BLOCK_OPEN_PATTERN =
  /<(?:p|div|section|article|header|footer|aside|main|blockquote|pre|figure|figcaption)\b[^>]*>/gi;
const HTML_BLOCK_CLOSE_PATTERN =
  /<\/(?:p|div|section|article|header|footer|aside|main|blockquote|pre|figure|figcaption)>/gi;
const HTML_LIST_OPEN_PATTERN = /<(?:ul|ol)\b[^>]*>/gi;
const HTML_LIST_CLOSE_PATTERN = /<\/(?:ul|ol)>/gi;
const HTML_LIST_ITEM_OPEN_PATTERN = /<li\b[^>]*>/gi;
const HTML_LIST_ITEM_CLOSE_PATTERN = /<\/li>/gi;
const HTML_HEADING_OPEN_PATTERN = /<h([1-6])\b[^>]*>/gi;
const HTML_HEADING_CLOSE_PATTERN = /<\/h[1-6]>/gi;
const HTML_TABLE_OPEN_PATTERN = /<(?:table|thead|tbody|tfoot)\b[^>]*>/gi;
const HTML_TABLE_CLOSE_PATTERN = /<\/(?:table|thead|tbody|tfoot)>/gi;
const HTML_TABLE_ROW_OPEN_PATTERN = /<tr\b[^>]*>/gi;
const HTML_TABLE_ROW_CLOSE_PATTERN = /<\/tr>/gi;
const HTML_TABLE_CELL_OPEN_PATTERN = /<t[dh]\b[^>]*>/gi;
const HTML_TABLE_CELL_CLOSE_PATTERN = /<\/t[dh]>/gi;
const HTML_TABLE_BLOCK_PATTERN = /<table\b[^>]*>[\s\S]*?<\/table>/gi;
const HTML_TABLE_ROW_BLOCK_PATTERN = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
const HTML_TABLE_CELL_BLOCK_PATTERN = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
const HTML_TAG_PATTERN = /<\/?[^>]+(>|$)/g;
const FIGURE_TAG_PATTERN = /<figure\b[^>]*>[\s\S]*?<\/figure>/gi;
const SVG_TAG_PATTERN = /<svg\b[^>]*>[\s\S]*?<\/svg>/gi;
const IMG_TAG_PATTERN = /<img\b[^>]*>/gi;
const FIGCAPTION_TAG_PATTERN = /<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i;
const VISUAL_PLACEHOLDER_PATTERN = /^\[\[EDUFORGE_VISUAL_(\d+)\]\]$/;
const VISUAL_PLACEHOLDER_PREFIX = "[[EDUFORGE_VISUAL_";
const HTML_ENTITY_MAP: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};
const ASCII_DIAGRAM_SIGNAL_PATTERN =
  /(?:->|=>|→|[|\\/]|[-=]{2,}>?|[│┆┇┊┋╎╏─━┄┅┈┉┠┨┯┷┼┌┐└┘├┤┬┴╭╮╯╰])/;
const ASCII_CONNECTOR_ONLY_PATTERN =
  /^[\s|\\/<>^vV=._\-│┆┇┊┋╎╏─━┄┅┈┉┠┨┯┷┼┌┐└┘├┤┬┴╭╮╯╰]+$/;
const ASCII_DIAGRAM_SPLIT_PATTERN =
  /\s*(?:->|=>|→|[-=]{2,}>?|[|\\/│┆┇┊┋╎╏─━┄┅┈┉┠┨┯┷┼┌┐└┘├┤┬┴╭╮╯╰]+|\s+[vV^]+\s+)\s*/g;

const UNORDERED_LIST_PATTERN = /^\s*[-*+•·●▪◦‣]\s+(.+)$/;
const ORDERED_LIST_PATTERN = /^\s*(\d+)[.)]\s+(.+)$/;
const HEADING_PATTERN = /^(#{1,6})\s+(.+)$/;
const DIAGRAM_SECTION_HEADING_PATTERN = /^#{1,6}\s+diagram\s*\/\s*flowchart/i;
const PHYSICS_DIAGRAM_PATTERN =
  /\b(ray|light|lens|mirror|circuit|force|prism|magnet|apparatus|reflection|refraction|image)\b/i;

export function cleanInlineMarkdown(value: string) {
  return value
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/(^|[\s(])\*([^*]+)\*(?=[\s).,;:!?]|$)/g, "$1$2")
    .replace(/(^|[\s(])_([^_]+)_(?=[\s).,;:!?]|$)/g, "$1$2")
    .trim();
}

function decodeHtmlEntities(value: string) {
  return value.replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (entity) => {
    return HTML_ENTITY_MAP[entity] ?? entity;
  });
}

function normalizeParagraphSpacing(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function getHtmlAttribute(markup: string, attributeName: string) {
  const escapedName = attributeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `${escapedName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "i",
  );
  const match = markup.match(pattern);
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? "";
}

function parseDimensionValue(value?: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.endsWith("%")) {
    return null;
  }

  const match = trimmed.match(/-?\d+(?:\.\d+)?/);
  if (!match) {
    return null;
  }

  const numericValue = Number(match[0]);
  return Number.isFinite(numericValue) && numericValue > 0 ? Math.round(numericValue) : null;
}

function parseSvgDimensions(markup: string) {
  const width = parseDimensionValue(getHtmlAttribute(markup, "width"));
  const height = parseDimensionValue(getHtmlAttribute(markup, "height"));

  if (width && height) {
    return { width, height };
  }

  const viewBox = getHtmlAttribute(markup, "viewBox");
  if (viewBox) {
    const values = viewBox
      .trim()
      .split(/[\s,]+/)
      .map((token) => Number(token))
      .filter((token) => Number.isFinite(token));

    if (values.length === 4 && values[2] > 0 && values[3] > 0) {
      return {
        width: width ?? Math.round(values[2]),
        height: height ?? Math.round(values[3]),
      };
    }
  }

  return {
    width: width ?? 640,
    height: height ?? 360,
  };
}

function normalizeSvgMarkup(markup: string) {
  const normalized = markup.trim();
  if (!normalized) {
    return normalized;
  }

  if (/xmlns\s*=\s*["']http:\/\/www\.w3\.org\/2000\/svg["']/i.test(normalized)) {
    return normalized;
  }

  return normalized.replace(
    /<svg\b/i,
    '<svg xmlns="http://www.w3.org/2000/svg"',
  );
}

function decodeDataUrlPayload(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;,]+)?(?:;charset=[^;,]+)?(;base64)?,(.*)$/i);
  if (!match) {
    return null;
  }

  const mimeType = (match[1] ?? "").toLowerCase();
  const encodedPayload = match[3] ?? "";

  try {
    let payload = "";

    if (match[2]) {
      if (typeof Buffer !== "undefined") {
        payload = Buffer.from(encodedPayload, "base64").toString("utf8");
      } else if (typeof atob === "function") {
        const binary = atob(encodedPayload);
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        payload = new TextDecoder().decode(bytes);
      } else {
        return null;
      }
    } else {
      payload = decodeURIComponent(encodedPayload);
    }

    return {
      mimeType,
      payload,
    };
  } catch {
    return null;
  }
}

function stripInlineHtml(value: string) {
  return normalizeParagraphSpacing(
    decodeHtmlEntities(
      value
        .replace(HTML_BREAK_PATTERN, "\n")
        .replace(HTML_TAG_PATTERN, " ")
        .replace(/[ \t]+\n/g, "\n"),
    ),
  );
}

function createVisualPlaceholder(index: number) {
  return `${VISUAL_PLACEHOLDER_PREFIX}${index}]]`;
}

function createVisualAsset(
  markup: string,
  caption?: string,
): Omit<ExportVisualAsset, "placeholder"> | null {
  const svgMatch = markup.match(/<svg\b[^>]*>[\s\S]*?<\/svg>/i);
  if (svgMatch?.[0]) {
    const normalizedSvg = normalizeSvgMarkup(svgMatch[0]);
    const dimensions = parseSvgDimensions(normalizedSvg);
    const svgAltText =
      stripInlineHtml(getHtmlAttribute(normalizedSvg, "aria-label")) ||
      stripInlineHtml(getHtmlAttribute(normalizedSvg, "title")) ||
      stripInlineHtml(caption ?? "") ||
      "Diagram";

    return {
      type: "svg",
      source: normalizedSvg,
      width: dimensions.width,
      height: dimensions.height,
      altText: svgAltText,
      caption: stripInlineHtml(caption ?? "") || undefined,
    };
  }

  const imageMatch = markup.match(/<img\b[^>]*>/i);
  if (!imageMatch?.[0]) {
    return null;
  }

  const imageTag = imageMatch[0];
  const src = getHtmlAttribute(imageTag, "src");
  if (!src) {
    return null;
  }

  const decodedDataUrl = src.startsWith("data:image/svg+xml")
    ? decodeDataUrlPayload(src)
    : null;
  if (decodedDataUrl?.payload) {
    const normalizedSvg = normalizeSvgMarkup(decodedDataUrl.payload);
    const dimensions = parseSvgDimensions(normalizedSvg);

    return {
      type: "svg",
      source: normalizedSvg,
      width: dimensions.width,
      height: dimensions.height,
      altText:
        stripInlineHtml(getHtmlAttribute(imageTag, "alt")) ||
        stripInlineHtml(caption ?? "") ||
        "Diagram",
      caption: stripInlineHtml(caption ?? "") || undefined,
    };
  }

  return {
    type: "image",
    source: src,
    width: parseDimensionValue(getHtmlAttribute(imageTag, "width")) ?? 640,
    height: parseDimensionValue(getHtmlAttribute(imageTag, "height")) ?? 360,
    altText:
      stripInlineHtml(getHtmlAttribute(imageTag, "alt")) ||
      stripInlineHtml(caption ?? "") ||
      "Illustration",
    caption: stripInlineHtml(caption ?? "") || undefined,
  };
}

function extractVisualAssets(content: string) {
  const visualAssets: ExportVisualAsset[] = [];

  const registerVisualAsset = (
    markup: string,
    caption?: string,
  ) => {
    const asset = createVisualAsset(markup, caption);
    if (!asset) {
      return markup;
    }

    const placeholder = createVisualPlaceholder(visualAssets.length + 1);
    visualAssets.push({
      ...asset,
      placeholder,
    });

    return `\n\n${placeholder}\n\n`;
  };

  const withoutFigures = content.replace(FIGURE_TAG_PATTERN, (figureMarkup) => {
    const caption = figureMarkup.match(FIGCAPTION_TAG_PATTERN)?.[1] ?? "";
    return registerVisualAsset(figureMarkup, caption);
  });

  const withoutStandaloneSvg = withoutFigures.replace(SVG_TAG_PATTERN, (svgMarkup) =>
    registerVisualAsset(svgMarkup),
  );

  const withPlaceholders = withoutStandaloneSvg.replace(IMG_TAG_PATTERN, (imageMarkup) =>
    registerVisualAsset(imageMarkup),
  );

  return {
    content: withPlaceholders,
    visualAssets,
  };
}

export function hasRichVisualContent(value: string) {
  return /<(?:figure|svg|img)\b/i.test(value);
}

const LESSON_PLAN_TABLE_HEADERS = [
  "week",
  "period",
  "topic subtopic",
  "learning objectives",
  "pedagogy 5e model",
  "resources",
  "assessment",
  "competencies",
];

export function getPreferredTableColumnPercentages(headerCells: string[]) {
  const normalizedHeaders = headerCells.map((header) => normalizeComparisonText(header));

  if (
    normalizedHeaders.length === LESSON_PLAN_TABLE_HEADERS.length &&
    normalizedHeaders.every((header, index) => header === LESSON_PLAN_TABLE_HEADERS[index])
  ) {
    return [7, 7, 16, 18, 24, 9, 9, 10];
  }

  if (
    normalizedHeaders.length === 2 &&
    normalizedHeaders[1]?.includes("mark")
  ) {
    return [84, 16];
  }

  if (
    normalizedHeaders.length === 3 &&
    normalizedHeaders[2]?.includes("mark")
  ) {
    return [52, 30, 18];
  }

  return null;
}

function isMarkdownTableSeparator(line: string) {
  return /^\|\s*[:\-| ]+\|?\s*$/.test(line.trim());
}

function isMarkdownTableRow(line: string) {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|");
}

function parseMarkdownTableRow(line: string) {
  return line
    .trim()
    .slice(1, -1)
    .split("|")
    .map((cell) => cleanInlineMarkdown(cell.trim()));
}

function isStructuredBlockLine(line: string, nextLine?: string) {
  if (!line.trim()) {
    return true;
  }

  if (VISUAL_PLACEHOLDER_PATTERN.test(line.trim())) {
    return true;
  }

  if (/^(#{1,3})\s+.+$/.test(line)) {
    return true;
  }

  if (/^\s*[-*+]\s+.+$/.test(line)) {
    return true;
  }

  if (/^\s*\d+\.\s+.+$/.test(line)) {
    return true;
  }

  return isMarkdownTableRow(line) && isMarkdownTableSeparator(nextLine ?? "");
}

export function buildStructuredExportBlocks(
  content: string,
  visualAssets: readonly ExportVisualAsset[] = [],
): ExportContentBlock[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ExportContentBlock[] = [];
  const visualAssetMap = new Map(
    visualAssets.map((asset) => [asset.placeholder, asset] as const),
  );
  let index = 0;

  while (index < lines.length) {
    const rawLine = lines[index] ?? "";
    const line = rawLine.trim();

    if (!line) {
      index += 1;
      continue;
    }

    const visualAsset = visualAssetMap.get(line);
    if (visualAsset) {
      blocks.push({
        type: "visual",
        asset: visualAsset,
      });
      index += 1;
      continue;
    }

    if (isMarkdownTableRow(line) && isMarkdownTableSeparator(lines[index + 1] ?? "")) {
      const headerCells = parseMarkdownTableRow(line);
      const bodyRows: string[][] = [];
      index += 2;

      while (index < lines.length && isMarkdownTableRow(lines[index] ?? "")) {
        bodyRows.push(parseMarkdownTableRow(lines[index] ?? ""));
        index += 1;
      }

      blocks.push({
        type: "table",
        headerCells,
        bodyRows,
      });
      continue;
    }

    const headingMatch = rawLine.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: Math.min(headingMatch[1].length, 3) as 1 | 2 | 3,
        text: cleanInlineMarkdown(headingMatch[2]),
      });
      index += 1;
      continue;
    }

    const unorderedMatch = rawLine.match(/^\s*[-*+]\s+(.+)$/);
    if (unorderedMatch) {
      const items: string[] = [];

      while (index < lines.length) {
        const nextMatch = (lines[index] ?? "").match(/^\s*[-*+]\s+(.+)$/);
        if (!nextMatch) {
          break;
        }

        items.push(cleanInlineMarkdown(nextMatch[1]));
        index += 1;
      }

      blocks.push({
        type: "list",
        ordered: false,
        items,
      });
      continue;
    }

    const orderedMatch = rawLine.match(/^\s*\d+\.\s+(.+)$/);
    if (orderedMatch) {
      const items: string[] = [];

      while (index < lines.length) {
        const nextMatch = (lines[index] ?? "").match(/^\s*\d+\.\s+(.+)$/);
        if (!nextMatch) {
          break;
        }

        items.push(cleanInlineMarkdown(nextMatch[1]));
        index += 1;
      }

      blocks.push({
        type: "list",
        ordered: true,
        items,
      });
      continue;
    }

    const paragraphLines = [line];
    index += 1;

    while (index < lines.length) {
      const nextLine = lines[index] ?? "";
      if (isStructuredBlockLine(nextLine, lines[index + 1])) {
        break;
      }

      paragraphLines.push(nextLine.trim());
      index += 1;
    }

    blocks.push({
      type: "paragraph",
      text: cleanInlineMarkdown(paragraphLines.join(" ")),
    });
  }

  return blocks;
}

function getPipeSeparatedCells(line: string) {
  const trimmed = line.trim();
  if (
    !trimmed ||
    !trimmed.includes("|") ||
    isMarkdownTableRow(trimmed) ||
    isMarkdownTableSeparator(trimmed) ||
    /(?:->|=>|→)/.test(trimmed)
  ) {
    return null;
  }

  const cells = trimmed.split("|").map((cell) => cleanInlineMarkdown(cell.trim()));
  if (cells.length < 2 || cells.some((cell) => !cell)) {
    return null;
  }

  return cells;
}

function normalizePipeSeparatedTables(value: string) {
  const lines = value.split("\n");
  const normalizedLines: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const firstRow = getPipeSeparatedCells(lines[index] ?? "");
    if (!firstRow) {
      normalizedLines.push(lines[index] ?? "");
      index += 1;
      continue;
    }

    const rows = [firstRow];
    let cursor = index + 1;

    while (cursor < lines.length) {
      const nextRow = getPipeSeparatedCells(lines[cursor] ?? "");
      if (!nextRow || nextRow.length !== firstRow.length) {
        break;
      }

      rows.push(nextRow);
      cursor += 1;
    }

    if (rows.length < 2) {
      normalizedLines.push(lines[index] ?? "");
      index += 1;
      continue;
    }

    normalizedLines.push(`| ${rows[0].join(" | ")} |`);
    normalizedLines.push(`| ${rows[0].map(() => "---").join(" | ")} |`);
    rows.slice(1).forEach((row) => {
      normalizedLines.push(`| ${row.join(" | ")} |`);
    });
    index = cursor;
  }

  return normalizedLines.join("\n");
}

function sanitizeTableCellText(value: string) {
  return stripInlineHtml(value)
    .replace(/\|/g, " / ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHtmlTables(value: string) {
  return value.replace(HTML_TABLE_BLOCK_PATTERN, (tableMarkup) => {
    const rowEntries: { cells: string[]; hasHeaderCell: boolean }[] = [];
    let rowMatch: RegExpExecArray | null = null;

    HTML_TABLE_ROW_BLOCK_PATTERN.lastIndex = 0;

    while ((rowMatch = HTML_TABLE_ROW_BLOCK_PATTERN.exec(tableMarkup)) !== null) {
      const rowMarkup = rowMatch[1] ?? "";
      const cells: string[] = [];
      let hasHeaderCell = false;
      let cellMatch: RegExpExecArray | null = null;

      HTML_TABLE_CELL_BLOCK_PATTERN.lastIndex = 0;

      while ((cellMatch = HTML_TABLE_CELL_BLOCK_PATTERN.exec(rowMarkup)) !== null) {
        const fullCellMarkup = cellMatch[0] ?? "";
        const cellContent = cellMatch[1] ?? "";
        const normalizedCell = sanitizeTableCellText(cellContent);

        if (normalizedCell) {
          cells.push(normalizedCell);
        } else {
          cells.push(" ");
        }

        if (/^<th\b/i.test(fullCellMarkup)) {
          hasHeaderCell = true;
        }
      }

      if (cells.length > 0) {
        rowEntries.push({
          cells,
          hasHeaderCell,
        });
      }
    }

    if (rowEntries.length === 0) {
      return "\n";
    }

    const headerRowIndex = rowEntries.findIndex((row) => row.hasHeaderCell);
    const normalizedRowCount = rowEntries.reduce(
      (max, row) => Math.max(max, row.cells.length),
      0,
    );

    if (normalizedRowCount === 0) {
      return "\n";
    }

    const normalizeRowWidth = (cells: string[]) => {
      const paddedCells = [...cells];
      while (paddedCells.length < normalizedRowCount) {
        paddedCells.push(" ");
      }
      return paddedCells;
    };

    const headerCells = normalizeRowWidth(
      rowEntries[headerRowIndex >= 0 ? headerRowIndex : 0]?.cells ?? [],
    );
    const bodyRows = rowEntries
      .filter((_, index) => index !== (headerRowIndex >= 0 ? headerRowIndex : 0))
      .map((row) => normalizeRowWidth(row.cells));

    const markdownLines = [
      `| ${headerCells.join(" | ")} |`,
      `| ${headerCells.map(() => "---").join(" | ")} |`,
      ...bodyRows.map((row) => `| ${row.join(" | ")} |`),
    ];

    return `\n${markdownLines.join("\n")}\n`;
  });
}

function normalizeListFormatting(value: string) {
  const lines = value.split("\n");
  const normalizedLines: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const rawLine = lines[index] ?? "";
    const trimmed = rawLine.trim();

    if (!trimmed) {
      normalizedLines.push("");
      index += 1;
      continue;
    }

    if (isMarkdownTableRow(trimmed) || isMarkdownTableSeparator(trimmed)) {
      normalizedLines.push(rawLine);
      index += 1;
      continue;
    }

    const headingMatch = trimmed.match(HEADING_PATTERN);
    if (headingMatch) {
      normalizedLines.push(`${headingMatch[1]} ${headingMatch[2].trim()}`);
      index += 1;
      continue;
    }

    const bulletMatch = trimmed.match(UNORDERED_LIST_PATTERN);
    if (bulletMatch) {
      normalizedLines.push(`- ${bulletMatch[1].trim()}`);
      index += 1;
      continue;
    }

    const orderedMatch = trimmed.match(ORDERED_LIST_PATTERN);
    if (!orderedMatch) {
      normalizedLines.push(rawLine);
      index += 1;
      continue;
    }

    const orderedBlock: { marker: number; content: string }[] = [];
    let cursor = index;

    while (cursor < lines.length) {
      const nextTrimmed = (lines[cursor] ?? "").trim();
      const nextMatch = nextTrimmed.match(ORDERED_LIST_PATTERN);
      if (!nextMatch) {
        break;
      }

      orderedBlock.push({
        marker: Number(nextMatch[1]),
        content: nextMatch[2].trim(),
      });
      cursor += 1;
    }

    const hasRepeatedMarkerPattern =
      orderedBlock.length > 1 &&
      orderedBlock.every((item) => item.marker === orderedBlock[0].marker);

    if (hasRepeatedMarkerPattern) {
      orderedBlock.forEach((item) => {
        normalizedLines.push(`- ${item.content}`);
      });
    } else {
      orderedBlock.forEach((item, orderedIndex) => {
        normalizedLines.push(`${orderedIndex + 1}. ${item.content}`);
      });
    }

    index = cursor;
  }

  return normalizedLines.join("\n");
}

type DiagramNormalizationResult = {
  line: string;
  wasDiagramLine: boolean;
};

function formatDiagramBranchLines(label: string, branches: string[]) {
  const normalizedLabel = cleanInlineMarkdown(label.replace(/[:\-–—]+$/, "").trim());
  const normalizedBranches = branches
    .map((branch) => cleanInlineMarkdown(branch))
    .filter(Boolean);

  if (!normalizedLabel && normalizedBranches.length === 0) {
    return "";
  }

  if (normalizedBranches.length === 0) {
    return normalizedLabel;
  }

  const prefixFormatter = PHYSICS_DIAGRAM_PATTERN.test(`${normalizedLabel} ${normalizedBranches.join(" ")}`)
    ? (branch: string, index: number) => `${index + 1}. ${branch}`
    : (branch: string) => `- ${branch}`;

  return `${normalizedLabel || "Diagram"}:\n${normalizedBranches
    .map((branch, index) => prefixFormatter(branch, index))
    .join("\n")}`;
}

function normalizeDiagramLine(line: string): DiagramNormalizationResult {
  const trimmed = line.trim();
  if (!trimmed) {
    return {
      line: "",
      wasDiagramLine: false,
    };
  }

  if (
    isMarkdownTableRow(trimmed) ||
    isMarkdownTableSeparator(trimmed) ||
    /^(#{1,6}\s+|[-*+]\s+|\d+\.\s+)/.test(trimmed)
  ) {
    return {
      line,
      wasDiagramLine: false,
    };
  }

  if (ASCII_CONNECTOR_ONLY_PATTERN.test(trimmed)) {
    return {
      line: "",
      wasDiagramLine: true,
    };
  }

  if (!ASCII_DIAGRAM_SIGNAL_PATTERN.test(trimmed)) {
    return {
      line,
      wasDiagramLine: false,
    };
  }

  const segments = trimmed
    .split(ASCII_DIAGRAM_SPLIT_PATTERN)
    .map((segment) =>
      segment
        .replace(/^[|\\/<>^vV=._\-│┆┇┊┋╎╏─━┄┅┈┉┠┨┯┷┼┌┐└┘├┤┬┴╭╮╯╰\s]+/, "")
        .replace(/[|\\/<>^vV=._\-│┆┇┊┋╎╏─━┄┅┈┉┠┨┯┷┼┌┐└┘├┤┬┴╭╮╯╰\s]+$/, "")
        .trim(),
    )
    .filter(Boolean);

  if (segments.length >= 3) {
    return {
      line: formatDiagramBranchLines(segments[0], segments.slice(1)),
      wasDiagramLine: true,
    };
  }

  if (segments.length === 2) {
    return {
      line: formatDiagramBranchLines(segments[0], [segments[1]]),
      wasDiagramLine: true,
    };
  }

  if (segments.length === 1) {
    return {
      line: cleanInlineMarkdown(segments[0]),
      wasDiagramLine: true,
    };
  }

  return {
    line,
    wasDiagramLine: true,
  };
}

function cleanBrokenAsciiDiagrams(value: string) {
  const normalizedLines: string[] = [];
  let insideConvertedDiagramBlock = false;

  value.split("\n").forEach((line) => {
    const normalized = normalizeDiagramLine(line);

    if (normalized.wasDiagramLine && normalized.line) {
      if (!insideConvertedDiagramBlock) {
        const previousNonEmptyLine = [...normalizedLines]
          .reverse()
          .find((entry) => entry.trim()) ?? "";

        if (
          previousNonEmptyLine.trim() &&
          !DIAGRAM_SECTION_HEADING_PATTERN.test(previousNonEmptyLine.trim())
        ) {
          normalizedLines.push("");
        }

        if (!DIAGRAM_SECTION_HEADING_PATTERN.test(previousNonEmptyLine.trim())) {
          normalizedLines.push("### Diagram / Flowchart");
        }
      }

      normalizedLines.push(normalized.line);
      insideConvertedDiagramBlock = true;
      return;
    }

    if (!normalized.line && insideConvertedDiagramBlock) {
      return;
    }

    if (normalized.line || normalizedLines[normalizedLines.length - 1]?.trim()) {
      normalizedLines.push(normalized.line);
    }
    insideConvertedDiagramBlock = false;
  });

  return normalizedLines.join("\n");
}

export function cleanGeneratedText(value: string) {
  return normalizeParagraphSpacing(
    decodeHtmlEntities(
      normalizeListFormatting(
        cleanBrokenAsciiDiagrams(
          normalizePipeSeparatedTables(
            normalizeHtmlTables(
              value
              .replace(/\r\n/g, "\n")
              .replace(HTML_BREAK_PATTERN, "\n")
              .replace(HTML_HEADING_OPEN_PATTERN, (_, level: string) => `${"#".repeat(Number(level))} `)
              .replace(HTML_HEADING_CLOSE_PATTERN, "\n\n")
              .replace(HTML_LIST_OPEN_PATTERN, "\n")
              .replace(HTML_LIST_CLOSE_PATTERN, "\n")
              .replace(HTML_LIST_ITEM_OPEN_PATTERN, "- ")
              .replace(HTML_LIST_ITEM_CLOSE_PATTERN, "\n")
              .replace(HTML_TABLE_OPEN_PATTERN, "\n")
              .replace(HTML_TABLE_CLOSE_PATTERN, "\n")
              .replace(HTML_TABLE_ROW_OPEN_PATTERN, "| ")
              .replace(HTML_TABLE_ROW_CLOSE_PATTERN, "\n")
              .replace(HTML_TABLE_CELL_OPEN_PATTERN, "")
              .replace(HTML_TABLE_CELL_CLOSE_PATTERN, " | ")
              .replace(HTML_BLOCK_OPEN_PATTERN, "")
              .replace(HTML_BLOCK_CLOSE_PATTERN, "\n\n")
              .replace(HTML_TAG_PATTERN, "")
              .replace(/[ \t]+\|/g, " |")
              .replace(/\|[ \t]+\|/g, " | "),
            ),
          ),
        ),
      ),
    ),
  );
}

export function normalizeText(value: string) {
  return cleanInlineMarkdown(value)
    .replace(/^#{1,6}\s+/, "")
    .replace(/^\s*[-*+]\s+/, "")
    .replace(/^\s*\d+\.\s+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeComparisonText(value: string) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, " ").trim();
}

function wrapMathScript(value: string, delimiter: "^" | "_") {
  if (!value) {
    return "";
  }

  return value.length === 1 ? `${delimiter}${value}` : `${delimiter}{${value}}`;
}

function convertUnicodeScripts(value: string, map: Record<string, string>, delimiter: "^" | "_") {
  let result = "";
  let buffer = "";

  const flush = () => {
    if (!buffer) {
      return;
    }

    result += wrapMathScript(buffer, delimiter);
    buffer = "";
  };

  for (const char of value) {
    if (char in map) {
      buffer += map[char];
      continue;
    }

    flush();
    result += char;
  }

  flush();
  return result;
}

export function normalizeLatexExpression(value: string) {
  return convertUnicodeScripts(
    convertUnicodeScripts(value.trim(), UNICODE_SUPERSCRIPT_MAP, "^"),
    UNICODE_SUBSCRIPT_MAP,
    "_",
  ).replace(/\s+/g, " ");
}

function looksLikeInlineMath(expression: string) {
  const trimmed = expression.trim();
  if (!trimmed) {
    return false;
  }

  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    return false;
  }

  return INLINE_MATH_SIGNAL_PATTERN.test(trimmed) || /^[A-Za-z]$/.test(trimmed);
}

function findClosingDelimiter(input: string, startIndex: number, delimiter: "$" | "$$") {
  let index = startIndex;

  while (index < input.length) {
    const currentChar = input[index];

    if (currentChar === "\\" && input[index + 1] === "$") {
      index += 2;
      continue;
    }

    if (delimiter === "$") {
      if (currentChar === "\n") {
        return -1;
      }

      if (currentChar === "$") {
        return index;
      }
    } else if (input.startsWith("$$", index)) {
      return index;
    }

    index += 1;
  }

  return -1;
}

export function splitMathSegments(input: string): MathSegment[] {
  const segments: MathSegment[] = [];
  let buffer = "";
  let index = 0;

  const pushText = () => {
    if (!buffer) {
      return;
    }

    segments.push({ type: "text", value: buffer });
    buffer = "";
  };

  while (index < input.length) {
    if (input[index] === "\\" && input[index + 1] === "$") {
      buffer += "$";
      index += 2;
      continue;
    }

    const delimiter = input.startsWith("$$", index)
      ? "$$"
      : input[index] === "$"
        ? "$"
        : null;

    if (!delimiter) {
      buffer += input[index];
      index += 1;
      continue;
    }

    const contentStart = index + delimiter.length;
    const closingIndex = findClosingDelimiter(input, contentStart, delimiter);

    if (closingIndex === -1) {
      buffer += delimiter;
      index += delimiter.length;
      continue;
    }

    const expression = input.slice(contentStart, closingIndex);
    const displayMode = delimiter === "$$";

    if (!displayMode && !looksLikeInlineMath(expression)) {
      buffer += `${delimiter}${expression}${delimiter}`;
      index = closingIndex + delimiter.length;
      continue;
    }

    pushText();
    segments.push({
      type: "math",
      displayMode,
      value: normalizeLatexExpression(expression),
    });
    index = closingIndex + delimiter.length;
  }

  pushText();
  return segments;
}

export function replaceMathSegments(
  input: string,
  replacer: (segment: Extract<MathSegment, { type: "math" }>) => string,
) {
  return splitMathSegments(input)
    .map((segment) => (segment.type === "math" ? replacer(segment) : segment.value))
    .join("");
}

function buildHeaderTargets(metadata: ExportHeaderMetadata) {
  const classSubject = [metadata.className?.trim(), metadata.subject?.trim()]
    .filter(Boolean)
    .join(" | ");
  const chapterText = metadata.chapter?.trim();
  const periodsText = metadata.periods?.trim();

  return [
    metadata.schoolName?.trim(),
    classSubject,
    chapterText,
    chapterText ? `Chapter / Topic: ${chapterText}` : "",
    periodsText ? `Total Periods: ${periodsText}` : "",
    metadata.title.trim(),
    metadata.schoolName?.trim() && metadata.title.trim()
      ? `${metadata.schoolName.trim()} ${metadata.title.trim()}`
      : "",
    metadata.title.trim() && metadata.schoolName?.trim()
      ? `${metadata.title.trim()} ${metadata.schoolName.trim()}`
      : "",
  ]
    .map((value) => normalizeComparisonText(value ?? ""))
    .filter(Boolean);
}

function isDuplicateHeaderLine(line: string, metadata: ExportHeaderMetadata, targets: string[]) {
  const normalizedLine = normalizeComparisonText(line);
  if (!normalizedLine) {
    return true;
  }

  if (
    targets.some(
      (target) =>
        normalizedLine === target ||
        normalizedLine.startsWith(target) ||
        target.startsWith(normalizedLine),
    )
  ) {
    return true;
  }

  const school = normalizeComparisonText(metadata.schoolName ?? "");
  const title = normalizeComparisonText(metadata.title);
  const classSubject = normalizeComparisonText(
    [metadata.className?.trim(), metadata.subject?.trim()].filter(Boolean).join(" | "),
  );
  const chapter = normalizeComparisonText(metadata.chapter ?? "");

  if (school && title && normalizedLine.includes(school) && normalizedLine.includes(title)) {
    return true;
  }

  if (classSubject && normalizedLine === classSubject) {
    return true;
  }

  if (chapter && normalizedLine.includes("chapter") && normalizedLine.includes(chapter)) {
    return true;
  }

  return false;
}

export function stripDuplicateHeaderLines(markdown: string, metadata: ExportHeaderMetadata) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const targets = buildHeaderTargets(metadata);
  let index = 0;
  let strippedHeaderLineCount = 0;

  while (index < lines.length) {
    const rawLine = lines[index] ?? "";
    const line = rawLine
      .replace(/^#{1,6}\s+/, "")
      .replace(/^\s*[-*+]\s+/, "")
      .replace(/^\s*\d+\.\s+/, "")
      .trim();

    if (!line) {
      strippedHeaderLineCount += 1;
      index += 1;
      continue;
    }

    if (!targets.length || !isDuplicateHeaderLine(line, metadata, targets)) {
      break;
    }

    strippedHeaderLineCount += 1;
    index += 1;
  }

  return {
    content: lines.slice(index).join("\n").trimStart(),
    strippedHeaderLineCount,
  };
}

function replaceCommandWithUnicode(command: string) {
  return LATEX_COMMAND_TO_UNICODE[command] ?? "";
}

function stripSimpleLatexMarkup(expression: string) {
  let normalized = normalizeLatexExpression(expression);

  while (/\\frac\{([^{}]+)\}\{([^{}]+)\}/.test(normalized)) {
    normalized = normalized.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "($1)/($2)");
  }

  while (/\\sqrt\{([^{}]+)\}/.test(normalized)) {
    normalized = normalized.replace(/\\sqrt\{([^{}]+)\}/g, "\u221A($1)");
  }

  normalized = normalized
    .replace(/\\(?:left|right)\b/g, "")
    .replace(/\\(?:mathrm|text|operatorname)\{([^{}]+)\}/g, "$1")
    .replace(/\\,/g, " ")
    .replace(/\\;/g, " ")
    .replace(/\\:/g, " ")
    .replace(/\\!/g, "")
    .replace(/\\([A-Za-z]+)/g, (_, command: string) => replaceCommandWithUnicode(command))
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return normalized;
}

export function renderMathToHtml(expression: string, displayMode = false) {
  try {
    return katex.renderToString(normalizeLatexExpression(expression), {
      throwOnError: false,
      displayMode,
    });
  } catch {
    return stripSimpleLatexMarkup(expression);
  }
}

export function renderMath(text: string) {
  if (!text) {
    return "";
  }

  return replaceMathSegments(text, (segment) =>
    renderMathToHtml(segment.value, segment.displayMode),
  );
}

export function renderMathToPlainText(markdown: string) {
  return replaceMathSegments(markdown, (segment) => {
    const plainText = stripSimpleLatexMarkup(segment.value);
    return segment.displayMode ? `\n${plainText}\n` : plainText;
  });
}

export function convertMarkdownMathToDocxText(markdown: string) {
  return renderMathToPlainText(markdown);
}

export function validateRenderedMath(markdown: string) {
  const mathSegments = splitMathSegments(markdown).filter(
    (segment): segment is Extract<MathSegment, { type: "math" }> => segment.type === "math",
  );

  const invalidMathCount = mathSegments.reduce((count, segment) => {
    const rendered = katex.renderToString(segment.value, {
      displayMode: segment.displayMode,
      throwOnError: false,
    });

    return rendered.includes("katex-error") ? count + 1 : count;
  }, 0);

  return {
    invalidMathCount,
    mathExpressionCount: mathSegments.length,
  };
}

export function prepareExportMarkdown(
  markdown: string,
  metadata: ExportHeaderMetadata,
): PreparedExportMarkdown {
  const extractedVisuals = extractVisualAssets(markdown);
  const normalizedMarkdown = cleanGeneratedText(extractedVisuals.content);
  const cleaned = stripDuplicateHeaderLines(normalizedMarkdown, metadata);
  const validation = validateRenderedMath(cleaned.content);
  const exportTextContent = normalizeParagraphSpacing(renderMathToPlainText(cleaned.content));

  return {
    content: cleaned.content,
    exportTextContent,
    blocks: buildStructuredExportBlocks(exportTextContent, extractedVisuals.visualAssets),
    strippedHeaderLineCount: cleaned.strippedHeaderLineCount,
    invalidMathCount: validation.invalidMathCount,
    mathExpressionCount: validation.mathExpressionCount,
  };
}
