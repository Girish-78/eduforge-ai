import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

import {
  buildStructuredExportBlocks,
  cleanInlineMarkdown,
  normalizeText,
  prepareExportMarkdown,
  renderMathToPlainText,
} from "@/lib/export-content";
import type { ExportLogoAsset } from "@/lib/export-logo";
import type { GenerateType } from "@/lib/prompt-templates";

const NUMBERING_REFERENCE = "eduforge-numbering";
const DOCX_FONT_FAMILY = "Times New Roman";

interface DocxHeaderOptions {
  toolType: GenerateType;
  title: string;
  schoolName?: string;
  className?: string;
  subject?: string;
  chapter?: string;
  periods?: string;
  logo?: ExportLogoAsset | null;
}

interface CreateDocxBlobOptions extends DocxHeaderOptions {
  content: string;
  exportTextContent?: string;
}

type DocxBlock = Paragraph | Table;

type RunFormat = {
  bold?: boolean;
  color?: string;
  font?: string;
  size?: number;
};

const SCIENTIFIC_PATTERN =
  /([\p{Script=Greek}A-Za-z0-9/)\]]+)\^\{([^}]+)\}|([\p{Script=Greek}A-Za-z0-9/)\]]+)_\{([^}]+)\}|([\p{Script=Greek}A-Za-z0-9/)\]]+)\^([A-Za-z0-9+\-*/=().]+)|([\p{Script=Greek}A-Za-z0-9/)\]]+)_([A-Za-z0-9+\-*/=().]+)|(\b(?=[A-Za-z0-9]*\d)(?:[A-Z][a-z]?\d*)+\b)/gu;

function createTextRun(text: string, format: RunFormat = {}) {
  return new TextRun({
    text,
    bold: format.bold,
    color: format.color,
    font: format.font ?? DOCX_FONT_FAMILY,
    size: format.size,
  });
}

function createScriptTextRun(
  text: string,
  format: RunFormat,
  script: "super" | "sub",
) {
  return new TextRun({
    text,
    color: format.color,
    font: format.font ?? DOCX_FONT_FAMILY,
    size: format.size,
    superScript: script === "super",
    subScript: script === "sub",
  });
}

function buildChemicalRuns(token: string, format: RunFormat) {
  const parts: TextRun[] = [];
  const digitPattern = /\d+/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = digitPattern.exec(token)) !== null) {
    if (match.index > lastIndex) {
      parts.push(createTextRun(token.slice(lastIndex, match.index), format));
    }

    parts.push(createScriptTextRun(match[0], format, "sub"));
    lastIndex = digitPattern.lastIndex;
  }

  if (lastIndex < token.length) {
    parts.push(createTextRun(token.slice(lastIndex), format));
  }

  return parts;
}

function buildTextRuns(value: string, format: RunFormat = {}) {
  const cleaned = cleanInlineMarkdown(value);
  const runs: TextRun[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  SCIENTIFIC_PATTERN.lastIndex = 0;

  while ((match = SCIENTIFIC_PATTERN.exec(cleaned)) !== null) {
    if (match.index > lastIndex) {
      runs.push(createTextRun(cleaned.slice(lastIndex, match.index), format));
    }

    const keyText = match[0];
    const braceSupBase = match[1];
    const braceSupValue = match[2];
    const braceSubBase = match[3];
    const braceSubValue = match[4];
    const supBase = match[5];
    const supValue = match[6];
    const subBase = match[7];
    const subValue = match[8];
    const chemical = match[9];

    if (braceSupBase && braceSupValue) {
      runs.push(createTextRun(braceSupBase, format));
      runs.push(createScriptTextRun(braceSupValue, format, "super"));
    } else if (braceSubBase && braceSubValue) {
      runs.push(createTextRun(braceSubBase, format));
      runs.push(createScriptTextRun(braceSubValue, format, "sub"));
    } else if (supBase && supValue) {
      runs.push(createTextRun(supBase, format));
      runs.push(createScriptTextRun(supValue, format, "super"));
    } else if (subBase && subValue) {
      runs.push(createTextRun(subBase, format));
      runs.push(createScriptTextRun(subValue, format, "sub"));
    } else if (chemical) {
      runs.push(...buildChemicalRuns(chemical, format));
    } else {
      runs.push(createTextRun(keyText, format));
    }

    lastIndex = SCIENTIFIC_PATTERN.lastIndex;
  }

  if (lastIndex < cleaned.length) {
    runs.push(createTextRun(cleaned.slice(lastIndex), format));
  }

  return runs.length > 0 ? runs : [createTextRun(cleaned, format)];
}

function createParagraphFromText(
  text: string,
  options: {
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
    bullet?: { level: number };
    color?: string;
    heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel];
    numbering?: { reference: string; level: number };
    size?: number;
    spacingAfter?: number;
    spacingBefore?: number;
    bold?: boolean;
    borderBottom?: boolean;
  } = {},
) {
  return new Paragraph({
    alignment: options.alignment,
    bullet: options.bullet,
    heading: options.heading,
    numbering: options.numbering,
    spacing: {
      before: options.spacingBefore,
      after: options.spacingAfter ?? 160,
      line: 360,
    },
    border: options.borderBottom
      ? {
          bottom: {
            color: "D7DEE8",
            size: 6,
            style: BorderStyle.SINGLE,
            space: 1,
          },
        }
      : undefined,
    children: buildTextRuns(text, {
      bold: options.bold,
      color: options.color,
      size: options.size,
    }),
  });
}

function createCenteredHeaderParagraph(
  text: string,
  options: {
    bold?: boolean;
    size?: number;
    color?: string;
    spacingAfter?: number;
  } = {},
) {
  return createParagraphFromText(text, {
    alignment: AlignmentType.CENTER,
    bold: options.bold,
    size: options.size,
    color: options.color,
    spacingAfter: options.spacingAfter,
  });
}

function createHeaderLogoParagraph(logo: ExportLogoAsset) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: {
      after: 100,
    },
    children: [
      new ImageRun({
        data: logo.bytes,
        type: logo.imageType,
        transformation: {
          width: logo.width,
          height: logo.height,
        },
      }),
    ],
  });
}

function buildHeaderBlocks({
  toolType,
  title,
  schoolName,
  className,
  subject,
  chapter,
  periods,
  logo,
}: DocxHeaderOptions) {
  const blocks: Paragraph[] = [];
  const classSubject = [className?.trim(), subject?.trim()].filter(Boolean).join(" | ");
  const chapterText = chapter?.trim();
  const periodsText = periods?.trim();
  const hasStructuredHeader =
    Boolean(logo) ||
    Boolean(schoolName?.trim()) ||
    Boolean(classSubject) ||
    Boolean(chapterText) ||
    (toolType === "lesson_plan" && Boolean(periodsText));

  if (hasStructuredHeader) {
    if (logo) {
      blocks.push(createHeaderLogoParagraph(logo));
    }

    if (schoolName?.trim()) {
      blocks.push(
        createCenteredHeaderParagraph(renderMathToPlainText(schoolName.trim()), {
          bold: true,
          size: 32,
          color: "0F172A",
          spacingAfter: 100,
        }),
      );
    }

    if (classSubject) {
      blocks.push(
        createCenteredHeaderParagraph(renderMathToPlainText(classSubject), {
          bold: true,
          size: 24,
          color: "475569",
          spacingAfter: 80,
        }),
      );
    }

    if (chapterText) {
      blocks.push(
        createCenteredHeaderParagraph(
          `Chapter / Topic: ${renderMathToPlainText(chapterText)}`,
          {
            bold: true,
            size: 24,
            color: "475569",
            spacingAfter: toolType === "lesson_plan" && periodsText ? 80 : 140,
          },
        ),
      );
    }

    if (toolType === "lesson_plan" && periodsText) {
      blocks.push(
        createCenteredHeaderParagraph(
          `Total Periods: ${renderMathToPlainText(periodsText)}`,
          {
            bold: true,
            size: 24,
            color: "475569",
            spacingAfter: 140,
          },
        ),
      );
    }

    blocks.push(
      new Paragraph({
        spacing: { after: 220 },
        border: {
          bottom: {
            color: "D7DEE8",
            size: 6,
            style: BorderStyle.SINGLE,
            space: 1,
          },
        },
      }),
    );
  } else if (title.trim()) {
    blocks.push(
      createParagraphFromText(title, {
        heading: HeadingLevel.HEADING_1,
        bold: true,
        size: 32,
        color: "1E3A8A",
        spacingBefore: 80,
        spacingAfter: 220,
      }),
    );
  }

  return blocks;
}

function createTableBlock(headerCells: string[], bodyRows: string[][]) {
  const columnWidth = Math.max(1, Math.floor(100 / Math.max(headerCells.length, 1)));

  return new Table({
    layout: TableLayoutType.FIXED,
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    borders: {
      top: {
        style: BorderStyle.SINGLE,
        color: "CCCCCC",
        size: 4,
      },
      bottom: {
        style: BorderStyle.SINGLE,
        color: "CCCCCC",
        size: 4,
      },
      left: {
        style: BorderStyle.SINGLE,
        color: "CCCCCC",
        size: 4,
      },
      right: {
        style: BorderStyle.SINGLE,
        color: "CCCCCC",
        size: 4,
      },
      insideHorizontal: {
        style: BorderStyle.SINGLE,
        color: "CCCCCC",
        size: 4,
      },
      insideVertical: {
        style: BorderStyle.SINGLE,
        color: "CCCCCC",
        size: 4,
      },
    },
    rows: [
      new TableRow({
        children: headerCells.map((cell) => {
          return new TableCell({
            width: {
              size: columnWidth,
              type: WidthType.PERCENTAGE,
            },
            shading: {
              fill: "F8FAFC",
              color: "auto",
            },
            margins: {
              top: 150,
              bottom: 150,
              left: 150,
              right: 150,
            },
            children: [
              createParagraphFromText(cell, {
                bold: true,
                size: 24,
                color: "0F172A",
                spacingAfter: 40,
              }),
            ],
          });
        }),
      }),
      ...bodyRows.map((row) => {
        return new TableRow({
          children: row.map((cell) => {
            return new TableCell({
              width: {
                size: columnWidth,
                type: WidthType.PERCENTAGE,
              },
              margins: {
                top: 150,
                bottom: 150,
                left: 150,
                right: 150,
              },
              children: [
                createParagraphFromText(cell, {
                  size: 22,
                  color: "0F172A",
                  spacingAfter: 40,
                }),
              ],
            });
          }),
        });
      }),
    ],
  });
}

function getPreparedExportBlocks(options: CreateDocxBlobOptions) {
  if (options.exportTextContent?.trim()) {
    return buildStructuredExportBlocks(options.exportTextContent);
  }

  return prepareExportMarkdown(options.content, {
    title: options.title,
    toolType: options.toolType,
    schoolName: options.schoolName,
    className: options.className,
    subject: options.subject,
    chapter: options.chapter,
    periods: options.periods,
  }).blocks;
}

function buildBodyBlocks(preparedBlocks: ReturnType<typeof getPreparedExportBlocks>, title: string) {
  const blocks: DocxBlock[] = [];
  let insertedTitle = false;

  preparedBlocks.forEach((block) => {
    if (block.type === "table") {
      blocks.push(createTableBlock(block.headerCells, block.bodyRows));
      return;
    }

    if (block.type === "heading") {
      const normalizedHeading = normalizeText(block.text);

      if (!insertedTitle && normalizedHeading === normalizeText(title)) {
        insertedTitle = true;
        return;
      }

      blocks.push(
        createParagraphFromText(block.text, {
          heading:
            block.level === 1
              ? HeadingLevel.HEADING_1
              : block.level === 2
                ? HeadingLevel.HEADING_2
                : HeadingLevel.HEADING_3,
          bold: true,
          color: "1E3A8A",
          size: block.level === 1 ? 32 : block.level === 2 ? 28 : 24,
          spacingBefore: block.level === 1 ? 140 : block.level === 2 ? 110 : 90,
          spacingAfter: block.level === 1 ? 140 : 100,
        }),
      );
      return;
    }

    if (block.type === "list") {
      block.items.forEach((item) => {
        blocks.push(
          createParagraphFromText(item, {
            bullet: block.ordered ? undefined : { level: 0 },
            numbering: block.ordered
              ? { reference: NUMBERING_REFERENCE, level: 0 }
              : undefined,
            size: 22,
            color: "0F172A",
            spacingAfter: 90,
          }),
        );
      });
      return;
    }

    blocks.push(
      createParagraphFromText(block.text, {
        size: 22,
        color: "0F172A",
        spacingAfter: 140,
      }),
    );
  });

  return {
    blocks,
    insertedTitle,
  };
}

export async function createDocxBlob({
  title,
  content,
  exportTextContent,
  toolType,
  schoolName,
  className,
  subject,
  chapter,
  periods,
  logo,
}: CreateDocxBlobOptions) {
  const body = buildBodyBlocks(
    getPreparedExportBlocks({
      title,
      content,
      exportTextContent,
      toolType,
      schoolName,
      className,
      subject,
      chapter,
      periods,
      logo,
    }),
    title,
  );
  const document = new Document({
    creator: "Eduforge-AI",
    title,
    description: `${title} generated by Eduforge-AI`,
    numbering: {
      config: [
        {
          reference: NUMBERING_REFERENCE,
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: {
                    left: 720,
                    hanging: 260,
                  },
                },
              },
            },
          ],
        },
      ],
    },
    sections: [
      {
        children: [
          ...buildHeaderBlocks({
            toolType,
            title: body.insertedTitle ? "" : title,
            schoolName,
            className,
            subject,
            chapter,
            periods,
            logo,
          }),
          ...body.blocks,
        ],
      },
    ],
  });

  return Packer.toBlob(document);
}
