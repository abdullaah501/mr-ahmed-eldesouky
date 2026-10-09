"use client";

import { LuCheck } from "react-icons/lu";

const LABELS = {
  extracting: "Extraction",
  "missing-info": "Missing Info",
  generating: "Generation",
  validating: "Validation",
  importing: "Import",
};

const ORDER = [
  "extracting",
  "missing-info",
  "generating",
  "validating",
  "importing",
];

export default function AiWorkflowProgress({ step, stageProgress = [] }) {
  const currentIndex = ORDER.indexOf(step);
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1" dir="ltr">
      {ORDER.map((item, index) => {
        const stage = stageProgress.find(
          (entry) => entry.stage === item || entry.stage?.includes(item),
        );
        const complete =
          stage?.status === "done" ||
          (currentIndex > index && currentIndex !== -1);
        const active = item === step || stage?.status === "running";
        return (
          <div
            key={item}
            className="flex min-w-[86px] flex-1 items-center gap-1"
          >
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${complete ? "bg-emerald-100 text-emerald-700" : active ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-400"}`}
            >
              {complete ? <LuCheck size={11} /> : index + 1}
            </div>
            <span
              className={`whitespace-nowrap text-[11px] ${active ? "font-bold text-blue-700" : "text-gray-500"}`}
            >
              {LABELS[item]}
            </span>
            {index < ORDER.length - 1 && (
              <span className="mx-1 hidden h-px flex-1 bg-gray-200 sm:block" />
            )}
          </div>
        );
      })}
    </div>
  );
}
