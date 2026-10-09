export function makeMockImportEngine({ result = null } = {}) {
  const calls = [];
  const defaultResult = {
    success: true,
    report: { imported: 2, failed: 0, skipped: 0, warnings: 0, duration: 5 },
    errors: [],
    warnings: [],
    timings: {},
  };
  const mockResult = result || defaultResult;

  const ImportEngine = {
    _calls: calls,
    async importFile(file, opts) {
      calls.push({ file: file?.name, opts });
      if (opts?.options?.dryRun) {
        return {
          ...mockResult,
          report: { ...mockResult.report, imported: 0 },
        };
      }
      return mockResult;
    },
  };
  return ImportEngine;
}

export function makeMockOutputTarget({ id = "mock", ok = true } = {}) {
  const calls = [];
  return {
    id,
    implemented: true,
    _calls: calls,
    async write({ artifact, metadata, options } = {}) {
      calls.push({ artifact, artifactType: artifact?.type, metadata, options });
      return {
        ok,
        target: id,
        report: { imported: ok ? 1 : 0, failed: ok ? 0 : 1 },
        errors: ok ? [] : [{ code: "MOCK_FAIL", message: "mock failure" }],
      };
    },
  };
}