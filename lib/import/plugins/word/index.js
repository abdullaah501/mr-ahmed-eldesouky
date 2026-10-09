import { registerImportPlugin } from "../../registry/pluginRegistry";
import { parseWordBuffer } from "./parser";

const plugin = {
  version: 1,
  capabilities: {
    supportsImages: true,
    supportsTables: true,
    supportsMath: false,
    supportsRTL: true,
    supportsMarkers: true,
    supportsHeuristics: true,
    supportsOptionImages: false,
  },
  implemented: true,
  id: "word",
  label: "Word",
  extensions: [".docx", ".doc"],
  mimeTypes: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
  ],
  priority: 80,

  canImport(file) {
    const name = file && typeof file.name === "string" ? file.name.toLowerCase() : "";
    return name.endsWith(".docx") || name.endsWith(".doc");
  },

  async parse(buffer) {
    return parseWordBuffer(buffer);
  },
};

registerImportPlugin(plugin);
