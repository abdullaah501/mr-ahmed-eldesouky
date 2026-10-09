export class PromptBuilder {
  constructor() {
    this.sections = [];
  }

  add(section) {
    if (typeof section === "function") {
      this.sections.push({ fn: section });
    } else if (typeof section === "string") {
      this.sections.push({ text: section });
    } else if (section == null) {
      return this;
    } else {
      throw new Error("PromptBuilder.add() accepts a function or string");
    }
    return this;
  }

  addIf(condition, sectionFn) {
    if (condition) {
      if (typeof sectionFn === "function") this.sections.push({ fn: sectionFn });
      else if (typeof sectionFn === "string" && sectionFn) this.sections.push({ text: sectionFn });
    }
    return this;
  }

  build(ctx = {}) {
    const parts = [];
    for (const section of this.sections) {
      if ("text" in section) {
        parts.push(section.text);
      } else {
        const out = section.fn(ctx);
        if (out) parts.push(out);
      }
    }
    return parts.join("\n\n");
  }
}

export function createPromptBuilder() {
  return new PromptBuilder();
}