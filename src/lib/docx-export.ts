import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

import {
  cleanInlineMarkdown,
  getPreferredTableColumnPercentages,
  normalizeText,
  prepareExportMarkdown,
  renderMathToPlainText,
  type ExportVisualAsset,
} from "@/lib/export-content";
import type { ExportLogoAsset } from "@/lib/export-logo";
import type { GenerateType } from "@/lib/prompt-templates";

const NUMBERING_REFERENCE = "eduforge-numbering";
const DOCX_FONT_FAMILY = "Times New Roman";
const DOCX_MAX_VISUAL_WIDTH_PX = 520;
const DOCX_MAX_VISUAL_HEIGHT_PX = 300;
const TRANSPARENT_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2pRk8AAAAASUVORK5CYII=";

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

function clampVisualDimensions(width: number, height: number) {
  const safeWidth = width > 0 ? width : DOCX_MAX_VISUAL_WIDTH_PX;
  const safeHeight = height > 0 ? height : DOCX_MAX_VISUAL_HEIGHT_PX;
  const scale = Math.min(
    DOCX_MAX_VISUAL_WIDTH_PX / safeWidth,
    DOCX_MAX_VISUAL_HEIGHT_PX / safeHeight,
    1,
  );

  return {
    width: Math.max(1, Math.round(safeWidth * scale)),
    height: Math.max(1, Math.round(safeHeight * scale)),
  };
}

function createAltText(asset: ExportVisualAsset) {
  const name = (asset.altText || asset.caption || "Visual").trim();
  return {
    name: name.slice(0, 80) || "Visual",
    description: (asset.caption || asset.altText || "Visual").trim().slice(0, 200) || "Visual",
  };
}

function getTransparentPngBytes() {
  return Buffer.from(TRANSPARENT_PNG_BASE64, "base64");
}

function detectRegularImageType(source: Uint8Array, contentType?: string | null) {
  const normalizedContentType = contentType?.toLowerCase() ?? "";

  if (normalizedContentType.includes("image/png")) {
    return "png" as const;
  }

  if (normalizedContentType.includes("image/jpeg")) {
    return "jpg" as const;
  }

  if (normalizedContentType.includes("image/gif")) {
    return "gif" as const;
  }

  if (normalizedContentType.includes("image/bmp")) {
    return "bmp" as const;
  }

  if (source[0] === 0x89 && source[1] === 0x50 && source[2] === 0x4e && source[3] === 0x47) {
    return "png" as const;
  }

  if (source[0] === 0xff && source[1] === 0xd8) {
    return "jpg" as const;
  }

  if (source[0] === 0x47 && source[1] === 0x49 && source[2] === 0x46) {
    return "gif" as const;
  }

  if (source[0] === 0x42 && source[1] === 0x4d) {
    return "bmp" as const;
  }

  throw new Error("Unsupported image type for DOCX export.");
}

async function resolveVisualAssetData(asset: ExportVisualAsset) {
  if (asset.type === "svg") {
    return {
      type: "svg" as const,
      data: Buffer.from(asset.source, "utf8"),
    };
  }

  const dataUrlMatch = asset.source.match(/^data:([^;,]+)?(?:;charset=[^;,]+)?(;base64)?,(.*)$/i);
  if (dataUrlMatch) {
    const mimeType = (dataUrlMatch[1] ?? "").toLowerCase();
    const payload = dataUrlMatch[3] ?? "";
    const imageBytes = dataUrlMatch[2]
      ? Buffer.from(payload, "base64")
      : Buffer.from(decodeURIComponent(payload), "utf8");

    return {
      type: detectRegularImageType(imageBytes, mimeType),
      data: imageBytes,
    };
  }

  const response = await fetch(asset.source);
  if (!response.ok) {
    throw new Error(`Unable to load visual asset for DOCX export (status ${response.status}).`);
  }

  const contentType = response.headers.get("content-type");
  if (contentType?.toLowerCase().includes("image/svg+xml") || /\.svg(?:$|\?)/i.test(asset.source)) {
    return {
      type: "svg" as const,
      data: Buffer.from(await response.text(), "utf8"),
    };
  }

  const responseBytes = new Uint8Array(await response.arrayBuffer());
  return {
    type: detectRegularImageType(responseBytes, contentType),
    data: responseBytes,
  };
}

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
  const columnPercentages =
    getPreferredTableColumnPercentages(headerCells) ??
    Array.from({ length: Math.max(headerCells.length, 1) }, () =>
      Math.max(1, Math.floor(100 / Math.max(headerCells.length, 1))),
    );

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
        children: headerCells.map((cell, index) => {
          return new TableCell({
            width: {
              size: columnPercentages[index] ?? columnPercentages[columnPercentages.length - 1] ?? 100,
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
          children: row.map((cell, index) => {
            return new TableCell({
              width: {
                size: columnPercentages[index] ?? columnPercentages[columnPercentages.length - 1] ?? 100,
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

async function createVisualBlocks(asset: ExportVisualAsset): Promise<Paragraph[]> {
  const dimensions = clampVisualDimensions(asset.width, asset.height);

  try {
    const visualData = await resolveVisualAssetData(asset);
    const visualRun =
      visualData.type === "svg"
        ? new ImageRun({
            type: "svg",
            data: visualData.data,
            fallback: {
              type: "png",
              data: getTransparentPngBytes(),
            },
            transformation: dimensions,
            altText: createAltText(asset),
          })
        : new ImageRun({
            type: visualData.type,
            data: visualData.data,
            transformation: dimensions,
            altText: createAltText(asset),
          });

    const blocks = [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: {
          before: 120,
          after: asset.caption?.trim() ? 80 : 120,
        },
        children: [visualRun],
      }),
    ];

    if (asset.caption?.trim()) {
      blocks.push(
        createParagraphFromText(asset.caption, {
          alignment: AlignmentType.CENTER,
          color: "64748B",
          size: 20,
          spacingAfter: 120,
        }),
      );
    }

    return blocks;
  } catch (error) {
    const fallbackLabel = asset.caption || asset.altText || "Visual";
    console.error("DOCX visual export fallback applied", error);
    return [
      createParagraphFromText(`[Visual retained in preview/print: ${fallbackLabel}]`, {
        alignment: AlignmentType.CENTER,
        color: "64748B",
        size: 20,
        spacingAfter: 120,
      }),
    ];
  }
}

async function buildBodyBlocks(
  preparedBlocks: ReturnType<typeof getPreparedExportBlocks>,
  title: string,
) {
  const blocks: DocxBlock[] = [];
  let insertedTitle = false;

  for (const block of preparedBlocks) {
    if (block.type === "table") {
      blocks.push(createTableBlock(block.headerCells, block.bodyRows));
      continue;
    }

    if (block.type === "visual") {
      blocks.push(...(await createVisualBlocks(block.asset)));
      continue;
    }

    if (block.type === "heading") {
      const normalizedHeading = normalizeText(block.text);

      if (!insertedTitle && normalizedHeading === normalizeText(title)) {
        insertedTitle = true;
        continue;
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
      continue;
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
      continue;
    }

    blocks.push(
      createParagraphFromText(block.text, {
        size: 22,
        color: "0F172A",
        spacingAfter: 140,
      }),
    );
  }

  return {
    blocks,
    insertedTitle,
  };
}

function createDocumentFooter() {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: {
          before: 120,
          after: 0,
        },
        children: [
          createTextRun("Eduforge AI | Page ", {
            color: "64748B",
            size: 18,
          }),
          new TextRun({
            children: [PageNumber.CURRENT],
            color: "64748B",
            font: DOCX_FONT_FAMILY,
            size: 18,
          }),
          createTextRun(" of ", {
            color: "64748B",
            size: 18,
          }),
          new TextRun({
            children: [PageNumber.TOTAL_PAGES],
            color: "64748B",
            font: DOCX_FONT_FAMILY,
            size: 18,
          }),
        ],
      }),
    ],
  });
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
  const body = await buildBodyBlocks(
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
        properties: {
          page: {
            margin: {
              top: 1080,
              right: 900,
              bottom: 1080,
              left: 900,
              header: 420,
              footer: 540,
            },
          },
        },
        footers: {
          default: createDocumentFooter(),
        },
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
