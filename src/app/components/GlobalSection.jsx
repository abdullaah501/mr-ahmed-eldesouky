import SectionHeader from "./ui/SectionHeader";

export default function GlobalSection({ title, subtitle, highLightedWord, eyebrow, align = "center", children, className = "" }) {
  const fullTitle = highLightedWord ? `${title} ${highLightedWord}` : title;
  return (
    <section className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16 ${className}`}>
      {(title || subtitle) && (
        <SectionHeader eyebrow={eyebrow} title={fullTitle} description={subtitle} align={align} />
      )}
      <div className={title || subtitle ? "mt-10" : ""}>{children}</div>
    </section>
  );
}
