import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

import type { GenerateType } from "@/lib/prompt-templates";

const NUMBERING_REFERENCE = "eduforge-numbering";

interface DocxHeaderOptions {
  toolType: GenerateType;
  title: string;
  schoolName?: string;
  className?: string;
  subject?: string;
  chapter?: string;
  periods?: string;
}

interface CreateDocxBlobOptions extends DocxHeaderOptions {
  content: string;
}

type DocxBlock = Paragraph | Table;

type RunFormat = {
  bold?: boolean;
  color?: string;
  size?: number;
};

const SCIENTIFIC_PATTERN =
  /([A-Za-z0-9/)\]]+)\^\{([^}]+)\}|([A-Za-z0-9/)\]]+)_\{([^}]+)\}|([A-Za-z0-9/)\]]+)\^([A-Za-z0-9+\-*/=().]+)|([A-Za-z0-9/)\]]+)_([A-Za-z0-9+\-*/=().]+)|(\b(?=[A-Za-z0-9]*\d)(?:[A-Z][a-z]?\d*)+\b)/g;

function cleanInlineMarkdown(value: string) {
  return value
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .trim();
}

function normalizeText(value: string) {
  return cleanInlineMarkdown(value).replace(/\s+/g, " ").trim().toLowerCase();
}

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

function createTextRun(text: string, format: RunFormat = {}) {
  return new TextRun({
    text,
    bold: format.bold,
    color: format.color,
    size: format.size,
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

    parts.push(
      new TextRun({
        text: match[0],
        color: format.color,
        size: format.size,
        subScript: true,
      }),
    );
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
      runs.push(
        new TextRun({
          text: braceSupValue,
          color: format.color,
          size: format.size,
          superScript: true,
        }),
      );
    } else if (braceSubBase && braceSubValue) {
      runs.push(createTextRun(braceSubBase, format));
      runs.push(
        new TextRun({
          text: braceSubValue,
          color: format.color,
          size: format.size,
          subScript: true,
        }),
      );
    } else if (supBase && supValue) {
      runs.push(createTextRun(supBase, format));
      runs.push(
        new TextRun({
          text: supValue,
          color: format.color,
          size: format.size,
          superScript: true,
        }),
      );
    } else if (subBase && subValue) {
      runs.push(createTextRun(subBase, format));
      runs.push(
        new TextRun({
          text: subValue,
          color: format.color,
          size: format.size,
          subScript: true,
        }),
      );
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
      after: options.spacingAfter ?? 140,
      line: 300,
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
    borderBottom?: boolean;
    spacingAfter?: number;
  } = {},
) {
  return createParagraphFromText(text, {
    alignment: AlignmentType.CENTER,
    bold: options.bold,
    size: options.size,
    color: options.color,
    borderBottom: options.borderBottom,
    spacingAfter: options.spacingAfter,
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
}: DocxHeaderOptions) {
  const blocks: Paragraph[] = [];
  const classSubject = [className?.trim(), subject?.trim()].filter(Boolean).join(" | ");
  const chapterText = chapter?.trim();
  const periodsText = periods?.trim();
  const headerLines = [schoolName?.trim(), classSubject, chapterText].filter(Boolean);

  if (headerLines.length > 0 || (toolType === "lesson_plan" && periodsText)) {
    if (schoolName?.trim()) {
      blocks.push(
        createCenteredHeaderParagraph(schoolName.trim(), {
          bold: true,
          size: 32,
          color: "0F172A",
          spacingAfter: 100,
        }),
      );
    }

    if (classSubject) {
      blocks.push(
        createCenteredHeaderParagraph(classSubject, {
          bold: true,
          size: 24,
          color: "475569",
          spacingAfter: 80,
        }),
      );
    }

    if (chapterText) {
      blocks.push(
        createCenteredHeaderParagraph(`Chapter / Topic: ${chapterText}`, {
          bold: true,
          size: 24,
          color: "475569",
          spacingAfter: toolType === "lesson_plan" && periodsText ? 80 : 140,
        }),
      );
    }

    if (toolType === "lesson_plan" && periodsText) {
      blocks.push(
        createCenteredHeaderParagraph(`Total Periods: ${periodsText}`, {
          bold: true,
          size: 24,
          color: "475569",
          spacingAfter: 140,
        }),
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
  }

  const firstContentLine = title.trim();
  if (firstContentLine) {
    blocks.push(
      createParagraphFromText(title, {
        heading: HeadingLevel.HEADING_1,
        bold: true,
        size: 32,
        color: "1E3A8A",
        spacingBefore: 60,
        spacingAfter: 180,
      }),
    );
  }

  return blocks;
}

function createTableBlock(headerCells: string[], bodyRows: string[][]) {
  return new Table({
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    rows: [
      new TableRow({
        children: headerCells.map((cell) => {
          return new TableCell({
            children: [
              createParagraphFromText(cell, {
                bold: true,
                size: 22,
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

function buildBodyBlocks(markdown: string, title: string) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: DocxBlock[] = [];
  let index = 0;
  let insertedTitle = false;

  while (index < lines.length) {
    const rawLine = lines[index] ?? "";
    const line = rawLine.trim();

    if (!line) {
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

      blocks.push(createTableBlock(headerCells, bodyRows));
      continue;
    }

    const headingMatch = rawLine.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const cleanedHeading = cleanInlineMarkdown(headingMatch[2]);
      const normalizedHeading = normalizeText(cleanedHeading);

      if (!insertedTitle && normalizedHeading === normalizeText(title)) {
        insertedTitle = true;
        index += 1;
        continue;
      }

      const level = Math.min(headingMatch[1].length, 3);
      blocks.push(
        createParagraphFromText(cleanedHeading, {
          heading:
            level === 1
              ? HeadingLevel.HEADING_1
              : level === 2
                ? HeadingLevel.HEADING_2
                : HeadingLevel.HEADING_3,
          bold: true,
          color: "1E3A8A",
          size: level === 1 ? 30 : level === 2 ? 28 : 24,
          spacingBefore: level === 1 ? 100 : 80,
          spacingAfter: 100,
        }),
      );
      index += 1;
      continue;
    }

    const unorderedMatch = rawLine.match(/^\s*[-*+]\s+(.+)$/);
    if (unorderedMatch) {
      blocks.push(
        createParagraphFromText(unorderedMatch[1], {
          bullet: { level: 0 },
          size: 22,
          color: "0F172A",
          spacingAfter: 80,
        }),
      );
      index += 1;
      continue;
    }

    const orderedMatch = rawLine.match(/^\s*\d+\.\s+(.+)$/);
    if (orderedMatch) {
      blocks.push(
        createParagraphFromText(orderedMatch[1], {
          numbering: { reference: NUMBERING_REFERENCE, level: 0 },
          size: 22,
          color: "0F172A",
          spacingAfter: 80,
        }),
      );
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

    blocks.push(
      createParagraphFromText(paragraphLines.join(" "), {
        size: 22,
        color: "0F172A",
        spacingAfter: 120,
      }),
    );
  }

  return {
    blocks,
    insertedTitle,
  };
}

export async function createDocxBlob({
  title,
  content,
  toolType,
  schoolName,
  className,
  subject,
  chapter,
  periods,
}: CreateDocxBlobOptions) {
  const body = buildBodyBlocks(content, title);
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
          }),
          ...body.blocks,
        ],
      },
    ],
  });

  return Packer.toBlob(document);
}
