const templates = new Map();
const experiments = new Map();

export function registerPrompt(template) {
  if (!template || typeof template !== "object") {
    throw new Error("Prompt template must be an object");
  }
  if (!template.task || typeof template.task !== "string") {
    throw new Error("Prompt template must declare a task string");
  }
  if (!template.version || typeof template.version !== "string") {
    throw new Error(`Prompt "${template.task}" must declare a string version`);
  }
  if (typeof template.render !== "function") {
    throw new Error(`Prompt "${template.task}@${template.version}" must implement render(vars)`);
  }

  const key = `${template.task}@${template.version}`;
  templates.set(key, template);

  const byTask = templatesByTask(template.task);
  byTask.set(template.version, template);
  experiments.set(template.task, byTask);
}

function templatesByTask(task) {
  return experiments.get(task) || new Map();
}

export function getPrompt(task, version) {
  if (version) return templates.get(`${task}@${version}`) || null;
  const byTask = experiments.get(task);
  if (!byTask || byTask.size === 0) return null;
  return [...byTask.values()].slice(-1)[0] || null;
}

export function latestVersion(task) {
  const byTask = experiments.get(task);
  if (!byTask || byTask.size === 0) return null;
  return [...byTask.keys()].slice(-1)[0] || null;
}

export function listPrompts() {
  return [...templates.keys()];
}

export function listVersions(task) {
  const byTask = experiments.get(task);
  if (!byTask) return [];
  return [...byTask.keys()];
}

export function clearPrompts() {
  templates.clear();
  experiments.clear();
}