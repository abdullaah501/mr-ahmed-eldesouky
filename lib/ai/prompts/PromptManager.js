import { getPrompt, latestVersion } from "./registry";
import { renderTemplate } from "./render";
import { aiEnv } from "../config/env";
import { AiError, AiErrorCode } from "../types/errors";

function resolveVersion(task, envVersion) {
  if (envVersion) return envVersion;
  return aiEnv().promptSelection[task] || latestVersion(task);
}

export function resolvePrompt(task, { version } = {}) {
  const v = resolveVersion(task, version);
  if (!v) {
    throw new AiError(AiErrorCode.ASSERTION_FAILED, `No prompt template registered for task "${task}"`);
  }
  const template = getPrompt(task, v);
  if (!template) {
    const msg = `Prompt "${task}@${v}" not registered`;
    throw new AiError(AiErrorCode.ASSERTION_FAILED, msg, { task, requestedVersion: v });
  }
  return template;
}

export async function renderPrompt(task, vars, options = {}) {
  const template = resolvePrompt(task, options);
  const text = await template.render(vars);
  return {
    id: task,
    version: template.version,
    text,
  };
}

export { renderTemplate };