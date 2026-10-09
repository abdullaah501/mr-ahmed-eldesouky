"use client";

import { useMemo } from "react";

const STATUS_LABELS = {
  healthy: "Ready",
  disabled: "Disabled",
  cooldown: "Cooling down",
  circuitOpen: "Circuit open",
  unconfigured: "Not configured",
};

export default function ProviderSelector({
  providers = [],
  health = {},
  provider,
  model,
  onProviderChange,
  onModelChange,
}) {
  const active = useMemo(
    () => providers.find((item) => item.id === provider) || providers[0],
    [providers, provider],
  );
  const status = health[active?.id]?.status || active?.status || "unconfigured";
  const models = active?.models || [];

  return (
    <div className="grid gap-3 sm:grid-cols-3" dir="ltr">
      <label className="space-y-1.5 sm:col-span-1">
        <span className="text-xs font-bold text-gray-500">Provider</span>
        <select
          value={active?.id || provider || ""}
          onChange={(event) => onProviderChange?.(event.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
        >
          {!providers.length && <option value="">Loading...</option>}
          {providers.map((item) => (
            <option key={item.id} value={item.id} disabled={!item.configured}>
              {item.label}
              {!item.configured ? " (not configured)" : ""}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1.5 sm:col-span-1">
        <span className="text-xs font-bold text-gray-500">Model</span>
        <select
          value={model || ""}
          onChange={(event) => onModelChange?.(event.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          disabled={!models.length}
        >
          {!models.length && <option value="">No models</option>}
          {models.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label || item.id}
            </option>
          ))}
        </select>
      </label>

      <div className="flex items-end pb-2">
        <span
          className={`inline-flex items-center gap-2 text-xs font-semibold ${status === "healthy" ? "text-emerald-700" : "text-amber-700"}`}
        >
          <span
            className={`h-2 w-2 rounded-full ${status === "healthy" ? "bg-emerald-500" : "bg-amber-500"}`}
          />
          {STATUS_LABELS[status] || status}
        </span>
      </div>
    </div>
  );
}
