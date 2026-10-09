"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LuX } from "react-icons/lu";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useAiWorkflow } from "../../../hooks/useAiWorkflow";
import Stepper from "../ai/shared/Stepper";
import ProviderSelector from "../ai/ProviderSelector";
import AiWorkflowProgress from "../ai/AiWorkflowProgress";
import DebugPanel from "../ai/DebugPanel";
import SourceStep from "../ai/steps/SourceStep";
import ExtractionStep from "../ai/steps/ExtractionStep";
import GenerationSettingsStep from "../ai/steps/GenerationSettingsStep";
import ReviewStep from "../ai/steps/ReviewStep";
import ValidationStep from "../ai/steps/ValidationStep";
import ImportStep from "../ai/steps/ImportStep";

const STEPS = [
  { key: "source", label: "Source" },
  { key: "extracting", label: "Extraction" },
  { key: "settings", label: "Settings" },
  { key: "generating", label: "Generation" },
  { key: "review", label: "Review" },
  { key: "validating", label: "Validation" },
  { key: "importing", label: "Import" },
];

const BACK_LABELS = {
  extracting: "Source",
  "missing-info": "Source",
  settings: "Missing Info",
  generating: "Settings",
  review: "Generation",
  validating: "Review",
  importing: "Validation",
};

export default function AIGeneratorModal({ onClose }) {
  const workflow = useAiWorkflow();
  const queryClient = useQueryClient();
  const [source, setSource] = useState({
    type: "text",
    text: "",
    file: null,
    subject: "الكيمياء",
    grade: "",
    lessonTitle: "",
  });
  const busy = ["extracting", "generating", "validating", "importing"].includes(
    workflow.step,
  );
  const showBack =
    BACK_LABELS[workflow.step] &&
    !busy &&
    !workflow.cancelled &&
    workflow.step !== "done";

  const handleClose = useCallback(() => {
    workflow.cancel();
    onClose?.();
  }, [onClose, workflow]);

  const handleSourceStart = useCallback(
    async (value) => {
      try {
        const extraction = await workflow.extract(value);
        await workflow.collect(extraction.context || workflow.context, {});
      } catch (error) {
        if (error?.name === "AbortError" || error?.cancelled) return;
        toast.error(error.message || "Could not extract content");
      }
    },
    [workflow],
  );

  const handleMissingInfo = useCallback(
    async (answers) => {
      try {
        await workflow.collect(workflow.context, answers);
      } catch (error) {
        if (error?.name === "AbortError" || error?.cancelled) return;
        toast.error(error.message || "Could not save information");
      }
    },
    [workflow],
  );

  const handleGenerate = useCallback(
    async (params) => {
      try {
        await workflow.generate(params);
      } catch (error) {
        if (error?.name === "AbortError" || error?.cancelled) return;
        toast.error(error.message || "Could not generate questions");
      }
    },
    [workflow],
  );

  const handleValidate = useCallback(async () => {
    try {
      await workflow.validate();
    } catch (error) {
      if (error?.name === "AbortError" || error?.cancelled) return;
      toast.error(error.message || "Could not validate");
    }
  }, [workflow]);

  const handleImport = useCallback(async () => {
    try {
      // FINAL IMPORT BOUNDARY: importRepository() resolves only after the
      // reviewed questions were actually persisted (failures throw), so this
      // is the single authoritative success point. Refresh the Question Bank
      // here — never on generation/review events, and never per question.
      // Do NOT gate on report.imported > 0: the dedup preflight resolves
      // success with imported: 0 (already_imported) even though an aborted
      // earlier run may have persisted server-side, so a zero-import success
      // must still refresh.
      const result = await workflow.importRepository();
      if (result && result.cancelled !== true) {
        await queryClient.invalidateQueries({ queryKey: ["repository"] });
        await queryClient.invalidateQueries({
          queryKey: ["repositoryStats"],
        });
      }
    } catch (error) {
      if (error?.name === "AbortError" || error?.cancelled) return;
      toast.error(error.message || "Could not import");
    }
  }, [queryClient, workflow]);

  const handleRetry = useCallback(() => {
    workflow.retryStage();
  }, [workflow]);

  const handleGoBack = useCallback(() => {
    workflow.goBack();
  }, [workflow]);

  const missingInfoAnswers = workflow.missingInfoAnswers || {};
  const isSettingsOrReview =
    workflow.step === "settings" ||
    workflow.step === "review" ||
    workflow.step === "validating";
  const showStaleBanner =
    isSettingsOrReview && (workflow.stale.draft || workflow.stale.canonical);
  const importBlocked = workflow.stale.draft || workflow.stale.canonical;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm"
      dir="ltr"
      onClick={busy ? undefined : handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-generator-title"
    >
      <div
        className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 space-y-4 border-b border-gray-100 bg-white px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <h2
              id="ai-generator-title"
              className="text-lg font-bold text-gray-800"
            >
              AI Question Generator
            </h2>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Close"
            >
              <LuX size={16} />
            </button>
          </div>
          <Stepper
            items={STEPS}
            current={
              workflow.step === "missing-info" ? "extracting" : workflow.step
            }
          />
          {showBack && (
            <button
              type="button"
              onClick={handleGoBack}
              className="self-start rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
            >
              ‹ Back to {BACK_LABELS[workflow.step]}
            </button>
          )}
          {showStaleBanner && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              Settings changed — regeneration required.
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {workflow.step === "source" && (
            <SourceStep
              providers={workflow.providers}
              health={workflow.health}
              provider={workflow.provider}
              model={workflow.model}
              capabilities={workflow.capabilities}
              resourceExtractors={workflow.resourceExtractors}
              source={source}
              onProviderChange={workflow.setProvider}
              onModelChange={workflow.setModel}
              onSourceChange={setSource}
              onStart={handleSourceStart}
              loading={false}
            />
          )}
          {["extracting", "missing-info"].includes(workflow.step) && (
            <ExtractionStep
              step={workflow.step}
              stageProgress={workflow.stageProgress}
              missingFields={workflow.missingFields}
              answers={missingInfoAnswers}
              onSubmitMissing={handleMissingInfo}
              submitting={workflow.step === "extracting"}
            />
          )}
          {workflow.step === "settings" && (
            <GenerationSettingsStep
              initial={workflow.generationParams}
              onSubmit={handleGenerate}
              loading={false}
            />
          )}
          {workflow.step === "generating" && (
            <div className="space-y-5">
              <AiWorkflowProgress
                step="generating"
                stageProgress={workflow.stageProgress}
              />
              <Working title="Generating Questions..." />
            </div>
          )}
          {workflow.step === "review" && (
            <ReviewStep
              questions={workflow.draftQuestions}
              regeneratingIndex={workflow.regeneratingIndex}
              onChange={workflow.updateQuestion}
              onDelete={workflow.deleteQuestion}
              onDuplicate={workflow.duplicateQuestion}
              onRegenerate={workflow.regenerateQuestion}
              onReorder={workflow.reorderQuestions}
              onValidate={handleValidate}
              validating={false}
            />
          )}
          {workflow.step === "validating" && (
            <ValidationStep
              step="validating"
              stageProgress={workflow.stageProgress}
              preflight={workflow.preflightResult}
              onImport={handleImport}
              importing={workflow.step === "importing"}
              importBlocked={importBlocked}
            />
          )}
          {workflow.step === "importing" && (
            <div className="space-y-5">
              <AiWorkflowProgress
                step="importing"
                stageProgress={workflow.stageProgress}
              />
              <Working title="Importing to Repository..." />
            </div>
          )}
          {workflow.step === "done" && (
            <ImportStep report={workflow.importReport} onClose={handleClose} />
          )}

          {workflow.cancelled && workflow.step !== "done" && (
            <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
              Operation cancelled.
            </div>
          )}
          {workflow.error && workflow.step !== "done" && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <div className="whitespace-pre-line">
                {workflow.error.message}
              </div>
              <button
                type="button"
                onClick={handleRetry}
                className="mt-2 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white"
              >
                Retry current stage
              </button>
            </div>
          )}
          <div className="mt-5">
            <DebugPanel
              metadata={{
                ...workflow.debugMetadata,
                workflow: workflow.step,
                provider: workflow.debugMetadata?.provider || workflow.provider,
                model: workflow.debugMetadata?.model || workflow.model,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Working({ title }) {
  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50 p-10 text-center text-sm font-semibold text-blue-700">
      <span className="mb-3 inline-block h-6 w-6 animate-spin rounded-full border-2 border-blue-200 border-t-blue-700" />{" "}
      <div>{title}</div>
    </div>
  );
}
