"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  get,
  meta as getMeta,
  listTypes,
} from "@/question-system/plugins/registry";
import { QuestionEngine } from "@/question-system/engine";
import ImagePreview from "../../../ImagePreview";
import { FaImage } from "react-icons/fa6";
import { upload } from "../../../../../../lib/upload";
import { SUBJECTS } from "../../../../../../constants/subjects";
import {
  DIFFICULTY_LEVELS,
  DEFAULT_DIFFICULTY,
} from "../../../../../../constants/questionDifficulty";
import { api } from "../../../../../../lib/axios/axios";
import MathToolbar from "../../../math/MathToolbar";
import MathRenderer from "../../../math/MathRenderer";
import { useRef } from "react";

function buildInitialState(question, showRepositoryFields) {
  const initial = { ...question };
  if (showRepositoryFields && !initial.difficulty) {
    initial.difficulty = DEFAULT_DIFFICULTY;
    initial.subject = SUBJECTS[2];
  }
  return initial;
}

export default function QuestionWorkspace({
  question,
  capabilities,
  onSave,
  onAdd,
  onChange,
  isNew,
  showRepositoryFields = false,
}) {
  const [q, setQ] = useState(() =>
    buildInitialState(question, showRepositoryFields),
  );
  const [syncedQuestion, setSyncedQuestion] = useState(question);
  if (question !== syncedQuestion) {
    setSyncedQuestion(question);
    setQ(buildInitialState(question, showRepositoryFields));
  }
  const [showPreview, setShowPreview] = useState(false);
  const [errors, setErrors] = useState([]);
  const [grades, setGrades] = useState([]);
  const [gradesLoading, setGradesLoading] = useState(true);
  const questionInputRef = useRef(null);

  useEffect(() => {
    async function fetchGrades() {
      try {
        const res = await api.get("/api/grades");
        if (res.data?.success) {
          setGrades(res.data.data);
        }
      } catch (err) {
        console.error("Failed to fetch grades:", err);
      } finally {
        setGradesLoading(false);
      }
    }
    fetchGrades();
  }, []);

  const typeMeta = getMeta(q.type);

  // Emits every user edit to the parent store so review/edit state survives
  // virtualized unmount/remount cycles. The render-phase prop sync above
  // intentionally does NOT emit — only user interactions do.
  function applyQ(next) {
    setQ(next);
    onChange?.(next);
  }

  function handleTypeChange(newType) {
    const converted = QuestionEngine.changeType(q, newType);
    applyQ({ ...converted, id: q.id });
  }

  function handleSave() {
    const result = QuestionEngine.validate(q);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    if (isNew && onAdd) {
      onAdd(q);
    } else {
      onSave(q.id, q);
    }
  }

  return (
    <div className="space-y-4 p-4 border border-gray-200 rounded-xl bg-white">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
          {isNew ? "سؤال جديد" : "تعديل السؤال"}
        </span>
      </div>

      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {errors.map((err, i) => (
            <p key={i}>• {err}</p>
          ))}
        </div>
      )}

      {capabilities.canUpload && (
        <div>
          <label
            htmlFor="question-image-workspace"
            className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-amber-500 hover:bg-amber-50 transition-colors"
          >
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <FaImage className="text-lg" />
              <span>ارفع صورة للسؤال (اختياري)</span>
            </div>
            <input
              id="question-image-workspace"
              type="file"
              accept="image/*"
              onChange={(ev) => {
                upload(ev, ({ url, cloudId }) => {
                  applyQ({ ...q, image: { url, cloudId } });
                });
              }}
              className="hidden"
            />
          </label>
          {q.image?.cloudId && (
            <div className="mt-2 w-fit">
              <ImagePreview
                image={q.image}
                alt="معاينة"
                width={120}
                height={120}
                quality={60}
                className="w-24 h-24 object-cover rounded-lg shadow"
              />
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">
          نص السؤال <span className="text-xs font-normal text-gray-500">(يدعم المعادلات: استخدم الشريط بالأسفل)</span>
        </label>
        <MathToolbar
          inputRef={questionInputRef}
          targetValue={q.questionText || ""}
          onChange={(newVal) => applyQ({ ...q, questionText: newVal })}
        />
        <textarea
          ref={questionInputRef}
          placeholder="نص السؤال..."
          value={q.questionText || ""}
          onChange={(e) => applyQ({ ...q, questionText: e.target.value })}
          rows={3}
          className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-400 transition resize-y"
        />
        {q.questionText && (
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-xs font-semibold text-gray-500 mb-1">معاينة:</p>
            <MathRenderer text={q.questionText} className="text-gray-800" />
          </div>
        )}
      </div>

      {showRepositoryFields && (
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-3">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            بيانات بنك الأسئلة
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                الصف
              </label>
              <select
                value={q.grade || ""}
                onChange={(e) => applyQ({ ...q, grade: e.target.value })}
                className="w-full p-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400"
              >
                <option value="">اختار الصف</option>
                {gradesLoading ? (
                  <option value="">جاري التحميل...</option>
                ) : (
                  grades.map((g) => (
                    <option key={g._id} value={g.name}>
                      {g.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                المادة
              </label>
              <select
                value={q.subject || ""}
                onChange={(e) => applyQ({ ...q, subject: e.target.value })}
                className="w-full p-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400"
              >
                <option value="">اختار المادة</option>
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                مستوى الصعوبة
              </label>
              <select
                value={q.difficulty || ""}
                onChange={(e) => applyQ({ ...q, difficulty: e.target.value })}
                className="w-full p-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400"
              >
                {DIFFICULTY_LEVELS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {capabilities.canChangeType && (
        <select
          value={q.type}
          onChange={(e) => handleTypeChange(e.target.value)}
          className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-400 transition"
        >
          <option value="multiple-choice">اختيار من متعدد</option>
          <option value="true-false">صح / خطأ</option>
          <option value="essay">سؤال مقالي</option>
          <option value="fill-blank">أكمل</option>
          <option value="matching">توصيل</option>
          <option value="image-choice">اختيار بالصور</option>
        </select>
      )}

      <div className="min-h-[100px]">
        {(() => {
          const plugin = get(q.type);
          if (!plugin?.Editor) {
            return (
              <p className="text-gray-400 text-sm">
                نوع السؤال غير مدعوم
              </p>
            );
          }
          const Editor = plugin.Editor;
          return <Editor value={q} onChange={applyQ} errors={errors} />;
        })()}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
        >
          {isNew ? "إضافة السؤال" : "حفظ التعديلات"}
        </button>

        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition text-sm"
        >
          {showPreview ? "إخفاء المعاينة" : "معاينة"}
        </button>
      </div>

      {showPreview && (
        <div className="border-t border-gray-200 pt-4">
          <h4 className="text-sm font-semibold text-gray-500 mb-2">معاينة</h4>
          {(() => {
            const plugin = get(q.type);
            if (!plugin?.Preview) {
              return (
                <p className="text-sm text-gray-400">{q.questionText || "—"}</p>
              );
            }
            const Preview = plugin.Preview;
            return <Preview question={q} />;
          })()}
        </div>
      )}
    </div>
  );
}
