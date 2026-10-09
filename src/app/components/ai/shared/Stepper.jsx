"use client";

import { LuCheck } from "react-icons/lu";

export default function Stepper({ items, current }) {
  const currentIndex = items.findIndex((item) => item.key === current);
  return (
    <div className="flex items-center gap-1 overflow-x-auto" dir="ltr">
      {items.map((item, index) => (
        <div key={item.key} className="flex min-w-fit items-center gap-1">
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${index < currentIndex ? "bg-emerald-100 text-emerald-700" : index === currentIndex ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-400"}`}
          >
            {index < currentIndex ? <LuCheck size={11} /> : index + 1}
          </div>
          <span
            className={`whitespace-nowrap text-[11px] ${index === currentIndex ? "font-bold text-blue-700" : "text-gray-500"}`}
          >
            {item.label}
          </span>
          {index < items.length - 1 && (
            <span className="mx-1 hidden h-px w-4 bg-gray-200 sm:block" />
          )}
        </div>
      ))}
    </div>
  );
}
