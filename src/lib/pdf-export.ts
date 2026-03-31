const MM_TO_PX = 96 / 25.4;
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const PDF_MARGIN_MM = 10;
const PAGE_WIDTH_PX = Math.round(A4_WIDTH_MM * MM_TO_PX);
const PAGE_HEIGHT_PX = Math.round(A4_HEIGHT_MM * MM_TO_PX);
const PAGE_MARGIN_PX = Math.round(PDF_MARGIN_MM * MM_TO_PX);

export const PDF_EXPORT_SCALE = 2;

export const pdfExportConfig = {
  margin: PDF_MARGIN_MM,
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
    padding: ${PAGE_MARGIN_PX}px;
    background: #ffffff;
    color: #0f172a;
    font-family: Arial, sans-serif;
    font-size: 14px;
    line-height: 1.55;
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
    margin-bottom: 16px;
    padding-bottom: 14px;
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

  .pdf-export-document h1,
  .pdf-export-document h2,
  .pdf-export-document h3 {
    color: #1e3a8a;
    font-weight: 700;
    break-after: avoid;
    page-break-after: avoid;
  }

  .pdf-export-document h1 {
    margin: 0 0 10px;
    font-size: 22px;
    line-height: 1.25;
  }

  .pdf-export-document h2 {
    margin: 18px 0 8px;
    font-size: 18px;
    line-height: 1.3;
    padding-bottom: 4px;
    border-bottom: 1px solid #dbe5f1;
  }

  .pdf-export-document h3 {
    margin: 14px 0 6px;
    font-size: 15px;
    line-height: 1.3;
  }

  .pdf-export-document p {
    margin: 0 0 8px;
  }

  .pdf-export-document ul,
  .pdf-export-document ol {
    margin: 0 0 10px;
    padding-left: 20px;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .pdf-export-document li {
    margin: 0 0 5px;
    line-height: 1.55;
  }

  .pdf-export-document strong {
    font-weight: 700;
  }

  .pdf-export-document pre,
  .pdf-export-document blockquote,
  .pdf-export-document .pdf-formula-block,
  .pdf-export-document .pdf-table-wrapper,
  .pdf-export-document table,
  .pdf-export-document thead,
  .pdf-export-document tbody,
  .pdf-export-document tr,
  .pdf-export-document td,
  .pdf-export-document th {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .pdf-export-document .pdf-table-wrapper {
    width: 100%;
    margin: 10px 0 12px;
    overflow: visible !important;
    border: 1px solid #cbd5e1;
    background: #ffffff;
  }

  .pdf-export-document table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }

  .pdf-export-document th,
  .pdf-export-document td {
    border: 1px solid #cbd5e1;
    padding: 7px 8px;
    text-align: left;
    vertical-align: top;
    word-break: break-word;
  }

  .pdf-export-document thead {
    background: #eff6ff;
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
      margin: ${PDF_MARGIN_MM}mm;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
    }

    body.pdf-print-mode > .pdf-export-root {
      width: auto;
    }

    body.pdf-print-mode > .pdf-export-root > style {
      display: none;
    }

    body.pdf-print-mode .pdf-export-document {
      width: auto;
      padding: 0;
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

  const clone = source.cloneNode(true) as HTMLElement;
  normalizeExportNode(clone);
  updateHeaderLogos(clone, logoDataUrl);
  documentElement.appendChild(clone);
  root.appendChild(documentElement);

  await waitForImages(documentElement);
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
