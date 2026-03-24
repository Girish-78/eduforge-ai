export function LoadingDots({ label = "Loading" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-slate-600">
      <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-500 [animation-delay:-0.25s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-500 [animation-delay:-0.15s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-500" />
      {label}
    </span>
  );
}

