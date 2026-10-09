import { ensurePluginsRegistered } from "../plugins";
import * as ImportPipeline from "./ImportPipeline";

export const ImportEngine = {
  async importFile(file, { userId, options = {} } = {}) {
    ensurePluginsRegistered();

    if (!file) {
      return {
        success: false,
        report: { imported: 0, failed: 0, skipped: 0, warnings: 0, duration: 0 },
        errors: [{ code: "NO_FILE", message: "No file provided", stage: "engine" }],
        warnings: [],
        timings: {},
      };
    }

    if (!userId) {
      return {
        success: false,
        report: { imported: 0, failed: 0, skipped: 0, warnings: 0, duration: 0 },
        errors: [{ code: "NO_USER", message: "Unauthorized", stage: "engine" }],
        warnings: [],
        timings: {},
      };
    }

    return ImportPipeline.run({ file, userId, options });
  },
};
