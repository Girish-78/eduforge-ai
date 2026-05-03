import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { jsPDF } from "jspdf";

import {
  cleanInlineMarkdown,
  getPreferredTableColumnPercentages,
  normalizeText,
  prepareExportMarkdown,
} from "@/lib/export-content";
import type { ExportFilePayload } from "@/lib/export-types";

const FONT_REGULAR_FILE = "KaTeX_Main-Regular.ttf";
const FONT_BOLD_FILE = "KaTeX_Main-Bold.ttf";
const FONT_FAMILY = "KaTeXMain";
const PAGE_MARGIN_MM = 12;
const CONTENT_WIDTH_MM = 210 - PAGE_MARGIN_MM * 2;
const FOOTER_RESERVE_MM = 10;
const MAX_LOGO_WIDTH_MM = 40;
const MAX_LOGO_HEIGHT_MM = 16;

let fontCachePromise: Promise<{ regular: string; bold: string }> | null = null;

type PdfState = {
  y: number;
};

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
  if (state.y + requiredHeight <= pageHeight - PAGE_MARGIN_MM - FOOTER_RESERVE_MM) {
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
  const lineHeight = Math.max(5.4, options.size * 0.5);
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
  const lineHeight = Math.max(5.2, options.size * 0.5);
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

function addPageFooters(doc: jsPDF) {
  const totalPages = doc.getNumberOfPages();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    doc.setPage(pageNumber);
    doc.setDrawColor(215, 222, 232);
    doc.line(PAGE_MARGIN_MM, pageHeight - 10, PAGE_MARGIN_MM + CONTENT_WIDTH_MM, pageHeight - 10);
    doc.setFont(FONT_FAMILY, "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("Eduforge AI", PAGE_MARGIN_MM, pageHeight - 5.2);
    doc.text(
      `Page ${pageNumber} of ${totalPages}`,
      PAGE_MARGIN_MM + CONTENT_WIDTH_MM,
      pageHeight - 5.2,
      { align: "right" },
    );
  }
}

function addHeader(
  doc: jsPDF,
  state: PdfState,
  payload: ExportFilePayload,
  logo?:
    | {
        dataUrl: string;
        imageType: "jpg" | "png";
        width: number;
        height: number;
      }
    | null,
) {
  const classSubject = [payload.className, payload.subject].filter(Boolean).join(" | ");

  if (logo?.dataUrl && logo.width && logo.height) {
    const scale = Math.min(
      MAX_LOGO_WIDTH_MM / logo.width,
      MAX_LOGO_HEIGHT_MM / logo.height,
      1,
    );
    const width = Math.max(1, logo.width * scale);
    const height = Math.max(1, logo.height * scale);
    ensurePageSpace(doc, state, height + 6);
    doc.addImage(
      logo.dataUrl,
      logo.imageType === "jpg" ? "JPEG" : "PNG",
      PAGE_MARGIN_MM + (CONTENT_WIDTH_MM - width) / 2,
      state.y,
      width,
      height,
    );
    state.y += height + 4;
  }

  addCenteredText(doc, state, payload.schoolName ?? "", {
    bold: true,
    size: 18.5,
    spacingAfter: 4,
  });
  addCenteredText(doc, state, classSubject, {
    bold: true,
    size: 12.5,
    color: [71, 85, 105],
    spacingAfter: 3,
  });
  addCenteredText(
    doc,
    state,
    payload.chapter ? `Chapter / Topic: ${payload.chapter}` : "",
    {
      bold: true,
      size: 11.5,
      color: [71, 85, 105],
      spacingAfter: payload.periods ? 3 : 5,
    },
  );

  if (payload.toolType === "lesson_plan") {
    addCenteredText(
      doc,
      state,
      payload.periods ? `Total Periods: ${payload.periods}` : "",
      {
        bold: true,
        size: 11.5,
        color: [71, 85, 105],
        spacingAfter: 5,
      },
    );
  }

  if (
    !payload.schoolName &&
    !classSubject &&
    !payload.chapter &&
    !(payload.toolType === "lesson_plan" && payload.periods)
  ) {
    addCenteredText(doc, state, payload.title, {
      bold: true,
      size: 18.5,
      color: [30, 58, 138],
      spacingAfter: 5,
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
  const rowPadding = 3.4;
  const isDenseTable = headerCells.length >= 6;
  const lineHeight = isDenseTable ? 4.5 : 5;
  const columnPercentages =
    getPreferredTableColumnPercentages(headerCells) ??
    Array.from({ length: Math.max(headerCells.length, 1) }, () => 100 / Math.max(headerCells.length, 1));
  const columnWidths = columnPercentages.map(
    (percentage) => (CONTENT_WIDTH_MM * percentage) / 100,
  );

  const renderRow = (
    cells: string[],
    options: {
      isHeader?: boolean;
      repeatHeader?: { headerCells: string[]; bodyRows: string[][] };
    } = {},
  ) => {
    const preparedCells = cells.map((cell) => cleanInlineMarkdown(cell));
    const cellLines = preparedCells.map((cell, index) =>
      doc.splitTextToSize(
        cell || "-",
        Math.max((columnWidths[index] ?? columnWidths[0] ?? CONTENT_WIDTH_MM) - rowPadding * 2, 8),
      ),
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
      const x =
        PAGE_MARGIN_MM +
        columnWidths.slice(0, index).reduce((total, width) => total + width, 0);
      const width = columnWidths[index] ?? columnWidths[columnWidths.length - 1] ?? CONTENT_WIDTH_MM;
      if (options.isHeader) {
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        doc.rect(x, state.y, width, rowHeight, "FD");
      } else {
        doc.setDrawColor(203, 213, 225);
        doc.rect(x, state.y, width, rowHeight);
      }

      doc.setFont(FONT_FAMILY, options.isHeader ? "bold" : "normal");
      doc.setFontSize(
        options.isHeader ? (isDenseTable ? 9.2 : 10.5) : isDenseTable ? 8.7 : 10,
      );
      doc.setTextColor(15, 23, 42);
      const lines = cellLines[index];
      doc.text(
        lines.length > 0 ? lines : ["-"],
        x + rowPadding,
        state.y + rowPadding + lineHeight - 1,
        {
          maxWidth: width - rowPadding * 2,
        },
      );
    });

    state.y += rowHeight;
  };

  renderRow(headerCells, { isHeader: true });
  bodyRows.forEach((row) => {
    renderRow(row, { repeatHeader: { headerCells, bodyRows } });
  });
  state.y += 4;
}

function getPreparedExportBlocks(payload: ExportFilePayload) {
  return prepareExportMarkdown(payload.content, {
    title: payload.title,
    toolType: payload.toolType,
    schoolName: payload.schoolName,
    className: payload.className,
    subject: payload.subject,
    chapter: payload.chapter,
    periods: payload.periods,
  }).blocks;
}

export async function createPdfBuffer({
  payload,
  logo,
}: {
  payload: ExportFilePayload;
  logo?:
    | {
        dataUrl: string;
        imageType: "jpg" | "png";
        width: number;
        height: number;
      }
    | null;
}) {
  const doc = await createPdfDocument();
  const state: PdfState = { y: PAGE_MARGIN_MM };
  const blocks = getPreparedExportBlocks(payload);

  addHeader(doc, state, payload, logo);

  blocks.forEach((block) => {
    if (block.type === "table") {
      renderTable(doc, state, block.headerCells, block.bodyRows);
      return;
    }

    if (block.type === "visual") {
      const visualLabel = block.asset.caption || block.asset.altText || "Visual";
      addBlockText(doc, state, `[Visual retained in preview/print: ${visualLabel}]`, {
        size: 10.5,
        color: [71, 85, 105],
        spacingAfter: 4,
      });
      return;
    }

    if (block.type === "heading") {
      if (normalizeText(block.text) === normalizeText(payload.title)) {
        return;
      }

      addBlockText(doc, state, block.text, {
        bold: true,
        size: block.level === 1 ? 17 : block.level === 2 ? 15 : 13,
        color: [30, 58, 138],
        spacingAfter: 4,
      });
      return;
    }

    if (block.type === "list") {
      block.items.forEach((item, itemIndex) => {
        const prefix = block.ordered ? `${itemIndex + 1}. ` : "\u2022 ";
        addBlockText(doc, state, `${prefix}${item}`, {
          size: 11,
          indentMm: 2,
          spacingAfter: 3,
        });
      });
      return;
    }

    addBlockText(doc, state, cleanInlineMarkdown(block.text), {
      size: 11,
      spacingAfter: 4,
    });
  });

  addPageFooters(doc);

  return Buffer.from(doc.output("arraybuffer"));
}
