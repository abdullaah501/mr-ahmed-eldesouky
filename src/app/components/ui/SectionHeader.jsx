export default function SectionHeader({
  eyebrow,
  title,
  description,
  align = "center",
  actions,
  className = "",
}) {
  const alignCls =
    align === "center"
      ? "text-center mx-auto"
      : align === "right"
        ? "text-right"
        : "text-right";
  return (
    <div className={`${alignCls} max-w-3xl ${className}`}>
      {eyebrow ? (
        <p
          className="text-xs font-extrabold tracking-[0.2em] text-brand-teal mb-3"
          style={{ fontFamily: "var(--font-poppins), system-ui" }}
        >
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-text-primary leading-tight">
        {title}
      </h2>
      {description ? (
        <p className="mt-3 text-sm sm:text-base text-text-muted leading-relaxed">
          {description}
        </p>
      ) : null}
      {actions ? (
        <div
          className={`mt-6 flex gap-3 ${align === "center" ? "justify-center" : align === "right" ? "justify-start" : "justify-start"}`}
        >
          {actions}
        </div>
      ) : null}
    </div>
  );
}
