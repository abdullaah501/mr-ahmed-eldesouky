const workflows = new Map();

export function registerWorkflow(type, workflow) {
  if (!type || typeof type !== "string") {
    throw new Error("Workflow type must be a string");
  }
  if (!workflow || typeof workflow.run !== "function") {
    throw new Error(`Workflow "${type}" must implement run(ctx)`);
  }
  workflows.set(type, workflow);
}

export function getWorkflow(type) {
  return workflows.get(type) || null;
}

export function listWorkflows() {
  return [...workflows.keys()];
}

export function clearWorkflows() {
  workflows.clear();
}