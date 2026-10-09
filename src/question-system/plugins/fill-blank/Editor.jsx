"use client";

import { useMemo, useRef, useState } from "react";
import { FiArrowUp, FiArrowDown, FiTrash2 } from "react-icons/fi";
import { readCandidates } from "./core";
import MathToolbar from "@/app/components/math/MathToolbar";
import MathRenderer from "@/app/components/math/MathRenderer";

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function FillBlankEditor({ value, onChange }) {
  const answers = useMemo(() => readCandidates(value), [value]);
  const questionRef = useRef(null);
  const [activeAnswer, setActiveAnswer] = useState(0);
  const answerRefs = useRef([]);

  function updateAnswers(next) {
    const { answers: _legacyAnswers, ...behaviorConfig } = value.config || {};
    onChange({
      ...value,
      correctAnswer: next.find((a) => a.isCorrect)?.text || "",
      options: next,
      config: behaviorConfig,
    });
  }

  function addAnswer() {
    updateAnswers([...answers, { id: uid(), text: "", isCorrect: answers.length === 0 }]);
  }

  function removeAnswer(index) {
    const next = answers.filter((_, i) => i !== index);
    if (answers[index]?.isCorrect && next.length > 0) {
      next[0].isCorrect = true;
    }
    updateAnswers(next);
  }

  function setText(index, text) {
    const next = answers.map((a, i) => (i === index ? { ...a, text } : a));
    updateAnswers(next);
  }

  function setCorrect(index) {
    const next = answers.map((a, i) => ({ ...a, isCorrect: i === index }));
    updateAnswers(next);
  }

  function moveUp(index) {
    if (index === 0) return;
    const next = [...answers];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    updateAnswers(next);
  }

  function moveDown(index) {
    if (index === answers.length - 1) return;
    const next = [...answers];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    updateAnswers(next);
  }

  function handleQuestionInsert(insertText) {
    const input = questionRef.current;
    if (!input) return;
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const current = value.questionText || "";
    let toInsert = insertText;
    if (insertText === "\\frac{}{}") toInsert = "$\\frac{}{}$";
    else if (insertText === "\\sqrt{}") toInsert = "$\\sqrt{}$";
    else if (insertText === "\\sqrt[3]{}") toInsert = "$\\sqrt[3]{}$";
    else if (insertText.startsWith("\\") || insertText.startsWith("^{")) toInsert = `$${insertText}$`;
    const newVal = current.slice(0, start) + toInsert + current.slice(end);
    onChange({ ...value, questionText: newVal });
    setTimeout(() => {
      input.focus();
      let pos = start + toInsert.length;
      if (insertText === "$\\frac{}{}$") pos = start + "$\\frac{".length;
      else if (insertText === "$\\sqrt{}$" || insertText === "$\\sqrt[3]{}$") pos = start + toInsert.indexOf("{") + 1;
      input.setSelectionRange(pos, pos);
    }, 0);
  }

  function handleAnswerInsert(insertText) {
    const idx = activeAnswer;
    const ans = answers[idx];
    if (!ans) return;
    const input = answerRefs.current[idx];
    const current = ans.text || "";
    const start = input?.selectionStart ?? current.length;
    const end = input?.selectionEnd ?? current.length;
    let toInsert = insertText;
    if (insertText === "\\frac{}{}") toInsert = "$\\frac{}{}$";
    else if (insertText === "\\sqrt{}") toInsert = "$\\sqrt{}$";
    else if (insertText === "\\sqrt[3]{}") toInsert = "$\\sqrt[3]{}$";
    else if (insertText.startsWith("\\") || insertText.startsWith("^{")) toInsert = `$${insertText}$`;
    const newVal = current.slice(0, start) + toInsert + current.slice(end);
    setText(idx, newVal);
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
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          نص السؤال (استخدم ____ للفراغ) <span className="text-xs font-normal text-gray-500">(يدعم المعادلات)</span>
        </label>
        <MathToolbar onInsert={handleQuestionInsert} />
        <textarea
          ref={questionRef}
          placeholder="مثال: احسب $\frac{1}{2} + \sqrt{9} = ____$"
          value={value.questionText || ""}
          onChange={(e) => onChange({ ...value, questionText: e.target.value })}
          rows={3}
          className="w-full p-3 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 mt-2"
        />
        {value.questionText && (
          <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded text-sm">
            <MathRenderer text={value.questionText} />
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-semibold text-gray-700">
            الإجابات (اختار إجابة صحيحة واحدة) <span className="text-xs font-normal text-gray-500">(تدعم المعادلات)</span>
          </label>
          <button
            type="button"
            onClick={addAnswer}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            + إضافة إجابة
          </button>
        </div>
        <MathToolbar onInsert={handleAnswerInsert} />

        {answers.length === 0 && (
          <p className="text-sm text-gray-400 py-2">
            ضيف إجابة واحدة على الأقل
          </p>
        )}

        <div className="space-y-2">
          {answers.map((ans, i) => (
            <div
              key={ans.id || i}
              className="flex items-center gap-2 border border-gray-200 rounded-lg p-2 bg-white"
            >
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => moveUp(i)}
                  disabled={i === 0}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-25"
                  title="نقل لأعلى"
                >
                  <FiArrowUp size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => moveDown(i)}
                  disabled={i === answers.length - 1}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-25"
                  title="نقل لأسفل"
                >
                  <FiArrowDown size={14} />
                </button>
              </div>

              <input
                ref={(el) => (answerRefs.current[i] = el)}
                type="text"
                placeholder={`إجابة ${i + 1} — مثال: $\\frac{1}{2}$`}
                value={ans.text || ""}
                onChange={(e) => setText(i, e.target.value)}
                onFocus={() => setActiveAnswer(i)}
                className="flex-1 p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400"
              />

              <label className="flex items-center gap-1 cursor-pointer flex-shrink-0">
                <input
                  type="radio"
                   name={`fill-blank-correct-${value._id || value.id || "new"}`}
                  checked={!!ans.isCorrect}
                  onChange={() => setCorrect(i)}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-500">صح</span>
              </label>

              <button
                type="button"
                onClick={() => removeAnswer(i)}
                className="text-red-400 hover:text-red-600 flex-shrink-0"
                title="حذف"
              >
                <FiTrash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
