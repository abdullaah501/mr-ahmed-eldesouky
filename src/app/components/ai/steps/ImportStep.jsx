"use client";

import { LuCheck } from "react-icons/lu";

export default function ImportStep({ report, onClose }) {
  const result = report?.report || report || {};
  return (
    <div className="space-y-5 text-center" dir="ltr">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-700">
        <div className="text-3xl flex justify-center"><LuCheck size={28} /></div>
        <h3 className="mt-2 font-bold">Operation Completed</h3>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <Stat label="Imported" value={result.imported ?? 0} />
        <Stat label="Skipped" value={result.skipped ?? 0} />
        <Stat label="Failed" value={result.failed ?? 0} />
        <Stat label="Warnings" value={result.warnings ?? 0} />
      </div>
      <button
        type="button"
        onClick={onClose}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
      >
        Close
      </button>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="text-xl font-bold text-gray-800">{value}</div>
      <div className="text-[11px] text-gray-500">{label}</div>
    </div>
  );
}
