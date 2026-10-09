"use client";

import { useState } from "react";

export default function DebugPanel({ metadata = {} }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="rounded-lg border border-gray-200 bg-gray-50 text-sm"
      dir="ltr"
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-bold text-gray-600"
      >
        <span>Advanced</span>
        <span>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="grid gap-x-4 gap-y-2 border-t border-gray-200 px-3 py-3 text-xs sm:grid-cols-2">
          <Row label="Provider" value={metadata.provider} />
          <Row label="Model" value={metadata.model} />
          <Row label="Prompt" value={metadata.prompt || metadata.workflow} />
          <Row label="Prompt Version" value={metadata.promptVersion} />
          <Row label="Schema" value={metadata.schema} />
          <Row
            label="Cache"
            value={
              metadata.cacheHit == null
                ? "-"
                : metadata.cacheHit
                  ? "HIT"
                  : "MISS"
            }
          />
          <Row
            label="Latency"
            value={
              metadata.latencyMs == null
                ? "-"
                : `${(metadata.latencyMs / 1000).toFixed(2)}s`
            }
          />
          <Row
            label="Cost"
            value={
              metadata.cost == null
                ? "-"
                : `$${Number(metadata.cost).toFixed(4)}`
            }
          />
          <Row label="Retries" value={metadata.retries ?? 0} />
          <Row label="Tokens" value="unavailable" />
        </div>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex min-w-0 justify-between gap-2">
      <span className="text-gray-500">{label}</span>
      <span className="truncate font-semibold text-gray-700">
        {value ?? "-"}
      </span>
    </div>
  );
}
