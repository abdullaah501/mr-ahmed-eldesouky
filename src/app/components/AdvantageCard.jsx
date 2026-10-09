import Image from "next/image";

export default function AdvantageCard({ item }) {
  return (
    <div className="w-full">
      <div className="flex h-full flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-(--brand-navy-border)">
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-navy-soft text-brand-navy border border-(--brand-navy-border)">
          <Image
            src={item?.icon}
            alt=""
            width={28}
            height={28}
            className="h-7 w-7 object-contain"
          />
        </span>
        <p className="mt-2 text-base font-extrabold text-text-primary">
          {item?.title}
        </p>
        <p className="text-sm leading-relaxed text-text-muted">
          {item?.description}
        </p>
      </div>
    </div>
  );
}
