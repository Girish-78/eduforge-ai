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
  invalidMathCount: number;
  mathExpressionCount: number;
  strippedHeaderLineCount: number;
}

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

export function convertMarkdownMathToDocxText(markdown: string) {
  return replaceMathSegments(markdown, (segment) => {
    const plainText = stripSimpleLatexMarkup(segment.value);
    return segment.displayMode ? `\n${plainText}\n` : plainText;
  });
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
  const cleaned = stripDuplicateHeaderLines(markdown, metadata);
  const validation = validateRenderedMath(cleaned.content);

  return {
    content: cleaned.content,
    strippedHeaderLineCount: cleaned.strippedHeaderLineCount,
    invalidMathCount: validation.invalidMathCount,
    mathExpressionCount: validation.mathExpressionCount,
  };
}
