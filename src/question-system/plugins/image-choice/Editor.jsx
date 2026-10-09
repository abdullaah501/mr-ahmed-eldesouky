"use client";

import Image from "next/image";
import { FaImage } from "react-icons/fa6";
import { upload } from "../../../../lib/upload";
import { getImageSrc } from "@/app/components/ImagePreview";

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function ImageChoiceEditor({ value, onChange }) {
  const options = value.options || [];

  function addOption() {
    onChange({
      ...value,
      options: [...options, { optionText: "", valueText: uid(), image: null }],
    });
  }

  function removeOption(index) {
    const next = options.filter((_, i) => i !== index);
    const correct = value.correctAnswer;
    const removedVal = options[index]?.valueText;
    onChange({
      ...value,
      options: next,
      correctAnswer: removedVal === correct ? "" : correct,
    });
  }

  function updateOption(index, field, val) {
    const next = options.map((o, i) => (i === index ? { ...o, [field]: val } : o));
    onChange({ ...value, options: next });
  }

  function handleUpload(index, ev) {
    upload(ev, ({ url, cloudId }) => {
      const next = options.map((o, i) =>
        i === index ? { ...o, image: { url, cloudId } } : o
      );
      onChange({ ...value, options: next });
    });
  }

  return (
    <div className="space-y-4">
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        Options (images)
      </label>
      <div className="grid grid-cols-2 gap-3">
        {options.map((opt, i) => (
          <div
            key={opt.valueText || i}
            className="border border-gray-200 rounded-lg p-3 space-y-2 relative"
          >
            <button
              type="button"
              onClick={() => removeOption(i)}
              className="absolute top-1 right-1 text-red-400 hover:text-red-600 text-xs"
              title="Delete"
            >
              ✕
            </button>

            <label
              htmlFor={`img-opt-${i}`}
              className="flex flex-col items-center justify-center h-20 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-amber-500 hover:bg-amber-50 transition"
            >
              {opt.image?.cloudId || opt.image?.url ? (
                <Image
                  src={getImageSrc(opt.image)}
                  alt={`اختيار ${i + 1}`}
                  width={64}
                  height={64}
                  quality={50}
                  className="w-16 h-16 object-cover rounded"
                />
              ) : (
                <div className="flex flex-col items-center text-gray-400 text-xs">
                  <FaImage className="text-lg mb-1" />
                  <span>ارفع صورة</span>
                </div>
              )}
              <input
                id={`img-opt-${i}`}
                type="file"
                accept="image/*"
                onChange={(ev) => handleUpload(i, ev)}
                className="hidden"
              />
            </label>

            <input
              type="text"
              placeholder="تسمية (اختياري)"
              value={opt.optionText || ""}
              onChange={(e) => updateOption(i, "optionText", e.target.value)}
              className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400"
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addOption}
        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
      >
        + إضافة اختيار
      </button>

      {options.length > 0 && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            الإجابة الصحيحة
          </label>
          <select
            value={value.correctAnswer || ""}
            onChange={(e) => onChange({ ...value, correctAnswer: e.target.value })}
            className="w-full p-3 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 transition"
          >
            <option value="">اختار الإجابة الصحيحة</option>
            {options.map((opt, i) => (
              <option key={opt.valueText} value={opt.valueText}>
                اختيار {i + 1}
                {opt.optionText ? ` (${opt.optionText})` : ""}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
