const exporters = {
  json: () => import("./exporters/json").then((m) => m.exportJsonTemplate()),
  docx: () => import("./exporters/docx").then((m) => m.exportDocxTemplate()),
};

export function getExporter(format) {
  if (!format) return null;
  return exporters[format.toLowerCase()] || null;
}

export function getSupportedFormats() {
  return Object.keys(exporters);
}
