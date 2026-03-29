interface PdfDocumentFooterProps {
  brandName?: string;
  pageLabel?: string;
}

export function PdfDocumentFooter({
  brandName = "Eduforge-AI",
  pageLabel = "Page 1",
}: PdfDocumentFooterProps) {
  return (
    <footer
      data-pdf-footer
      className="pdf-document-footer mt-8 flex items-center justify-between border-t border-slate-200 pt-3 text-xs text-slate-500"
    >
      <span className="font-semibold uppercase tracking-[0.16em] text-slate-600">
        {brandName}
      </span>
      <span className="pdf-footer__page" data-pdf-page-number>
        <span className="pdf-footer__page-screen" data-pdf-page-number-label>
          {pageLabel}
        </span>
      </span>
    </footer>
  );
}
