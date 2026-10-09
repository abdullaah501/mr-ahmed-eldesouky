"use client";

import { useRef, useState } from "react";
import MathToolbar from "@/app/components/math/MathToolbar";
import MathRenderer from "@/app/components/math/MathRenderer";

export default function MultipleChoiceEditor({ value, onChange, errors }) {
  const options = value.options || [];
  const letters = ["a", "b", "c", "d"];
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRefs = useRef([]);

  function updateOption(index, text) {
    const opts = [...options];
    if (!opts[index]) {
      opts[index] = { optionText: "", valueText: letters[index] };
    }
    opts[index] = { ...opts[index], optionText: text };
    onChange({ ...value, options: opts });
  }

  function handleToolbarInsert(insertText) {
    const idx = activeIndex;
    const current = options[idx]?.optionText || "";
    const input = inputRefs.current[idx];
    const start = input?.selectionStart ?? current.length;
    const end = input?.selectionEnd ?? current.length;
    let toInsert = insertText;
    if (insertText === "\\frac{}{}") toInsert = "$\\frac{}{}$";
    else if (insertText === "\\sqrt{}") toInsert = "$\\sqrt{}$";
    else if (insertText === "\\sqrt[3]{}") toInsert = "$\\sqrt[3]{}$";
    else if (insertText.startsWith("\\") || insertText.startsWith("^{")) toInsert = `$${insertText}$`;
    const newVal = current.slice(0, start) + toInsert + current.slice(end);
    updateOption(idx, newVal);
    setTimeout(() => {
      if (input) {
        input.focus();
        let pos = start + toInsert.length;
        if (insertText === "$\\frac{}{}$") pos = start + "$\\frac{".length;
        else if (insertText === "$\\sqrt{}$" || insertText === "$\\sqrt[3]{}$") pos = start + toInsert.indexOf("{") + 1;
        input.setSelectionRange(pos, pos);
      }
    }, 0);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-semibold text-gray-700">
          الاختيارات <span className="text-xs font-normal text-gray-500">(يدعم المعادلات)</span>
        </label>
        <span className="text-xs text-gray-500">اضغط على خانة، ثم استخدم الشريط</span>
      </div>
      <MathToolbar onInsert={handleToolbarInsert} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {letters.map((label, i) => (
          <div key={label} className="relative">
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 bg-gray-200 text-gray-600 text-xs px-2 py-1 rounded">
              {label.toUpperCase()}
            </span>
            <input
              ref={(el) => (inputRefs.current[i] = el)}
              type="text"
              placeholder={`اختيار ${label.toUpperCase()} — مثال: $\\frac{1}{2}$`}
              value={options[i]?.optionText || ""}
              onChange={(e) => updateOption(i, e.target.value)}
              onFocus={() => setActiveIndex(i)}
              className="w-full p-3 pl-12 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            />
            {options[i]?.optionText && (
              <div className="mt-1 px-3 py-1 bg-gray-50 rounded text-xs border border-gray-100">
                <MathRenderer text={options[i].optionText} />
              </div>
            )}
          </div>
        ))}
      </div>
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
          {letters.map((val) => (
            <option key={val} value={val}>
              {val.toUpperCase()}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
