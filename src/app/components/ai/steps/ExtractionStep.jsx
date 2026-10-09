"use client";

import AiWorkflowProgress from "../AiWorkflowProgress";
import MissingInfoForm from "../MissingInfoForm";

export default function ExtractionStep({
  step,
  stageProgress,
  missingFields,
  answers,
  onSubmitMissing,
  submitting,
}) {
  const needsInfo = step === "missing-info" && missingFields?.length;
  return (
    <div className="space-y-5" dir="ltr">
      <AiWorkflowProgress step={step} stageProgress={stageProgress} />
      {needsInfo ? (
        <MissingInfoForm
          fields={missingFields}
          initialAnswers={answers}
          onSubmit={onSubmitMissing}
          submitting={submitting}
        />
      ) : (
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-8 text-center text-sm font-semibold text-blue-700">
          Extracting educational content...
        </div>
      )}
    </div>
  );
}
