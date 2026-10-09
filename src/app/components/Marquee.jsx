const ITEMS = [
  "الكيمياء",
  "تفاعلات",
  "معادلات",
  "اختبارات",
  "مراجعات",
  "تدريبات",
  "مولات",
  "اتزان",
];

export default function Marquee({ inverted = false }) {
  const row = [...ITEMS, ...ITEMS];
  return (
    <div
      aria-hidden
      className={`relative overflow-hidden border-y py-3 ${
        inverted
          ? "border-[#073B40] bg-[#FFB81C] text-[#3D2C00]"
          : "border-white/10 bg-[#0B5155] text-white/85"
      }`}
    >
      <div className="marquee-track flex w-max items-center gap-8 whitespace-nowrap">
        {[0, 1].map((half) => (
          <div key={half} className="flex items-center gap-8">
            {row.map((item, i) => (
              <span
                key={`${half}-${i}`}
                className="flex items-center gap-8 text-sm font-extrabold"
              >
                {item}
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    inverted ? "bg-[#3D2C00]/60" : "bg-[#FFB81C]"
                  }`}
                />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
