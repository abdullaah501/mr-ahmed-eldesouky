"use client";

import Image from "next/image";
import { getImageSrc } from "@/app/components/ImagePreview";

export default function MultipleChoicePreview({ question }) {
  const imgSrc = question?.image?.cloudId || question?.image?.url
    ? getImageSrc(question.image)
    : null;
  return (
    <div className="text-sm text-gray-600 space-y-2">
      {imgSrc && (
        <Image
          src={imgSrc}
          alt="صورة السؤال"
          width={120}
          height={120}
          quality={60}
          className="w-24 h-24 object-cover rounded-lg mb-2"
        />
      )}
      <p className="font-medium text-gray-800">{question.questionText || "—"}</p>
      <div className="flex flex-wrap gap-1">
        {(question.options || []).map((opt, i) => (
          <span
            key={i}
            className={`px-2 py-0.5 text-xs rounded-full ${
              opt.valueText === question.correctAnswer
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {opt.optionText || `اختيار ${String.fromCharCode(65 + i)}`}
          </span>
        ))}
      </div>
    </div>
  );
}
