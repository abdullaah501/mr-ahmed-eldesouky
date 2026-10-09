"use client";

import { useRef, useState, useEffect } from "react";
import ProviderSelector from "../ProviderSelector";
import SourceCard from "../shared/SourceCard";
import { SUBJECTS } from "../../../../../constants/subjects";
import { api } from "../../../../../lib/axios/axios";

const SOURCES = [
  {
    key: "text",
    icon: "✍️",
    title: "Written Text",
    description: "Paste text or write your notes",
  },
  {
    key: "file",
    icon: "📎",
    title: "Upload File",
    description: "PDF, DOCX, or supported image",
  },
  {
    key: "multiple",
    icon: "📚",
    title: "Multiple Files",
    description: "Merge several sources",
  },
];

const FILE_ACCEPT =
  ".pdf,.docx,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg";

const FILE_TYPES = {
  pdf: { label: "PDF", accept: ".pdf,application/pdf" },
  docx: {
    label: "DOCX",
    accept:
      ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  images: { label: "Images", accept: ".png,.jpg,.jpeg,image/png,image/jpeg" },
};

export const FILE_SUPPORT_REASONS = {
  native: "Natively supported by the model",
  local: "File will be extracted locally",
  unsupported: "Not supported",
};

export function resolveFileSupport(capabilities = {}, resourceExtractors = {}) {
  const caps = capabilities || {};
  const modes = {};
  for (const [type, { native }] of Object.entries({
    pdf: { native: Boolean(caps.files && caps.pdf) },
    docx: { native: Boolean(caps.files && caps.word) },
    images: { native: Boolean(caps.files && caps.images && caps.vision) },
  })) {
    const local =
      resourceExtractors[type === "images" ? "ocr" : type]?.implemented ===
      true;
    modes[type] = {
      local,
      native,
      mode: local ? "local" : native ? "native" : "unsupported",
    };
  }
  return modes;
}

function extensionOf(file) {
  return (
    String(file?.name || "")
      .toLowerCase()
      .match(/\.[^.]+$/)?.[0] || ""
  );
}

function detectFileType(file) {
  const extension = extensionOf(file);
  const mime = String(file?.type || "").toLowerCase();
  if (extension === ".pdf" || mime === "application/pdf") return "pdf";
  if (
    extension === ".docx" ||
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  )
    return "docx";
  if (
    [".png", ".jpg", ".jpeg"].includes(extension) ||
    ["image/png", "image/jpeg"].includes(mime)
  )
    return "images";
  return null;
}

export default function SourceStep({
  providers,
  health,
  provider,
  model,
  capabilities,
  resourceExtractors = {},
  source,
  onProviderChange,
  onModelChange,
  onSourceChange,
  onStart,
  loading,
}) {
  const fileRef = useRef(null);
  const [fileError, setFileError] = useState("");
  const [grades, setGrades] = useState([]);
  const [gradesLoading, setGradesLoading] = useState(true);

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

  const active = SOURCES.find((item) => item.key === source?.type);
  const support = resolveFileSupport(capabilities, resourceExtractors);
  const supportedTypes = Object.keys(FILE_TYPES).filter(
    (type) => support[type].mode !== "unsupported",
  );
  const supportedFileDescription =
    supportedTypes.map((type) => FILE_TYPES[type].label).join(" or ") ||
    "No supported formats";
  const acceptTypes =
    supportedTypes.map((type) => FILE_TYPES[type].accept).join(",") ||
    FILE_ACCEPT;
  const sourceDisabled = {
    file: supportedTypes.length === 0,
    multiple: true,
  };

  function choose(type) {
    if (sourceDisabled[type]) return;
    setFileError("");
    onSourceChange?.({ ...source, type, file: null, text: "" });
    if (type !== "text") fileRef.current?.click();
  }

  function fileChange(event) {
    const file = event.target.files?.[0] || null;
    const type = detectFileType(file);
    if (file?.name?.toLowerCase().endsWith(".doc")) {
      setFileError(
        "The legacy Word format (.doc) is currently not supported. Please use the .docx format.",
      );
      onSourceChange?.({ ...source, file: null });
      event.target.value = "";
      return;
    }
    if (!type || support[type].mode === "unsupported") {
      setFileError(
        type
          ? `${FILE_TYPES[type].label} files are not supported with this model and no local extraction is available.`
          : "This file type is currently not supported. Supported types: PDF, DOCX, and text, plus images when a vision-capable provider is available.",
      );
      onSourceChange?.({ ...source, file: null });
      event.target.value = "";
      return;
    }
    setFileError("");
    onSourceChange?.({ ...source, type, file });
  }

  return (
    <div className="space-y-5" dir="ltr">
      <ProviderSelector
        providers={providers}
        health={health}
        provider={provider}
        model={model}
        onProviderChange={onProviderChange}
        onModelChange={onModelChange}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SOURCES.map((item) => (
          <SourceCard
            key={item.key}
            icon={item.icon}
            title={item.title}
            description={
              item.key === "file" ? supportedFileDescription : item.description
            }
            selected={
              item.key === "file"
                ? ["file", "pdf", "docx", "images"].includes(source?.type)
                : source?.type === item.key
            }
            disabled={sourceDisabled[item.key]}
            disabledReason={
              item.key === "multiple"
                ? "Not supported in this version"
                : "Not supported by the current model"
            }
            onClick={() => choose(item.key)}
          />
        ))}
      </div>
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept={acceptTypes}
        onChange={fileChange}
      />
      {fileError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {fileError}
        </div>
      )}
      <div
        className="grid gap-2 rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs sm:grid-cols-3"
        dir="ltr"
      >
        {Object.entries(FILE_TYPES).map(([type, meta]) => (
          <div
            key={type}
            className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2"
          >
            <span className="font-semibold text-gray-700">{meta.label}</span>
            <span
              className={
                support[type].mode === "unsupported"
                  ? "text-gray-400"
                  : support[type].mode === "local"
                    ? "text-blue-600"
                    : "text-emerald-600"
              }
            >
              {FILE_SUPPORT_REASONS[support[type].mode]}
            </span>
          </div>
        ))}
      </div>
      {active?.key === "text" && (
        <textarea
          value={source?.text || ""}
          onChange={(event) =>
            onSourceChange?.({ ...source, text: event.target.value })
          }
          rows={8}
          placeholder="Type or paste educational content here..."
          className="w-full rounded-xl border border-gray-200 p-3 text-sm"
        />
      )}
      {active?.key !== "text" && source?.file && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-blue-100 bg-blue-50 p-3 text-blue-800">
          <span>{source.file.name}</span>
          {support[source.type] && (
            <span className="text-xs font-semibold">
              {FILE_SUPPORT_REASONS[support[source.type].mode]}
            </span>
          )}
        </div>
      )}
      <div className="grid gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-xs font-semibold text-gray-600">
            Subject (optional)
          </span>
          <select
            value={source?.subject || ""}
            onChange={(event) =>
              onSourceChange?.({ ...source, subject: event.target.value })
            }
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="">Select a subject</option>
            {SUBJECTS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-semibold text-gray-600">
            Grade (optional)
          </span>
          <select
            value={source?.grade || ""}
            onChange={(event) =>
              onSourceChange?.({ ...source, grade: event.target.value })
            }
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="">Select a grade</option>
            {!gradesLoading ? (
              grades.map((item) => (
                <option key={item._id} value={item.name}>
                  {item.name}
                </option>
              ))
            ) : (
              <option value="">Loading...</option>
            )}
          </select>
        </label>
        <label className="space-y-1.5 sm:col-span-2">
          <span className="text-xs font-semibold text-gray-600">
            Lesson title (optional)
          </span>
          <input
            value={source?.lessonTitle || ""}
            onChange={(event) =>
              onSourceChange?.({ ...source, lessonTitle: event.target.value })
            }
            placeholder="e.g. Linear equations"
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </label>
      </div>
      <button
        type="button"
        disabled={
          loading ||
          !source ||
          (source.type === "text" && !source.text?.trim()) ||
          (source.type !== "text" && !source.file)
        }
        onClick={() => onStart?.(source)}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Starting extraction..." : "Start Extraction"}
      </button>
    </div>
  );
}
