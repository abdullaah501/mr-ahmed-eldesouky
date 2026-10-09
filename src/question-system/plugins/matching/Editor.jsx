"use client";

import { useRef, useState } from "react";
import MathToolbar from "@/app/components/math/MathToolbar";
import MathRenderer from "@/app/components/math/MathRenderer";

export default function MatchingEditor({ value, onChange }) {
  const pairs = value.config?.pairs || [];
  const [activePair, setActivePair] = useState(null);
  const [activeField, setActiveField] = useState("leftItem");
  const inputRefs = useRef({});

  function updatePair(id, field, text) {
    const next = pairs.map((p) =>
      p.id === id ? { ...p, [field]: text } : p
    );
    onChange({ ...value, config: { ...value.config, pairs: next } });
  }

  function addPair() {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const next = [...pairs, { id, leftItem: "", rightItem: "" }];
    onChange({ ...value, config: { ...value.config, pairs: next } });
  }

  function removePair(id) {
    const next = pairs.filter((p) => p.id !== id);
    onChange({ ...value, config: { ...value.config, pairs: next } });
  }

  function handleToolbarInsert(insertText) {
    if (!activePair) return;
    const pair = pairs.find((p) => p.id === activePair);
    if (!pair) return;
    const field = activeField;
    const current = pair[field] || "";
    const input = inputRefs.current[`${activePair}-${field}`];
    const start = input?.selectionStart ?? current.length;
    const end = input?.selectionEnd ?? current.length;
    let toInsert = insertText;
    if (insertText === "\\frac{}{}") toInsert = "$\\frac{}{}$";
    else if (insertText === "\\sqrt{}") toInsert = "$\\sqrt{}$";
    else if (insertText === "\\sqrt[3]{}") toInsert = "$\\sqrt[3]{}$";
    else if (insertText.startsWith("\\") || insertText.startsWith("^{")) toInsert = `$${insertText}$`;
    const newVal = current.slice(0, start) + toInsert + current.slice(end);
    updatePair(activePair, field, newVal);
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
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-gray-700">
        الأزواج <span className="text-xs font-normal text-gray-500">(تدعم المعادلات)</span>
      </label>
      <MathToolbar onInsert={handleToolbarInsert} />
      <div className="space-y-2">
        {pairs.map((p) => (
          <div key={p.id} className="flex items-center gap-2">
            <div className="flex-1">
              <input
                ref={(el) => (inputRefs.current[`${p.id}-leftItem`] = el)}
                type="text"
                placeholder="العنصر — مثال: $\sqrt{4}$"
                value={p.leftItem || ""}
                onChange={(e) => updatePair(p.id, "leftItem", e.target.value)}
                onFocus={() => { setActivePair(p.id); setActiveField("leftItem"); }}
                className="w-full p-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-400 text-sm"
              />
              {p.leftItem && (
                <div className="mt-1 px-2 py-1 bg-gray-50 rounded text-xs border border-gray-100">
                  <MathRenderer text={p.leftItem} />
                </div>
              )}
            </div>
            <span className="text-gray-400">←</span>
            <div className="flex-1">
              <input
                ref={(el) => (inputRefs.current[`${p.id}-rightItem`] = el)}
                type="text"
                placeholder="المقابل — مثال: $2$"
                value={p.rightItem || ""}
                onChange={(e) => updatePair(p.id, "rightItem", e.target.value)}
                onFocus={() => { setActivePair(p.id); setActiveField("rightItem"); }}
                className="w-full p-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-400 text-sm"
              />
              {p.rightItem && (
                <div className="mt-1 px-2 py-1 bg-gray-50 rounded text-xs border border-gray-100">
                  <MathRenderer text={p.rightItem} />
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => removePair(p.id)}
              className="text-red-400 hover:text-red-600 p-1"
              title="حذف"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addPair}
        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
      >
        + إضافة زوج
      </button>
    </div>
  );
}
