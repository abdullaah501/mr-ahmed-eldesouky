import { registerImportPlugin } from "../../registry/pluginRegistry";
import { parseJsonBuffer } from "./parser";

const plugin = {
  id: "json",
  label: "JSON",
  implemented: true,
  extensions: [".json"],
  mimeTypes: ["application/json"],
  priority: 100,

  canImport(file) {
    if (file && typeof file.name === "string") {
      const name = file.name.toLowerCase();
      if (name.endsWith(".json")) return true;
    }
    if (file && typeof file.type === "string") {
      if (file.type.toLowerCase() === "application/json") return true;
    }
    return false;
  },

  async parse(buffer) {
    return parseJsonBuffer(buffer);
  },
};

plugin.version = 1;
plugin.capabilities = {
  supportsImages: false,
  supportsTables: false,
  supportsMath: false,
  supportsRTL: true,
};

registerImportPlugin(plugin);
