"use client";

export default function SourceCard({
  icon,
  title,
  description,
  selected,
  disabled,
  disabledReason,
  onClick,
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`relative rounded-xl border p-4 text-right transition ${selected ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100" : "border-gray-200 bg-white hover:border-blue-300"} ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <span className="text-2xl">{icon}</span>
      <span className="mt-2 block text-sm font-bold text-gray-800">
        {title}
      </span>
      <span className="mt-1 block text-xs text-gray-500">
        {disabled ? disabledReason : description}
      </span>
    </button>
  );
}
