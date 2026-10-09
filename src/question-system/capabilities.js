const registry = new Map();

export function registerCapabilities(id, caps) {
  registry.set(id, { ...caps });
}

export function getCapabilities(id) {
  return registry.get(id) || {};
}

registerCapabilities("lesson-create", {
  canChangeContext: true,
  canSave: true,
  canDeleteQuestion: true,
  canAddQuestion: true,
  canDuplicate: true,
  canUpload: true,
  canChangeType: true,
  canReorder: true,
});

registerCapabilities("lesson-edit", {
  canChangeContext: false,
  canSave: true,
  canDeleteQuestion: true,
  canAddQuestion: true,
  canDuplicate: true,
  canUpload: true,
  canChangeType: true,
  canReorder: true,
});

registerCapabilities("readonly", {
  canChangeContext: false,
  canSave: false,
  canDeleteQuestion: false,
  canAddQuestion: false,
  canDuplicate: false,
  canUpload: false,
  canChangeType: false,
  canReorder: false,
});
