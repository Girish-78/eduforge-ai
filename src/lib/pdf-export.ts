const PAGE_WIDTH_PX = 794;
const PAGE_HEIGHT_PX = 1123;
const PAGE_MARGIN_PX = 28;
const FOOTER_HEIGHT_PX = 28;
const PAGE_GAP_PX = 16;

export const PDF_EXPORT_SCALE = 2;

export interface PdfHeaderData {
  schoolName?: string | null;
  subject?: string | null;
  className?: string | null;
}

const PDF_EXPORT_STYLES = `
  .pdf-export-root {
    position: fixed;
    top: 0;
    left: -10000px;
    width: ${PAGE_WIDTH_PX}px;
    opacity: 0;
    pointer-events: none;
    z-index: -1;
    background: #ffffff;
  }

  .pdf-export-page {
    width: ${PAGE_WIDTH_PX}px;
    min-height: ${PAGE_HEIGHT_PX}px;
    box-sizing: border-box;
    margin: 0 0 ${PAGE_GAP_PX}px;
    padding: ${PAGE_MARGIN_PX}px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #ffffff;
    color: #0f172a;
    font-family: Arial, sans-serif;
  }

  .pdf-export-page:last-child {
    margin-bottom: 0;
  }

  .pdf-export-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin-bottom: 18px;
    padding-bottom: 16px;
    text-align: center;
    border-bottom: 1px solid #e2e8f0;
  }

  .pdf-export-logo {
    max-width: 120px;
    max-height: 72px;
    object-fit: contain;
    display: block;
  }

  .pdf-export-school {
    font-size: 22px;
    font-weight: 700;
    line-height: 1.2;
  }

  .pdf-export-meta {
    font-size: 13px;
    font-weight: 600;
    color: #475569;
    line-height: 1.3;
  }

  .pdf-export-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
    font-size: 14px;
    line-height: 1.55;
  }

  .pdf-export-body > *:first-child {
    margin-top: 0 !important;
  }

  .pdf-export-body h1,
  .pdf-export-body h2,
  .pdf-export-body h3 {
    margin-top: 14px;
    margin-bottom: 8px;
    color: #0f172a;
  }

  .pdf-export-body h1 {
    font-size: 22px;
    font-weight: 700;
  }

  .pdf-export-body h2 {
    font-size: 18px;
    font-weight: 700;
    padding-bottom: 6px;
    border-bottom: 1px solid #e2e8f0;
  }

  .pdf-export-body h3 {
    font-size: 16px;
    font-weight: 700;
  }

  .pdf-export-body p {
    margin: 0 0 10px;
  }

  .pdf-export-body ul,
  .pdf-export-body ol {
    margin: 0 0 10px;
    padding-left: 20px;
  }

  .pdf-export-body li {
    margin: 0 0 4px;
  }

  .pdf-export-body strong {
    font-weight: 700;
  }

  .pdf-export-body .pdf-table-wrapper {
    width: 100%;
    margin-top: 10px;
    overflow: visible !important;
    break-inside: avoid;
    page-break-inside: avoid;
    border: 1px solid #cbd5e1;
    border-radius: 0;
    background: #ffffff;
  }

  .pdf-export-body table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .pdf-export-body th,
  .pdf-export-body td {
    border: 1px solid #cbd5e1;
    padding: 7px 8px;
    text-align: left;
    vertical-align: top;
    word-break: break-word;
  }

  .pdf-export-body thead {
    background: #f8fafc;
  }

  .pdf-export-footer {
    height: ${FOOTER_HEIGHT_PX}px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-top: 12px;
    padding-top: 8px;
    border-top: 1px solid #cbd5e1;
    font-size: 11px;
    color: #475569;
  }

  .pdf-export-footer__brand,
  .pdf-export-footer__page {
    white-space: nowrap;
    font-weight: 600;
  }

  body.pdf-print-mode > * {
    display: none !important;
  }

  body.pdf-print-mode > .pdf-export-root {
    display: block !important;
    position: static;
    left: auto;
    top: auto;
    width: auto;
    opacity: 1;
    pointer-events: auto;
    z-index: 9999;
    padding: ${PAGE_GAP_PX}px 0;
  }

  @media print {
    @page {
      size: A4;
      margin: 0;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
    }

    body.pdf-print-mode > .pdf-export-root {
      padding: 0;
    }

    body.pdf-print-mode .pdf-export-page {
      margin: 0;
      page-break-after: always;
    }

    body.pdf-print-mode .pdf-export-page:last-child {
      page-break-after: auto;
    }
  }
`;

function createRenderRoot() {
  const root = document.createElement("div");
  root.className = "pdf-export-root";

  const style = document.createElement("style");
  style.textContent = PDF_EXPORT_STYLES;
  root.appendChild(style);

  document.body.appendChild(root);
  return root;
}

function createHeader(logoDataUrl?: string | null, headerData?: PdfHeaderData) {
  if (!logoDataUrl) {
    return null;
  }

  const header = document.createElement("div");
  header.className = "pdf-export-header";

  const logo = document.createElement("img");
  logo.className = "pdf-export-logo";
  logo.src = logoDataUrl;
  logo.alt = "School logo";
  header.appendChild(logo);

  if (headerData?.schoolName?.trim()) {
    const school = document.createElement("div");
    school.className = "pdf-export-school";
    school.textContent = headerData.schoolName.trim();
    header.appendChild(school);
  }

  const metaParts = [headerData?.subject?.trim(), headerData?.className?.trim()].filter(Boolean);
  if (metaParts.length > 0) {
    const meta = document.createElement("div");
    meta.className = "pdf-export-meta";
    meta.textContent = metaParts.join(" | ");
    header.appendChild(meta);
  }

  return header;
}

function createFooter(pageNumber: number) {
  const footer = document.createElement("div");
  footer.className = "pdf-export-footer";

  const brand = document.createElement("span");
  brand.className = "pdf-export-footer__brand";
  brand.textContent = "Eduforge-AI";

  const page = document.createElement("span");
  page.className = "pdf-export-footer__page";
  page.textContent = `Page ${pageNumber}`;

  footer.append(brand, page);
  return footer;
}

function createPage(
  root: HTMLDivElement,
  pageNumber: number,
  logoDataUrl?: string | null,
  headerData?: PdfHeaderData,
) {
  const page = document.createElement("div");
  page.className = "pdf-export-page";

  if (pageNumber === 1) {
    const header = createHeader(logoDataUrl, headerData);
    if (header) {
      page.appendChild(header);
    }
  }

  const body = document.createElement("div");
  body.className = "pdf-export-body";
  const footer = createFooter(pageNumber);

  page.append(body, footer);
  root.appendChild(page);

  return { page, body };
}

function getBlocks(source: HTMLElement) {
  return Array.from(source.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement,
  );
}

function normalizeExportNode(node: HTMLElement) {
  if (node.classList.contains("pdf-table-wrapper")) {
    node.style.overflow = "visible";
    node.style.maxWidth = "100%";
  }

  if (typeof node.className === "string" && node.className.includes("overflow")) {
    node.style.overflow = "visible";
  }

  if (typeof node.className === "string" && node.className.includes("max-h-")) {
    node.style.maxHeight = "none";
  }

  if (node.tagName === "TABLE") {
    node.style.width = "100%";
    node.style.tableLayout = "fixed";
  }

  Array.from(node.children).forEach((child) => {
    if (child instanceof HTMLElement) {
      normalizeExportNode(child);
    }
  });
}

function cloneBlockForExport(block: HTMLElement) {
  const clone = block.cloneNode(true) as HTMLElement;
  normalizeExportNode(clone);
  return clone;
}

function cloneListShell(list: HTMLElement) {
  const clone = document.createElement(list.tagName.toLowerCase());
  clone.className = list.className;
  normalizeExportNode(clone);
  return clone;
}

function bodyOverflows(body: HTMLDivElement) {
  return body.scrollHeight > body.clientHeight + 1;
}

function shouldMoveHeadingToNextPage(block: HTMLElement, body: HTMLDivElement) {
  if (!/^H[1-3]$/.test(block.tagName) || body.childElementCount === 0) {
    return false;
  }

  const remainingHeight = body.clientHeight - body.scrollHeight;
  return remainingHeight < 84;
}

function appendBlockToPage(block: HTMLElement, body: HTMLDivElement) {
  const clone = cloneBlockForExport(block);
  body.appendChild(clone);
  return clone;
}

function isListBlock(block: HTMLElement) {
  return block.tagName === "UL" || block.tagName === "OL";
}

function isTableBlock(block: HTMLElement) {
  return block.tagName === "TABLE" || block.classList.contains("pdf-table-wrapper");
}

function moveToNewPage(
  root: HTMLDivElement,
  pages: HTMLDivElement[],
  logoDataUrl?: string | null,
  headerData?: PdfHeaderData,
) {
  const pageNumber = pages.length + 1;
  const nextPage = createPage(root, pageNumber, logoDataUrl, headerData);
  pages.push(nextPage.page);
  return nextPage;
}

function splitListAcrossPages(
  listBlock: HTMLElement,
  root: HTMLDivElement,
  pages: HTMLDivElement[],
  currentBody: HTMLDivElement,
  logoDataUrl?: string | null,
  headerData?: PdfHeaderData,
) {
  let pageState = { body: currentBody };
  let list = cloneListShell(listBlock);
  pageState.body.appendChild(list);

  const items = Array.from(listBlock.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement,
  );

  for (const item of items) {
    const clone = cloneBlockForExport(item);
    list.appendChild(clone);

    if (bodyOverflows(pageState.body)) {
      list.removeChild(clone);
      const hasPreviousContent = pageState.body.childElementCount > 1;

      if (list.childElementCount === 0 && !hasPreviousContent) {
        list.appendChild(clone);
        continue;
      }

      if (list.childElementCount === 0 && hasPreviousContent) {
        pageState.body.removeChild(list);
      }

      const nextPage = moveToNewPage(root, pages, logoDataUrl, headerData);
      pageState = { body: nextPage.body };
      list = cloneListShell(listBlock);
      pageState.body.appendChild(list);
      list.appendChild(cloneBlockForExport(item));
    }
  }

  return pageState;
}

function getTableElement(block: HTMLElement) {
  if (block.tagName === "TABLE") {
    return block as HTMLTableElement;
  }

  return block.querySelector("table");
}

function createTableShell(block: HTMLElement) {
  const shell = cloneBlockForExport(block);
  const table = getTableElement(shell);
  if (!table) {
    return null;
  }

  const existingBodies = Array.from(table.tBodies);
  if (existingBodies.length === 0) {
    table.appendChild(document.createElement("tbody"));
  } else {
    existingBodies.forEach((tbody, index) => {
      if (index === 0) {
        tbody.replaceChildren();
      } else {
        tbody.remove();
      }
    });
  }

  return {
    block: shell,
    tbody: table.tBodies[0] as HTMLTableSectionElement,
  };
}

function getTableRows(block: HTMLElement) {
  const table = getTableElement(block);
  if (!table) {
    return [];
  }

  if (table.tBodies.length > 0) {
    return Array.from(table.tBodies[0].rows).filter(
      (row): row is HTMLTableRowElement => row instanceof HTMLTableRowElement,
    );
  }

  const headerRows = table.tHead?.rows.length ?? 0;
  return Array.from(table.rows)
    .slice(headerRows)
    .filter((row): row is HTMLTableRowElement => row instanceof HTMLTableRowElement);
}

function splitTableAcrossPages(
  tableBlock: HTMLElement,
  root: HTMLDivElement,
  pages: HTMLDivElement[],
  currentBody: HTMLDivElement,
  logoDataUrl?: string | null,
  headerData?: PdfHeaderData,
) {
  let pageState = { body: currentBody };
  let shell = createTableShell(tableBlock);
  const rows = getTableRows(tableBlock);

  if (!shell || rows.length === 0) {
    pageState.body.appendChild(cloneBlockForExport(tableBlock));
    return pageState;
  }

  pageState.body.appendChild(shell.block);

  for (const row of rows) {
    const rowClone = row.cloneNode(true) as HTMLTableRowElement;
    shell.tbody.appendChild(rowClone);

    if (bodyOverflows(pageState.body)) {
      shell.tbody.removeChild(rowClone);
      const tableHasRows = shell.tbody.childElementCount > 0;
      const bodyHasOtherContent = pageState.body.childElementCount > 1;

      if (!tableHasRows && bodyHasOtherContent) {
        pageState.body.removeChild(shell.block);
      }

      if (!tableHasRows && !bodyHasOtherContent) {
        shell.tbody.appendChild(rowClone);
        continue;
      }

      const nextPage = moveToNewPage(root, pages, logoDataUrl, headerData);
      pageState = { body: nextPage.body };
      shell = createTableShell(tableBlock);

      if (!shell) {
        pageState.body.appendChild(cloneBlockForExport(tableBlock));
        return pageState;
      }

      pageState.body.appendChild(shell.block);
      shell.tbody.appendChild(row.cloneNode(true) as HTMLTableRowElement);
    }
  }

  return pageState;
}

export async function resolveLogoDataUrl(logoUrl?: string | null) {
  if (!logoUrl) {
    return null;
  }

  try {
    const response = await fetch(logoUrl, { mode: "cors" });
    if (!response.ok) {
      throw new Error(`Logo fetch failed with status ${response.status}`);
    }

    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
          return;
        }

        reject(new Error("Unable to read logo file."));
      };
      reader.onerror = () => reject(reader.error ?? new Error("Unable to read logo file."));
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("resolveLogoDataUrl error", error);
    return null;
  }
}

export async function waitForImages(container: ParentNode) {
  const images = Array.from(container.querySelectorAll("img"));

  await Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          if (image.complete && image.naturalWidth > 0) {
            resolve();
            return;
          }

          const finalize = () => {
            image.removeEventListener("load", finalize);
            image.removeEventListener("error", finalize);
            resolve();
          };

          image.addEventListener("load", finalize, { once: true });
          image.addEventListener("error", finalize, { once: true });
        }),
    ),
  );
}

export async function buildPdfExportPages({
  source,
  logoDataUrl,
  headerData,
}: {
  source: HTMLElement;
  logoDataUrl?: string | null;
  headerData?: PdfHeaderData;
}) {
  const root = createRenderRoot();
  const pages: HTMLDivElement[] = [];
  let currentPage = createPage(root, 1, logoDataUrl, headerData);
  pages.push(currentPage.page);

  const blocks = getBlocks(source);

  for (const block of blocks) {
    if (shouldMoveHeadingToNextPage(block, currentPage.body)) {
      currentPage = moveToNewPage(root, pages, logoDataUrl, headerData);
    }

    const clone = appendBlockToPage(block, currentPage.body);

    if (!bodyOverflows(currentPage.body)) {
      continue;
    }

    currentPage.body.removeChild(clone);

    if (isListBlock(block)) {
      const pageState = splitListAcrossPages(
        block,
        root,
        pages,
        currentPage.body,
        logoDataUrl,
        headerData,
      );
      currentPage = {
        page: pages[pages.length - 1],
        body: pageState.body,
      };
      continue;
    }

    if (isTableBlock(block)) {
      const pageState = splitTableAcrossPages(
        block,
        root,
        pages,
        currentPage.body,
        logoDataUrl,
        headerData,
      );
      currentPage = {
        page: pages[pages.length - 1],
        body: pageState.body,
      };
      continue;
    }

    currentPage = moveToNewPage(root, pages, logoDataUrl, headerData);
    currentPage.body.appendChild(cloneBlockForExport(block));
  }

  await waitForImages(root);
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.setTimeout(resolve, 80);
    });
  });

  return {
    pages,
    root,
    cleanup() {
      root.remove();
    },
  };
}

export const pdfExportPageSize = {
  width: PAGE_WIDTH_PX,
  height: PAGE_HEIGHT_PX,
};

