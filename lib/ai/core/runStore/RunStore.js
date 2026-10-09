export const RunStore = {
  recordRun(run) {
    throw new Error("RunStore.recordRun() must be implemented by the concrete store");
  },
};