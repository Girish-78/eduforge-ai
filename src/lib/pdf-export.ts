const PAGE_WIDTH_PX = 794;
const PAGE_HEIGHT_PX = 1123;
const PAGE_MARGIN_PX = 30;
const HEADER_HEIGHT_PX = 52;
const FOOTER_HEIGHT_PX = 24;
const PAGE_GAP_PX = 16;

export const PDF_EXPORT_SCALE = 2;

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
    height: ${PAGE_HEIGHT_PX}px;
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

  .pdf-export-header {
    height: ${HEADER_HEIGHT_PX}px;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    margin-bottom: 10px;
    overflow: hidden;
  }

  .pdf-export-header:empty {
    display: none;
  }

  .pdf-export-logo {
    max-width: 140px;
    max-height: 40px;
    object-fit: contain;
    display: block;
  }

  .pdf-export-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
    font-size: 15px;
    line-height: 1.6;
  }

  .pdf-export-body > *:first-child {
    margin-top: 0 !important;
  }

  .pdf-export-body h1,
  .pdf-export-body h2,
  .pdf-export-body h3 {
    margin-top: 16px;
    margin-bottom: 8px;
    color: #0f172a;
  }

  .pdf-export-body h1 {
    font-size: 24px;
    font-weight: 700;
  }

  .pdf-export-body h2 {
    font-size: 20px;
    font-weight: 600;
    padding-bottom: 6px;
    border-bottom: 1px solid #e2e8f0;
  }

  .pdf-export-body h3 {
    font-size: 18px;
    font-weight: 600;
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

  .pdf-export-body .pdf-table-wrapper,
  .pdf-export-body table {
    width: 100%;
    margin-top: 10px;
    border-collapse: collapse;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .pdf-export-body th,
  .pdf-export-body td {
    border: 1px solid #cbd5e1;
    padding: 8px;
    text-align: left;
    vertical-align: top;
  }

  .pdf-export-body thead {
    background: #f8fafc;
  }

  .pdf-export-footer {
    height: ${FOOTER_HEIGHT_PX}px;
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 10px;
    font-size: 11px;
    color: #475569;
  }

  .pdf-export-footer__brand,
  .pdf-export-footer__page {
    white-space: nowrap;
    font-weight: 600;
  }

  .pdf-export-footer__line {
    flex: 1 1 auto;
    border-bottom: 1px solid #cbd5e1;
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

function createHeader(logoDataUrl?: string | null) {
  const header = document.createElement("div");
  header.className = "pdf-export-header";

  if (!logoDataUrl) {
    return header;
  }

  const logo = document.createElement("img");
  logo.className = "pdf-export-logo";
  logo.src = logoDataUrl;
  logo.alt = "School logo";
  header.appendChild(logo);

  return header;
}

function createFooter(pageNumber: number) {
  const footer = document.createElement("div");
  footer.className = "pdf-export-footer";

  const brand = document.createElement("span");
  brand.className = "pdf-export-footer__brand";
  brand.textContent = "Eduforge-AI";

  const line = document.createElement("span");
  line.className = "pdf-export-footer__line";

  const page = document.createElement("span");
  page.className = "pdf-export-footer__page";
  page.textContent = `Page ${pageNumber}`;

  footer.append(brand, line, page);
  return footer;
}

function createPage(root: HTMLDivElement, logoDataUrl?: string | null) {
  const page = document.createElement("div");
  page.className = "pdf-export-page";

  const header = createHeader(logoDataUrl);
  const body = document.createElement("div");
  body.className = "pdf-export-body";
  const footer = createFooter(root.querySelectorAll(".pdf-export-page").length + 1);

  page.append(header, body, footer);
  root.appendChild(page);

  return { page, body };
}

function getBlocks(source: HTMLElement) {
  return Array.from(source.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement,
  );
}

function cloneListShell(list: HTMLElement) {
  const clone = document.createElement(list.tagName.toLowerCase());
  clone.className = list.className;
  return clone;
}

function bodyOverflows(body: HTMLDivElement) {
  return body.scrollHeight > body.clientHeight + 1;
}

function shouldMoveHeadingToNextPage(block: HTMLElement, body: HTMLDivElement) {
  if (block.tagName !== "H2" || body.childElementCount === 0) {
    return false;
  }

  const remainingHeight = body.clientHeight - body.scrollHeight;
  return remainingHeight < 96;
}

function appendBlockToPage(block: HTMLElement, body: HTMLDivElement) {
  const clone = block.cloneNode(true) as HTMLElement;
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
) {
  const nextPage = createPage(root, logoDataUrl);
  pages.push(nextPage.page);
  return nextPage;
}

function splitListAcrossPages(
  listBlock: HTMLElement,
  root: HTMLDivElement,
  pages: HTMLDivElement[],
  currentBody: HTMLDivElement,
  logoDataUrl?: string | null,
) {
  let pageState = { body: currentBody };
  let list = cloneListShell(listBlock);
  pageState.body.appendChild(list);

  const items = Array.from(listBlock.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement,
  );

  for (const item of items) {
    const clone = item.cloneNode(true) as HTMLElement;
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

      const nextPage = moveToNewPage(root, pages, logoDataUrl);
      pageState = { body: nextPage.body };
      list = cloneListShell(listBlock);
      pageState.body.appendChild(list);
      list.appendChild(item.cloneNode(true) as HTMLElement);
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

export async function buildPdfExportPages({
  source,
  logoDataUrl,
}: {
  source: HTMLElement;
  logoDataUrl?: string | null;
}) {
  const root = createRenderRoot();
  const pages: HTMLDivElement[] = [];
  let currentPage = createPage(root, logoDataUrl);
  pages.push(currentPage.page);

  const blocks = getBlocks(source);

  for (const block of blocks) {
    if (shouldMoveHeadingToNextPage(block, currentPage.body)) {
      currentPage = moveToNewPage(root, pages, logoDataUrl);
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
      );
      currentPage = {
        page: pages[pages.length - 1],
        body: pageState.body,
      };
      continue;
    }

    if (isTableBlock(block) && currentPage.body.childElementCount > 0) {
      currentPage = moveToNewPage(root, pages, logoDataUrl);
      currentPage.body.appendChild(block.cloneNode(true) as HTMLElement);
      continue;
    }

    if (currentPage.body.childElementCount === 0) {
      currentPage.body.appendChild(block.cloneNode(true) as HTMLElement);
      continue;
    }

    currentPage = moveToNewPage(root, pages, logoDataUrl);
    currentPage.body.appendChild(block.cloneNode(true) as HTMLElement);
  }

  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.setTimeout(resolve, 60);
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

export function createPrintDocumentMarkup(markup: string) {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Eduforge-AI Print</title>
    <style>
      @page {
        size: A4;
        margin: 0;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        background: #eef2f7;
      }

      ${PDF_EXPORT_STYLES}

      .pdf-export-root {
        position: static;
        left: auto;
        opacity: 1;
        pointer-events: auto;
        z-index: 1;
        width: auto;
        padding: ${PAGE_GAP_PX}px 0;
      }

      @media print {
        html,
        body {
          background: #ffffff;
        }

        .pdf-export-root {
          padding: 0;
        }

        .pdf-export-page {
          margin: 0;
          page-break-after: always;
        }

        .pdf-export-page:last-child {
          page-break-after: auto;
        }
      }
    </style>
  </head>
  <body>
    <div class="pdf-export-root">${markup}</div>
  </body>
</html>`;
}

export const pdfExportPageSize = {
  width: PAGE_WIDTH_PX,
  height: PAGE_HEIGHT_PX,
};
