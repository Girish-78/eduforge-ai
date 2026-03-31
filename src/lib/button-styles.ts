export const buttonBaseClassName =
  "inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition focus:outline-none focus:ring-2";

export const primaryButtonClassName = `${buttonBaseClassName} bg-[#2563eb] text-white hover:bg-[#1d4ed8] focus:ring-[#2563eb]/30`;

export const secondaryButtonClassName = `${buttonBaseClassName} border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 focus:ring-slate-200`;

export const disabledButtonStateClassName =
  "disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 disabled:shadow-none";

export const disabledButtonClassName =
  "cursor-not-allowed bg-slate-300 text-slate-600 shadow-none hover:bg-slate-300 focus:ring-0";

export const successButtonStateClassName =
  "bg-[#16a34a] text-white hover:bg-[#15803d] focus:ring-[#16a34a]/30";

export const errorButtonStateClassName =
  "bg-[#dc2626] text-white hover:bg-[#b91c1c] focus:ring-[#dc2626]/30";
