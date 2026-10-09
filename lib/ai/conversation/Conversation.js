export class Conversation {
  constructor({ system } = {}) {
    this.system = system || null;
    this.messages = [];
  }

  setSystem(text) {
    this.system = text || null;
    return this;
  }

  add(role, content) {
    if (!role || content == null) return this;
    this.messages.push({ role, content });
    return this;
  }

  user(content) {
    return this.add("user", content);
  }

  assistant(content) {
    return this.add("assistant", content);
  }

  build() {
    const list = [];
    if (this.system) list.push({ role: "system", content: this.system });
    list.push(...this.messages);
    return list;
  }

  estimatedTokens(tokenCountFn) {
    let total = 0;
    for (const m of this.build()) {
      total += tokenCountFn ? tokenCountFn({ text: m.content }) : Math.ceil(String(m.content || "").length / 4);
    }
    return total;
  }

  reset() {
    this.system = null;
    this.messages = [];
    return this;
  }
}