export default function EgyptGovernoratesSelect({ value, onChange, error }) {
  const governorates = [
    "القاهرة",
    "الجيزة",
    "الإسكندرية",
    "الدقهلية",
    "البحر الأحمر",
    "البحيرة",
    "الفيوم",
    "الغربية",
    "الإسماعيلية",
    "المنوفية",
    "المنيا",
    "القليوبية",
    "الوادي الجديد",
    "السويس",
    "أسوان",
    "أسيوط",
    "بني سويف",
    "بورسعيد",
    "دمياط",
    "جنوب سيناء",
    "كفر الشيخ",
    "مطروح",
    "الأقصر",
    "قنا",
    "شمال سيناء",
    "سوهاج",
    "دولة أخرى",
  ];

  return (
    <div className="w-full text-right md:col-span-2">
      <label className="mb-1.5 block text-xs font-extrabold text-text-primary">
        المحافظة
      </label>
      <select
        value={value}
        onChange={onChange}
        className={`block w-full rounded-xl border bg-card px-4 py-3.5 text-sm font-medium text-[var(--text-primary)] outline-none transition-colors ${error ? "border-red-300 bg-red-50/50" : "border-border focus:border-border"}`}
      >
        <option value="">اختار المحافظة</option>
        {governorates.map((gov) => (
          <option key={gov} value={gov}>
            {gov}
          </option>
        ))}
      </select>
      {error && (
        <p className="text-red-500 text-xs mt-1">هذا الحقل مطلوب</p>
      )}
    </div>
  );
}
