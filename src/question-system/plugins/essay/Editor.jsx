"use client";

import { useRef, useState } from "react";
import MathToolbar from "@/app/components/math/MathToolbar";
import MathRenderer from "@/app/components/math/MathRenderer";

export default function EssayEditor({ value, onChange }) {
  const inputRef = useRef(null);
  const [showPreview, setShowPreview] = useState(false);
  function handleInsert(insertText) {
    const input = inputRef.current;
    if (!input) {
      onChange({ ...value, correctAnswer: (value.correctAnswer || "") + insertText });
      return;
    }
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const current = value.correctAnswer || "";
    let toInsert = insertText;
    if (insertText === "\\frac{}{}") toInsert = "$\\frac{}{}$";
    else if (insertText === "\\sqrt{}") toInsert = "$\\sqrt{}$";
    else if (insertText === "\\sqrt[3]{}") toInsert = "$\\sqrt[3]{}$";
    else if (insertText.startsWith("\\") || insertText.startsWith("^{")) toInsert = `$${insertText}$`;
    const newVal = current.slice(0, start) + toInsert + current.slice(end);
    onChange({ ...value, correctAnswer: newVal });
    setTimeout(() => {
      input.focus();
      let pos = start + toInsert.length;
      if (insertText === "$\\frac{}{}$") pos = start + "$\\frac{".length;
      else if (insertText === "$\\sqrt{}$" || insertText === "$\\sqrt[3]{}$") pos = start + toInsert.indexOf("{") + 1;
      input.setSelectionRange(pos, pos);
    }, 0);
  }
  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        الإجابة الصحيحة (اختياري) <span className="text-xs font-normal text-gray-500">(يدعم المعادلات)</span>
      </label>
      <MathToolbar onInsert={handleInsert} />
      <input
        ref={inputRef}
        type="text"
        placeholder="اكتب الإجابة النموذجية — مثال: $\sqrt{16}=4$"
        value={value.correctAnswer || ""}
        onChange={(e) => onChange({ ...value, correctAnswer: e.target.value })}
        className="w-full p-3 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
      />
      {value.correctAnswer && (
        <div className="p-2 bg-gray-50 border border-gray-200 rounded text-sm">
          <MathRenderer text={value.correctAnswer} />
        </div>
      )}
    </div>
  );
}
