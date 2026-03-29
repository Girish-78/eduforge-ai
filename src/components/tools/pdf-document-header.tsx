interface PdfDocumentHeaderProps {
  schoolName?: string;
  documentTitle: string;
  dateLabel?: string;
  logoLabel?: string;
}

function getLogoLabel(schoolName: string, logoLabel?: string) {
  if (logoLabel?.trim()) {
    return logoLabel.trim().slice(0, 3).toUpperCase();
  }

  const initials = schoolName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

  return initials || "SC";
}

export function PdfDocumentHeader({
  schoolName = "Your School",
  documentTitle,
  dateLabel,
  logoLabel,
}: PdfDocumentHeaderProps) {
  const resolvedSchoolName = schoolName.trim() || "Your School";
  const resolvedLogoLabel = getLogoLabel(resolvedSchoolName, logoLabel);

  return (
    <header
      data-pdf-header
      className="pdf-document-header flex items-start gap-4 border-b border-slate-200 pb-4"
    >
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-lg font-bold tracking-[0.18em] text-white">
        {resolvedLogoLabel}
      </div>
      <div className="min-w-0 flex-1 text-center">
        <p className="text-lg font-semibold text-slate-900">{resolvedSchoolName}</p>
        <p className="mt-2 text-xl font-bold text-slate-900">{documentTitle}</p>
      </div>
      <div className="w-24 shrink-0 text-right text-sm text-slate-500">
        {dateLabel ? <p>{dateLabel}</p> : <span>&nbsp;</span>}
      </div>
    </header>
  );
}
