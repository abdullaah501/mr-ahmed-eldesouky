export class Command {
  constructor(type, payload) {
    this.type = type;
    this.payload = payload;
    this.timestamp = Date.now();
    this._inverse = null;
  }

  setInverse(inverse) {
    this._inverse = inverse;
    return this;
  }

  getInverse() {
    return this._inverse;
  }
}

export class AddQuestionCommand extends Command {
  constructor(question, index) {
    super("ADD_QUESTION", { question, index });
  }
}

export class UpdateQuestionCommand extends Command {
  constructor(id, changes) {
    super("UPDATE_QUESTION", { id, changes });
  }
}

export class DeleteQuestionCommand extends Command {
  constructor(id, index) {
    super("DELETE_QUESTION", { id, index });
  }
}

export class DuplicateQuestionCommand extends Command {
  constructor(sourceId, newQuestion, index) {
    super("DUPLICATE_QUESTION", { sourceId, newQuestion, index });
  }
}

export class ReorderQuestionsCommand extends Command {
  constructor(orderedIds) {
    super("REORDER_QUESTIONS", { orderedIds });
  }
}

export class SelectQuestionCommand extends Command {
  constructor(id) {
    super("SELECT_QUESTION", { id });
  }
}

export class SetQuestionsCommand extends Command {
  constructor(questions, selectedId) {
    super("SET_QUESTIONS", { questions, selectedId: selectedId || null });
  }
}

export const COMMANDS = {
  ADD_QUESTION: "ADD_QUESTION",
  UPDATE_QUESTION: "UPDATE_QUESTION",
  DELETE_QUESTION: "DELETE_QUESTION",
  DUPLICATE_QUESTION: "DUPLICATE_QUESTION",
  REORDER_QUESTIONS: "REORDER_QUESTIONS",
  SELECT_QUESTION: "SELECT_QUESTION",
  SET_QUESTIONS: "SET_QUESTIONS",
};
