"use client";

import { LuCheck } from "react-icons/lu";
import AiWorkflowProgress from "../AiWorkflowProgress";

export default function ValidationStep({
  step,
  stageProgress,
  preflight,
  onImport,
  importing,
  importBlocked = false,
}) {
  const valid = preflight?.ok === true;
  const errors = preflight?.errors || [];
  return (
    <div className="space-y-5" dir="ltr">
      <AiWorkflowProgress step={step} stageProgress={stageProgress} />
      {importBlocked && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          Settings changed — regeneration and validation are required before
          importing.
        </div>
      )}
      {valid ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center font-bold text-emerald-700 flex items-center justify-center gap-2">
          <LuCheck size={16} /> ملف JSON سليم وجاهز للاستيراد
        </div>
      ) : (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <strong>Validation errors</strong>
          <ul className="mt-2 list-disc space-y-1 pr-5">
            {errors.map((error, index) => (
              <li key={`${error.code}-${index}`}>
                {error.message || error.code}
              </li>
            ))}
          </ul>
        </div>
      )}
      {valid && (
        <button
          type="button"
          disabled={importing || importBlocked}
          onClick={onImport}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {importing ? "Importing..." : "Import to Repository"}
        </button>
      )}
    </div>
  );
}
