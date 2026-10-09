"use client";

import React from "react";

const SYMBOLS = [
  { label: "كسر", insert: "\\frac{}{}", display: "a⁄b", title: "كسر \\frac{a}{b}" },
  { label: "جذر تربيعي", insert: "\\sqrt{}", display: "√", title: "جذر تربيعي \\sqrt{x}" },
  { label: "جذر تكعيبي", insert: "\\sqrt[3]{}", display: "∛", title: "جذر تكعيبي \\sqrt[3]{x}" },
  { label: "أس ٢", insert: "^{2}", display: "x²", title: "أس ٢" },
  { label: "أس ٣", insert: "^{3}", display: "x³", title: "أس ٣" },
  { label: "ينتمي", insert: "\\in", display: "∈", title: "ينتمي \\in" },
  { label: "لا ينتمي", insert: "\\notin", display: "∉", title: "لا ينتمي \\notin" },
  { label: "جزء من", insert: "\\subset", display: "⊂", title: "جزء من \\subset" },
  { label: "ليس جزءًا", insert: "\\not\\subset", display: "⊄", title: "ليس جزءًا \\not\\subset" },
  { label: "فترة مفتوحة", insert: "$(a,b)$", display: "(a,b)", title: "فترة مفتوحة (a,b)" },
  { label: "فاي", insert: "\\phi", display: "φ", title: "فاي \\phi" },
  { label: "مجموعة خالية", insert: "\\emptyset", display: "∅", title: "مجموعة خالية \\emptyset" },
  { label: "جا", insert: "\\sin", display: "sin", title: "جا \\sin" },
  { label: "جتا", insert: "\\cos", display: "cos", title: "جتا \\cos" },
  { label: "ظا", insert: "\\tan", display: "tan", title: "ظا \\tan" },
  { label: "ظتا", insert: "\\cot", display: "cot", title: "ظتا \\cot" },
  { label: "قا", insert: "\\sec", display: "sec", title: "قا \\sec" },
  { label: "قتا", insert: "\\csc", display: "csc", title: "قتا \\csc" },
  { label: "جا⁻¹", insert: "\\arcsin", display: "arcsin", title: "جا العكسية \\arcsin" },
  { label: "جتا⁻¹", insert: "\\arccos", display: "arccos", title: "جتا العكسية \\arccos" },
  { label: "ظا⁻¹", insert: "\\arctan", display: "arctan", title: "ظا العكسية \\arctan" },
  { label: "باي", insert: "\\pi", display: "π", title: "باي" },
  { label: "ثيتا", insert: "\\theta", display: "θ", title: "ثيتا" },
  { label: "ألفا", insert: "\\alpha", display: "α", title: "ألفا" },
  { label: "بيتا", insert: "\\beta", display: "β", title: "بيتا" },
  { label: "زائد أو ناقص", insert: "\\pm", display: "±", title: "زائد أو ناقص" },
  { label: "في", insert: "\\times", display: "×", title: "في" },
  { label: "على", insert: "\\div", display: "÷", title: "على" },
  { label: "لا يساوي", insert: "\\neq", display: "≠", title: "لا يساوي" },
  { label: "أصغر أو يساوي", insert: "\\le", display: "≤", title: "أصغر أو يساوي" },
  { label: "أكبر أو يساوي", insert: "\\ge", display: "≥", title: "أكبر أو يساوي" },
  { label: "تقريبًا", insert: "\\approx", display: "≈", title: "تقريبًا" },
  { label: "ما لا نهاية", insert: "\\infty", display: "∞", title: "ما لا نهاية" },
  { label: "مجموع", insert: "\\sum", display: "∑", title: "مجموع" },
  { label: "تكامل", insert: "\\int", display: "∫", title: "تكامل" },
];

function insertAtCursor(inputRef, textToInsert, wrapWithDollars = true) {
  const input = inputRef?.current;
  if (!input) return textToInsert;

  const start = input.selectionStart || 0;
  const end = input.selectionEnd || 0;
  const currentValue = input.value;
  const before = currentValue.substring(0, start);
  const after = currentValue.substring(end);
  
  // Wrap with $ for inline math if not already containing $
  let insertText = textToInsert;
  if (wrapWithDollars && !textToInsert.includes("$")) {
    // For symbols that are already math commands, wrap with $ $
    if (textToInsert.startsWith("\\") || textToInsert.startsWith("^{")) {
      insertText = `$${textToInsert}$`;
      // Special handling for fraction and roots to place cursor inside first {}
      if (textToInsert === "\\frac{}{}") {
        insertText = "$\\frac{}{}$";
      } else if (textToInsert === "\\sqrt{}") {
        insertText = "$\\sqrt{}$";
      } else if (textToInsert === "\\sqrt[3]{}") {
        insertText = "$\\sqrt[3]{}$";
      }
    }
  }

  const newValue = before + insertText + after;
  
  // Trigger change event
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(input),
    "value"
  )?.set;
  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(input, newValue);
    const event = new Event("input", { bubbles: true });
    input.dispatchEvent(event);
  } else {
    input.value = newValue;
  }

  // Set cursor position
  setTimeout(() => {
    let cursorPos = start + insertText.length;
    // For fraction, place cursor inside first {}
    if (textToInsert === "\\frac{}{}") {
      cursorPos = start + "$\\frac{".length;
    } else if (textToInsert === "\\sqrt{}" || textToInsert === "\\sqrt[3]{}") {
      cursorPos = start + insertText.indexOf("{") + 1;
    }
    input.focus();
    input.setSelectionRange(cursorPos, cursorPos);
  }, 0);

  return newValue;
}

export default function MathToolbar({ inputRef, onInsert, targetValue, onChange }) {
  const handleInsert = (symbol) => {
    if (inputRef?.current) {
      // Direct DOM manipulation for input/textarea
      const input = inputRef.current;
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      const before = targetValue ? targetValue.substring(0, start) : input.value.substring(0, start);
      const after = targetValue ? targetValue.substring(start) : input.value.substring(end);
      // Use onChange if provided (controlled component)
      if (onChange && targetValue !== undefined) {
        let insertText = symbol.insert;
        if (!insertText.includes("$") && (insertText.startsWith("\\") || insertText.startsWith("^{"))) {
          if (insertText === "\\frac{}{}") insertText = "$\\frac{}{}$";
          else if (insertText === "\\sqrt{}") insertText = "$\\sqrt{}$";
          else if (insertText === "\\sqrt[3]{}") insertText = "$\\sqrt[3]{}$";
          else insertText = `$${insertText}$`;
        }
        const newValue = before + insertText + after;
        onChange(newValue);
        setTimeout(() => {
          input.focus();
          let cursorPos = start + insertText.length;
          if (symbol.insert === "\\frac{}{}") cursorPos = start + "$\\frac{".length;
          else if (symbol.insert === "\\sqrt{}" || symbol.insert === "\\sqrt[3]{}") cursorPos = start + insertText.indexOf("{") + 1;
          input.setSelectionRange(cursorPos, cursorPos);
        }, 0);
      } else if (onInsert) {
        onInsert(symbol.insert);
      } else {
        insertAtCursor(inputRef, symbol.insert);
      }
    } else if (onInsert) {
      onInsert(symbol.insert);
    }
  };

  return (
    <div className="flex flex-wrap gap-1.5 p-2 bg-gray-50 border border-gray-200 rounded-lg">
      <span className="w-full text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1">
        <span>رموز المعادلات:</span>
        <span className="text-[10px] font-normal">اضغط للإدخال عند المؤشر</span>
      </span>
      {SYMBOLS.map((sym) => (
        <button
          key={sym.label}
          type="button"
          onClick={() => handleInsert(sym)}
          title={sym.title}
          className="px-2.5 py-1.5 bg-white border border-gray-300 rounded-md text-sm font-medium hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700 transition-colors min-w-[40px] flex items-center justify-center"
        >
          <span>{sym.display}</span>
        </button>
      ))}
      <div className="w-full mt-1 text-[10px] text-gray-400">
        تُدخل الرموز بصيغة LaTeX: مثال ‎$\frac&#123;a&#125;&#123;b&#125;$‎ يظهر ككسر، و‎$\sqrt&#123;x&#125;$‎ كجذر تربيعي
      </div>
    </div>
  );
}

export { insertAtCursor };
