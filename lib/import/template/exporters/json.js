import { createTemplateDefinition } from "../templateDefinition.js";

// createTemplateDefinition is async: grade metadata comes from the Grade
// collection at request time.
export async function exportJsonTemplate() {
  const template = await createTemplateDefinition();
  return JSON.stringify(template, null, 2);
}
