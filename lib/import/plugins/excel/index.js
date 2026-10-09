import { registerImportPlugin } from "../../registry/pluginRegistry";

registerImportPlugin({
  version: 1,
  capabilities: {},
  implemented: false,
  id: "excel",
  label: "Excel",
  extensions: [".xlsx", ".xls"],
  mimeTypes: [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
  ],
  priority: 80,

  canImport(file) {
    const name = file && typeof file.name === "string" ? file.name.toLowerCase() : "";
    return name.endsWith(".xlsx") || name.endsWith(".xls");
  },

  async parse() {
    throw new Error("excel import not implemented");
  },
});
