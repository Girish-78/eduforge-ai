const MM_TO_PX = 96 / 25.4;
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const PDF_MARGIN_MM = 20;
const PRINT_MARGIN_TOP_MM = 25;
const PRINT_MARGIN_RIGHT_MM = 20;
const PRINT_MARGIN_BOTTOM_MM = 20;
const PRINT_MARGIN_LEFT_MM = 20;
const PRINT_HEADER_TOP_MM = 10;
const EXPORT_SURFACE_PADDING_PX = 20;
const PAGE_WIDTH_PX = Math.round((A4_WIDTH_MM - PDF_MARGIN_MM * 2) * MM_TO_PX);
const PAGE_HEIGHT_PX = Math.round((A4_HEIGHT_MM - PDF_MARGIN_MM * 2) * MM_TO_PX);

export const PDF_EXPORT_SCALE = 2;

export const pdfExportConfig = {
  margin: [PDF_MARGIN_MM, PDF_MARGIN_MM, PDF_MARGIN_MM, PDF_MARGIN_MM] as const,
  image: { type: "jpeg" as const, quality: 0.98 },
  html2canvas: {
    scale: PDF_EXPORT_SCALE,
    useCORS: true,
    allowTaint: false,
  },
  jsPDF: {
    unit: "mm" as const,
    format: "a4",
    orientation: "portrait" as const,
  },
};

interface WaitForImagesOptions {
  context?: string;
  throwOnError?: boolean;
  timeoutMs?: number;
}

const PDF_EXPORT_STYLES = `
  .pdf-export-root {
    position: fixed;
    top: 0;
    left: -10000px;
    width: ${PAGE_WIDTH_PX}px;
    pointer-events: none;
    z-index: -1;
    background: #ffffff;
  }

  .pdf-export-document {
    width: ${PAGE_WIDTH_PX}px;
    box-sizing: border-box;
    padding: ${EXPORT_SURFACE_PADDING_PX}px;
    background: #ffffff;
    color: #0f172a;
    font-family: "Times New Roman", Georgia, serif;
    font-size: 15px;
    line-height: 1.65;
  }

  .pdf-export-document .print-container {
    width: 100%;
    box-sizing: border-box;
    margin: 0;
    overflow: visible;
  }

  .pdf-export-document #pdf-content {
    width: 100% !important;
    max-width: none !important;
    margin: 0 !important;
    padding: 0 !important;
    background: transparent !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    overflow: visible !important;
    max-height: none !important;
    color: #0f172a !important;
  }

  .pdf-export-document .pdf-header {
    margin-bottom: 20px;
    padding-bottom: 16px;
    text-align: center;
    border-bottom: 1px solid #d7dee8;
  }

  .pdf-export-document .pdf-header__inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .pdf-export-document .pdf-header__logo {
    display: block;
    width: auto;
    max-width: 160px;
    max-height: 60px;
    object-fit: contain;
  }

  .pdf-export-document .pdf-header__school {
    font-family: "Times New Roman", Georgia, serif;
    font-size: 22px;
    font-weight: 700;
    line-height: 1.15;
    color: #0f172a;
  }

  .pdf-export-document .pdf-header__meta,
  .pdf-export-document .pdf-header__chapter,
  .pdf-export-document .pdf-header__periods {
    font-size: 12.5px;
    font-weight: 600;
    line-height: 1.3;
    color: #475569;
  }

  .pdf-export-document sup,
  .pdf-export-document sub {
    font-size: 0.75em;
    line-height: 0;
    position: relative;
    vertical-align: baseline;
  }

  .pdf-export-document sup {
    top: -0.45em;
  }

  .pdf-export-document sub {
    bottom: -0.2em;
  }

  .pdf-export-document .katex-display,
  .pdf-export-document .pdf-formula-block,
  .pdf-export-document .pdf-table-wrapper,
  .pdf-export-document table,
  .pdf-export-document thead,
  .pdf-export-document tbody,
  .pdf-export-document tr,
  .pdf-export-document td,
  .pdf-export-document th,
  .pdf-export-document pre,
  .pdf-export-document blockquote {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .pdf-export-document .katex-display {
    margin: 12px 0;
    overflow-x: auto;
    overflow-y: hidden;
  }

  .pdf-export-document h1,
  .pdf-export-document h2,
  .pdf-export-document h3 {
    color: #1e3a8a;
    font-weight: 700;
    break-after: avoid;
    page-break-after: avoid;
  }

  .pdf-export-document h1 {
    margin: 0 0 14px;
    font-size: 26px;
    line-height: 1.2;
    color: #0f172a;
  }

  .pdf-export-document h2 {
    margin: 24px 0 10px;
    font-size: 21px;
    line-height: 1.25;
    padding-bottom: 6px;
    border-bottom: 1px solid #dbe5f1;
  }

  .pdf-export-document h3 {
    margin: 18px 0 8px;
    font-size: 17px;
    line-height: 1.3;
  }

  .pdf-export-document p {
    margin: 0 0 12px;
  }

  .pdf-export-document ul,
  .pdf-export-document ol {
    margin: 0 0 14px;
    padding-left: 24px;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .pdf-export-document li {
    margin: 0 0 6px;
    line-height: 1.65;
  }

  .pdf-export-document strong {
    font-weight: 700;
  }

  .pdf-export-document .pdf-table-wrapper {
    width: 100%;
    margin: 16px 0 18px;
    overflow: visible !important;
    border: 1px solid #cbd5e1;
    border-radius: 12px;
    background: #ffffff;
  }

  .pdf-export-document table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }

  .pdf-export-document thead {
    display: table-header-group;
  }

  .pdf-export-document tfoot {
    display: table-footer-group;
  }

  .pdf-export-document th,
  .pdf-export-document td {
    border: 1px solid #cbd5e1;
    padding: 10px 12px;
    text-align: left;
    vertical-align: top;
    word-break: break-word;
    overflow-wrap: anywhere;
    box-sizing: border-box;
  }

  .pdf-export-document thead {
    background: #f8fafc;
  }

  .pdf-export-document th {
    font-weight: 700;
    color: #0f172a;
  }

  .pdf-export-document pre,
  .pdf-export-document .pdf-formula-block {
    margin: 10px 0;
    padding: 10px 12px;
    border: 1px solid #dbe5f1;
    background: #f8fafc;
    white-space: pre-wrap;
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
    pointer-events: auto;
    z-index: 9999;
    background: #ffffff;
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
      width: auto;
      margin: 0;
      padding: 0;
    }

    body.pdf-print-mode > .pdf-export-root > style {
      display: none;
    }

    body.pdf-print-mode .pdf-export-document {
      width: auto;
      padding: 0;
      overflow: visible;
    }

    body.pdf-print-mode .print-container {
      margin: ${PRINT_MARGIN_TOP_MM}mm ${PRINT_MARGIN_RIGHT_MM}mm ${PRINT_MARGIN_BOTTOM_MM}mm ${PRINT_MARGIN_LEFT_MM}mm;
      overflow: visible;
      page-break-inside: auto;
    }

    body.pdf-print-mode .print-container .pdf-header,
    body.pdf-print-mode .print-container .header {
      margin-top: ${PRINT_HEADER_TOP_MM}mm;
    }

    body.pdf-print-mode .print-container table,
    body.pdf-print-mode .print-container .pdf-table-wrapper,
    body.pdf-print-mode .print-container thead,
    body.pdf-print-mode .print-container tbody,
    body.pdf-print-mode .print-container tr,
    body.pdf-print-mode .print-container td,
    body.pdf-print-mode .print-container th {
      break-inside: avoid;
      page-break-inside: avoid;
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

function updateHeaderLogos(node: HTMLElement, logoDataUrl?: string | null) {
  if (!logoDataUrl) {
    return;
  }

  const logos = [
    ...(node.matches(".pdf-header__logo") ? [node] : []),
    ...Array.from(node.querySelectorAll(".pdf-header__logo")),
  ].filter((logo): logo is HTMLImageElement => logo instanceof HTMLImageElement);

  logos.forEach((logo) => {
    logo.src = logoDataUrl;
  });
}

function describeImage(image: HTMLImageElement) {
  return image.alt?.trim() || image.currentSrc || image.src || "an image";
}

export async function waitForDocumentFonts() {
  if ("fonts" in document) {
    await document.fonts.ready;
  }
}

export async function waitForImages(
  container: ParentNode,
  options: WaitForImagesOptions = {},
) {
  const {
    context = "export content",
    throwOnError = false,
    timeoutMs = 10000,
  } = options;
  const images = Array.from(container.querySelectorAll("img"));

  await Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve, reject) => {
          const fail = (message: string) => {
            const error = new Error(message);
            if (throwOnError) {
              reject(error);
              return;
            }

            console.error("Export failed:", error);
            resolve();
          };

          if (image.complete) {
            if (image.naturalWidth > 0) {
              resolve();
              return;
            }

            fail(`Image not loaded in ${context}: ${describeImage(image)}`);
            return;
          }

          const cleanup = () => {
            window.clearTimeout(timeoutId);
            image.removeEventListener("load", handleLoad);
            image.removeEventListener("error", handleError);
          };

          const handleLoad = () => {
            cleanup();
            if (image.naturalWidth > 0) {
              resolve();
              return;
            }

            fail(`Image not loaded in ${context}: ${describeImage(image)}`);
          };

          const handleError = () => {
            cleanup();
            fail(`Image not loaded in ${context}: ${describeImage(image)}`);
          };

          const timeoutId = window.setTimeout(() => {
            cleanup();
            fail(`Image load timed out in ${context}: ${describeImage(image)}`);
          }, timeoutMs);

          image.addEventListener("load", handleLoad, { once: true });
          image.addEventListener("error", handleError, { once: true });
        }),
    ),
  );
}

export async function buildPdfExportDocument({
  source,
  logoDataUrl,
}: {
  source: HTMLElement;
  logoDataUrl?: string | null;
}) {
  const root = createRenderRoot();
  const documentElement = document.createElement("div");
  documentElement.className = "pdf-export-document";
  const printContainer = document.createElement("div");
  printContainer.className = "print-container";

  const clone = source.cloneNode(true) as HTMLElement;
  normalizeExportNode(clone);
  updateHeaderLogos(clone, logoDataUrl);
  printContainer.appendChild(clone);
  documentElement.appendChild(printContainer);
  root.appendChild(documentElement);

  await waitForDocumentFonts();
  await waitForImages(documentElement, {
    context: "the export document",
    throwOnError: true,
  });
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.setTimeout(resolve, 120);
    });
  });

  return {
    root,
    documentElement,
    cleanup() {
      root.remove();
    },
  };
}

export const pdfExportPageSize = {
  width: PAGE_WIDTH_PX,
  height: PAGE_HEIGHT_PX,
  marginMm: PDF_MARGIN_MM,
  innerWidthMm: A4_WIDTH_MM - PDF_MARGIN_MM * 2,
  innerHeightMm: A4_HEIGHT_MM - PDF_MARGIN_MM * 2,
};
