import Link from "next/link";

interface BrandLogoProps {
  compact?: boolean;
}

export function BrandLogo({ compact = false }: BrandLogoProps) {
  return (
    <Link href="/" className="inline-flex items-center gap-2">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-400 text-sm font-bold text-white shadow-sm">
        IF
      </span>
      {!compact ? (
        <span className="text-sm font-semibold tracking-tight text-slate-900">
          InsForge EduAI
        </span>
      ) : null}
    </Link>
  );
}

