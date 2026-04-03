import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { jsPDF } from "jspdf";

import {
  cleanInlineMarkdown,
  convertMarkdownMathToDocxText,
  normalizeText,
} from "@/lib/export-content";
import type { ExportFilePayload } from "@/lib/export-types";

const FONT_REGULAR_FILE = "KaTeX_Main-Regular.ttf";
const FONT_BOLD_FILE = "KaTeX_Main-Bold.ttf";
const FONT_FAMILY = "KaTeXMain";
const PAGE_MARGIN_MM = 20;
const CONTENT_WIDTH_MM = 210 - PAGE_MARGIN_MM * 2;
const MAX_LOGO_WIDTH_MM = 40;
const MAX_LOGO_HEIGHT_MM = 16;

let fontCachePromise: Promise<{ regular: string; bold: string }> | null = null;

type PdfState = {
  y: number;
};

function isMarkdownTableSeparator(line: string) {
  return /^\|\s*[:\-| ]+\|?\s*$/.test(line.trim());
}

function isMarkdownTableRow(line: string) {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|");
}

function parseTableRow(line: string) {
  return line
    .trim()
    .slice(1, -1)
    .split("|")
    .map((cell) => cleanInlineMarkdown(cell.trim()));
}

function isSpecialBlock(line: string, nextLine?: string) {
  if (!line.trim()) {
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

async function loadPdfFonts() {
  if (!fontCachePromise) {
    fontCachePromise = Promise.all([
      readFile(join(process.cwd(), "node_modules", "katex", "dist", "fonts", FONT_REGULAR_FILE)),
      readFile(join(process.cwd(), "node_modules", "katex", "dist", "fonts", FONT_BOLD_FILE)),
    ]).then(([regular, bold]) => ({
      regular: regular.toString("base64"),
      bold: bold.toString("base64"),
    }));
  }

  return fontCachePromise;
}

async function createPdfDocument() {
  const doc = new jsPDF({
    unit: "mm",
    format: "a4",
    orientation: "portrait",
    compress: true,
  });
  const fonts = await loadPdfFonts();

  doc.addFileToVFS(FONT_REGULAR_FILE, fonts.regular);
  doc.addFont(FONT_REGULAR_FILE, FONT_FAMILY, "normal");
  doc.addFileToVFS(FONT_BOLD_FILE, fonts.bold);
  doc.addFont(FONT_BOLD_FILE, FONT_FAMILY, "bold");
  doc.setFont(FONT_FAMILY, "normal");

  return doc;
}

function ensurePageSpace(doc: jsPDF, state: PdfState, requiredHeight: number) {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (state.y + requiredHeight <= pageHeight - PAGE_MARGIN_MM) {
    return;
  }

  doc.addPage();
  state.y = PAGE_MARGIN_MM;
}

function addCenteredText(
  doc: jsPDF,
  state: PdfState,
  text: string,
  options: {
    bold?: boolean;
    color?: [number, number, number];
    size: number;
    spacingAfter?: number;
  },
) {
  if (!text.trim()) {
    return;
  }

  doc.setFont(FONT_FAMILY, options.bold ? "bold" : "normal");
  doc.setFontSize(options.size);
  doc.setTextColor(...(options.color ?? [15, 23, 42]));
  const lines = doc.splitTextToSize(text, CONTENT_WIDTH_MM);
  const lineHeight = Math.max(5, options.size * 0.48);
  ensurePageSpace(doc, state, lines.length * lineHeight + (options.spacingAfter ?? 0));
  doc.text(lines, PAGE_MARGIN_MM + CONTENT_WIDTH_MM / 2, state.y, { align: "center" });
  state.y += lines.length * lineHeight + (options.spacingAfter ?? 0);
}

function addBlockText(
  doc: jsPDF,
  state: PdfState,
  text: string,
  options: {
    bold?: boolean;
    color?: [number, number, number];
    size: number;
    indentMm?: number;
    spacingAfter?: number;
  },
) {
  if (!text.trim()) {
    return;
  }

  const indentMm = options.indentMm ?? 0;
  const width = CONTENT_WIDTH_MM - indentMm;
  doc.setFont(FONT_FAMILY, options.bold ? "bold" : "normal");
  doc.setFontSize(options.size);
  doc.setTextColor(...(options.color ?? [15, 23, 42]));
  const lines = doc.splitTextToSize(text, width);
  const lineHeight = Math.max(4.8, options.size * 0.46);
  ensurePageSpace(doc, state, lines.length * lineHeight + (options.spacingAfter ?? 0));
  doc.text(lines, PAGE_MARGIN_MM + indentMm, state.y);
  state.y += lines.length * lineHeight + (options.spacingAfter ?? 0);
}

function drawDivider(doc: jsPDF, state: PdfState) {
  ensurePageSpace(doc, state, 6);
  doc.setDrawColor(215, 222, 232);
  doc.line(PAGE_MARGIN_MM, state.y, PAGE_MARGIN_MM + CONTENT_WIDTH_MM, state.y);
  state.y += 6;
}

function addHeader(
  doc: jsPDF,
  state: PdfState,
  payload: ExportFilePayload,
  logoDataUrl?: string | null,
) {
  const classSubject = [payload.className, payload.subject].filter(Boolean).join(" | ");

  if (logoDataUrl && payload.logo?.width && payload.logo.height) {
    const scale = Math.min(
      MAX_LOGO_WIDTH_MM / payload.logo.width,
      MAX_LOGO_HEIGHT_MM / payload.logo.height,
      1,
    );
    const width = Math.max(1, payload.logo.width * scale);
    const height = Math.max(1, payload.logo.height * scale);
    ensurePageSpace(doc, state, height + 6);
    doc.addImage(
      logoDataUrl,
      payload.logo.imageType === "jpg" ? "JPEG" : "PNG",
      PAGE_MARGIN_MM + (CONTENT_WIDTH_MM - width) / 2,
      state.y,
      width,
      height,
    );
    state.y += height + 4;
  }

  addCenteredText(doc, state, payload.schoolName ?? "", {
    bold: true,
    size: 18,
    spacingAfter: 3,
  });
  addCenteredText(doc, state, classSubject, {
    bold: true,
    size: 12,
    color: [71, 85, 105],
    spacingAfter: 2,
  });
  addCenteredText(
    doc,
    state,
    payload.chapter ? `Chapter / Topic: ${payload.chapter}` : "",
    {
      bold: true,
      size: 11,
      color: [71, 85, 105],
      spacingAfter: payload.periods ? 2 : 4,
    },
  );

  if (payload.toolType === "lesson_plan") {
    addCenteredText(
      doc,
      state,
      payload.periods ? `Total Periods: ${payload.periods}` : "",
      {
        bold: true,
        size: 11,
        color: [71, 85, 105],
        spacingAfter: 4,
      },
    );
  }

  if (!payload.schoolName && !classSubject && !payload.chapter && !(payload.toolType === "lesson_plan" && payload.periods)) {
    addCenteredText(doc, state, payload.title, {
      bold: true,
      size: 18,
      color: [30, 58, 138],
      spacingAfter: 4,
    });
  }

  drawDivider(doc, state);
}

function renderTable(
  doc: jsPDF,
  state: PdfState,
  headerCells: string[],
  bodyRows: string[][],
) {
  const rowPadding = 2;
  const lineHeight = 4.5;
  const columnWidth = CONTENT_WIDTH_MM / Math.max(headerCells.length, 1);

  const renderRow = (
    cells: string[],
    options: {
      isHeader?: boolean;
      repeatHeader?: { headerCells: string[]; bodyRows: string[][] };
    } = {},
  ) => {
    const preparedCells = cells.map((cell) => cleanInlineMarkdown(cell));
    const cellLines = preparedCells.map((cell) =>
      doc.splitTextToSize(cell || "-", Math.max(columnWidth - rowPadding * 2, 8)),
    );
    const rowHeight =
      Math.max(...cellLines.map((lines) => Math.max(lines.length, 1)), 1) * lineHeight +
      rowPadding * 2;

    if (state.y + rowHeight > doc.internal.pageSize.getHeight() - PAGE_MARGIN_MM) {
      doc.addPage();
      state.y = PAGE_MARGIN_MM;
      if (!options.isHeader && options.repeatHeader) {
        renderRow(options.repeatHeader.headerCells, { isHeader: true });
      }
    }

    preparedCells.forEach((_, index) => {
      const x = PAGE_MARGIN_MM + index * columnWidth;
      if (options.isHeader) {
        doc.setFillColor(239, 246, 255);
        doc.rect(x, state.y, columnWidth, rowHeight, "FD");
      } else {
        doc.rect(x, state.y, columnWidth, rowHeight);
      }

      doc.setFont(FONT_FAMILY, options.isHeader ? "bold" : "normal");
      doc.setFontSize(options.isHeader ? 10 : 9.5);
      doc.setTextColor(15, 23, 42);
      const lines = cellLines[index];
      doc.text(lines.length > 0 ? lines : ["-"], x + rowPadding, state.y + rowPadding + lineHeight - 1);
    });

    state.y += rowHeight;
  };

  renderRow(headerCells, { isHeader: true });
  bodyRows.forEach((row) => {
    renderRow(row, { repeatHeader: { headerCells, bodyRows } });
  });
  state.y += 4;
}

export async function createPdfBuffer({
  payload,
  logoDataUrl,
}: {
  payload: ExportFilePayload;
  logoDataUrl?: string | null;
}) {
  const doc = await createPdfDocument();
  const state: PdfState = { y: PAGE_MARGIN_MM };
  const lines = convertMarkdownMathToDocxText(payload.content).replace(/\r\n/g, "\n").split("\n");
  let index = 0;

  addHeader(doc, state, payload, logoDataUrl);

  while (index < lines.length) {
    const rawLine = lines[index] ?? "";
    const line = rawLine.trim();

    if (!line) {
      state.y += 2;
      index += 1;
      continue;
    }

    if (isMarkdownTableRow(line) && isMarkdownTableSeparator(lines[index + 1] ?? "")) {
      const headerCells = parseTableRow(line);
      const bodyRows: string[][] = [];
      index += 2;

      while (index < lines.length && isMarkdownTableRow(lines[index] ?? "")) {
        bodyRows.push(parseTableRow(lines[index] ?? ""));
        index += 1;
      }

      renderTable(doc, state, headerCells, bodyRows);
      continue;
    }

    const headingMatch = rawLine.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const cleanedHeading = cleanInlineMarkdown(headingMatch[2]);
      const normalizedHeading = normalizeText(cleanedHeading);
      if (normalizedHeading === normalizeText(payload.title)) {
        index += 1;
        continue;
      }

      const level = Math.min(headingMatch[1].length, 3);
      addBlockText(doc, state, cleanedHeading, {
        bold: true,
        size: level === 1 ? 16 : level === 2 ? 14 : 12,
        color: [30, 58, 138],
        spacingAfter: 3,
      });
      index += 1;
      continue;
    }

    const unorderedMatch = rawLine.match(/^\s*[-*+]\s+(.+)$/);
    if (unorderedMatch) {
      addBlockText(doc, state, `• ${cleanInlineMarkdown(unorderedMatch[1])}`, {
        size: 10.5,
        indentMm: 2,
        spacingAfter: 2,
      });
      index += 1;
      continue;
    }

    const orderedMatch = rawLine.match(/^\s*(\d+)\.\s+(.+)$/);
    if (orderedMatch) {
      addBlockText(doc, state, `${orderedMatch[1]}. ${cleanInlineMarkdown(orderedMatch[2])}`, {
        size: 10.5,
        indentMm: 2,
        spacingAfter: 2,
      });
      index += 1;
      continue;
    }

    const paragraphLines = [line];
    index += 1;

    while (index < lines.length) {
      const nextLine = lines[index] ?? "";
      if (isSpecialBlock(nextLine, lines[index + 1])) {
        break;
      }

      paragraphLines.push(nextLine.trim());
      index += 1;
    }

    addBlockText(doc, state, cleanInlineMarkdown(paragraphLines.join(" ")), {
      size: 10.5,
      spacingAfter: 3,
    });
  }

  return Buffer.from(doc.output("arraybuffer"));
}
