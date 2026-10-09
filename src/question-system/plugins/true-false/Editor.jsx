"use client";

export default function TrueFalseEditor({ value, onChange }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        الإجابة الصحيحة
      </label>
      <select
        value={value.correctAnswer || ""}
        onChange={(e) => onChange({ ...value, correctAnswer: e.target.value })}
        className="w-full p-3 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
      >
        <option value="">اختار الإجابة الصحيحة</option>
        <option value="true">صح</option>
        <option value="false">خطأ</option>
      </select>
    </div>
  );
}
