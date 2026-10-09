"use client";

import Image from "next/image";
import { getImageSrc } from "@/app/components/ImagePreview";

export default function ImageChoicePreview({ question }) {
  return (
    <div className="text-sm text-gray-600 space-y-2">
      <p className="font-medium text-gray-800">{question.questionText || "—"}</p>
      <div className="flex flex-wrap gap-2">
        {(question.options || []).map((opt) => (
          <div
            key={opt.valueText}
            className={`border-2 rounded-lg overflow-hidden w-20 ${
              opt.valueText === question.correctAnswer
                ? "border-green-400"
                : "border-gray-200"
            }`}
          >
            {opt.image?.cloudId || opt.image?.url ? (
              <Image
                src={getImageSrc(opt.image)}
                alt={opt.optionText || "اختيار"}
                width={80}
                height={80}
                quality={50}
                className="w-full h-20 object-cover"
              />
            ) : (
              <div className="w-full h-20 bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
                لا توجد صورة
              </div>
            )}
            {opt.optionText && (
              <p className="text-center text-xs p-1 truncate">
                {opt.optionText}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
