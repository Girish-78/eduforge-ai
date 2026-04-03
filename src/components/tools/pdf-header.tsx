import type { GenerateType } from "@/lib/prompt-templates";

import { formatScientificContent } from "@/lib/scientific-format";

interface PDFHeaderProps {
  toolType: GenerateType;
  schoolName?: string;
  className?: string;
  subject?: string;
  chapter?: string;
  periods?: string;
  logoSrc?: string;
}

interface PDFHeaderConfig {
  chapterLabel: string;
  showPeriods?: boolean;
}

export const PDF_HEADER_CONFIG: Partial<Record<GenerateType, PDFHeaderConfig>> = {
  cheatsheet: {
    chapterLabel: "Chapter / Topic",
  },
  lesson_plan: {
    chapterLabel: "Chapter / Topic",
    showPeriods: true,
  },
};

function getPDFHeaderConfig(toolType: GenerateType): PDFHeaderConfig {
  return (
    PDF_HEADER_CONFIG[toolType] ?? {
      chapterLabel: "Chapter / Topic",
    }
  );
}

export function PDFHeader({
  toolType,
  schoolName,
  className,
  subject,
  chapter,
  periods,
  logoSrc,
}: PDFHeaderProps) {
  const config = getPDFHeaderConfig(toolType);
  const classSubject = [className?.trim(), subject?.trim()].filter(Boolean).join(" | ");
  const chapterText = chapter?.trim();
  const periodsText = periods?.trim();

  if (!logoSrc && !schoolName?.trim() && !classSubject && !chapterText && !periodsText) {
    return null;
  }

  return (
    <header className="pdf-header" data-pdf-header="true">
      <div className="pdf-header__inner">
        {logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoSrc} alt="School logo" className="pdf-header__logo" />
        ) : null}

        {schoolName?.trim() ? (
          <div className="pdf-header__school">{formatScientificContent(schoolName.trim())}</div>
        ) : null}

        {classSubject ? (
          <div className="pdf-header__meta">{formatScientificContent(classSubject)}</div>
        ) : null}

        {chapterText ? (
          <div className="pdf-header__chapter">
            {formatScientificContent(`${config.chapterLabel}: ${chapterText}`)}
          </div>
        ) : null}

        {config.showPeriods && periodsText ? (
          <div className="pdf-header__periods">
            {formatScientificContent(`Total Periods: ${periodsText}`)}
          </div>
        ) : null}
      </div>
    </header>
  );
}
