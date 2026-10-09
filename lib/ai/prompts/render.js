const TOKEN = /\{\{\s*([\w.]+)\s*\}\}/g;

export function renderTemplate(template, vars = {}) {
  if (!template) return "";
  return String(template).replace(TOKEN, (match, path) => {
    const value = resolvePath(vars, path);
    if (value === undefined || value === null) return "";
    return String(value);
  });
}

function resolvePath(vars, path) {
  const parts = String(path).split(".");
  let current = vars;
  for (const p of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = current[p];
  }
  return current;
}