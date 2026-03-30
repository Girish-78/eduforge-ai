function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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

function closeList(parts: string[], listType: "ul" | "ol" | null) {
  if (listType) {
    parts.push(`</${listType}>`);
  }
}

export function createDocxHtml(markdown: string) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const parts: string[] = [];
  let index = 0;
  let activeList: "ul" | "ol" | null = null;

  while (index < lines.length) {
    const rawLine = lines[index];
    const line = rawLine.trim();

    if (!line) {
      closeList(parts, activeList);
      activeList = null;
      index += 1;
      continue;
    }

    if (isMarkdownTableRow(line) && isMarkdownTableSeparator(lines[index + 1] ?? "")) {
      closeList(parts, activeList);
      activeList = null;

      const headerCells = parseTableRow(line);
      const bodyRows: string[][] = [];
      index += 2;

      while (index < lines.length && isMarkdownTableRow(lines[index] ?? "")) {
        bodyRows.push(parseTableRow(lines[index] ?? ""));
        index += 1;
      }

      parts.push("<table><thead><tr>");
      headerCells.forEach((cell) => {
        parts.push(`<th>${escapeHtml(cell)}</th>`);
      });
      parts.push("</tr></thead><tbody>");
      bodyRows.forEach((row) => {
        parts.push("<tr>");
        row.forEach((cell) => {
          parts.push(`<td>${escapeHtml(cell)}</td>`);
        });
        parts.push("</tr>");
      });
      parts.push("</tbody></table>");
      continue;
    }

    const headingMatch = rawLine.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      closeList(parts, activeList);
      activeList = null;

      const level = Math.min(headingMatch[1].length, 3);
      const content = cleanInlineMarkdown(headingMatch[2]);
      parts.push(`<h${level}>${escapeHtml(content)}</h${level}>`);
      index += 1;
      continue;
    }

    const unorderedMatch = rawLine.match(/^\s*[-*+]\s+(.+)$/);
    if (unorderedMatch) {
      if (activeList !== "ul") {
        closeList(parts, activeList);
        parts.push("<ul>");
        activeList = "ul";
      }

      parts.push(`<li>${escapeHtml(cleanInlineMarkdown(unorderedMatch[1]))}</li>`);
      index += 1;
      continue;
    }

    const orderedMatch = rawLine.match(/^\s*\d+\.\s+(.+)$/);
    if (orderedMatch) {
      if (activeList !== "ol") {
        closeList(parts, activeList);
        parts.push("<ol>");
        activeList = "ol";
      }

      parts.push(`<li>${escapeHtml(cleanInlineMarkdown(orderedMatch[1]))}</li>`);
      index += 1;
      continue;
    }

    closeList(parts, activeList);
    activeList = null;
    parts.push(`<p>${escapeHtml(cleanInlineMarkdown(line))}</p>`);
    index += 1;
  }

  closeList(parts, activeList);
  return parts.join("");
}

