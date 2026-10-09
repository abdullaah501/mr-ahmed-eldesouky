export default function Spinner({ text = "Loading..." }) {
  return (
    <div className="py-16 text-center">
      <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-(--brand-navy-border) bg-brand-navy-soft">
        <svg
          className="h-7 w-7 animate-spin text-brand-navy"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>
      <p className="text-sm font-bold text-brand-navy">{text}</p>
      <p className="mt-1 text-xs text-text-muted">Please wait a moment</p>
    </div>
  );
}
