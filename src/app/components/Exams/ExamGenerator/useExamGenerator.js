"use client";

import { useReducer, useCallback, useRef } from "react";
import {
  AddQuestionCommand,
  UpdateQuestionCommand,
  DeleteQuestionCommand,
  DuplicateQuestionCommand,
  ReorderQuestionsCommand,
  SelectQuestionCommand,
  SetQuestionsCommand,
} from "@/question-system/commands";
import { QuestionEngine } from "@/question-system/engine";

function cloneQuestions(arr) {
  return arr.map((q) => ({ ...q }));
}

function findIndex(questions, id) {
  return questions.findIndex((q) => q.id === id);
}

const MAX_HISTORY = 50;

function reducer(state, command) {
  const past = [...state.past];

  switch (command.type) {
    case "SET_QUESTIONS": {
      const questions = cloneQuestions(command.payload.questions);
      const selectedId =
        command.payload.selectedId || (questions.length > 0 ? questions[0].id : null);
      return {
        ...state,
        questions,
        selectedId: selectedId || state.selectedId,
        dirty: false,
        past: [...past.slice(-MAX_HISTORY), { questions: state.questions, selectedId: state.selectedId }],
      };
    }

    case "ADD_QUESTION": {
      const { question, index } = command.payload;
      const questions = cloneQuestions(state.questions);
      const insertAt = index != null ? index : questions.length;
      questions.splice(insertAt, 0, question);
      return {
        ...state,
        questions,
        selectedId: question.id,
        dirty: true,
        past: [...past.slice(-MAX_HISTORY), { questions: state.questions, selectedId: state.selectedId }],
      };
    }

    case "UPDATE_QUESTION": {
      const { id, changes } = command.payload;
      const questions = cloneQuestions(state.questions);
      const idx = findIndex(questions, id);
      if (idx === -1) return state;
      questions[idx] = { ...questions[idx], ...changes };
      return {
        ...state,
        questions,
        dirty: true,
        past: [...past.slice(-MAX_HISTORY), { questions: state.questions, selectedId: state.selectedId }],
      };
    }

    case "DELETE_QUESTION": {
      const { id } = command.payload;
      const questions = cloneQuestions(state.questions).filter((q) => q.id !== id);
      const selectedId =
        state.selectedId === id
          ? questions.length > 0
            ? questions[0].id
            : null
          : state.selectedId;
      return {
        ...state,
        questions,
        selectedId,
        dirty: true,
        past: [...past.slice(-MAX_HISTORY), { questions: state.questions, selectedId: state.selectedId }],
      };
    }

    case "DUPLICATE_QUESTION": {
      const { sourceId } = command.payload;
      const questions = cloneQuestions(state.questions);
      const sourceIdx = findIndex(questions, sourceId);
      if (sourceIdx === -1) return state;
      const copy = QuestionEngine.duplicate(questions[sourceIdx]);
      questions.splice(sourceIdx + 1, 0, copy);
      return {
        ...state,
        questions,
        selectedId: copy.id,
        dirty: true,
        past: [...past.slice(-MAX_HISTORY), { questions: state.questions, selectedId: state.selectedId }],
      };
    }

    case "REORDER_QUESTIONS": {
      const { orderedIds } = command.payload;
      const idMap = new Map(state.questions.map((q) => [q.id, q]));
      const questions = orderedIds.map((id) => idMap.get(id)).filter(Boolean);
      return {
        ...state,
        questions,
        dirty: true,
        past: [...past.slice(-MAX_HISTORY), { questions: state.questions, selectedId: state.selectedId }],
      };
    }

    case "SELECT_QUESTION": {
      return { ...state, selectedId: command.payload.id };
    }

    default:
      return state;
  }
}

function initialState(initialQuestions, initialSelectedId) {
  const questions = initialQuestions?.length
    ? initialQuestions.map((q) => ({
        id: q.id || q._id || crypto.randomUUID(),
        ...q,
      }))
    : [];
  return {
    questions,
    selectedId: initialSelectedId || (questions.length > 0 ? questions[0].id : null),
    dirty: false,
    past: [],
  };
}

export default function useExamGenerator({ initialQuestions, selectedId } = {}) {
  const [state, rawDispatch] = useReducer(reducer, { initialQuestions, selectedId }, (opts) =>
    initialState(opts.initialQuestions, opts.selectedId)
  );

  const stateRef = useRef(state);
  stateRef.current = state;

  const dispatch = useCallback((command) => {
    rawDispatch(command);
  }, []);

  const addQuestion = useCallback(
    (question, index) => dispatch(new AddQuestionCommand(question, index)),
    [dispatch]
  );

  const updateQuestion = useCallback(
    (id, changes) => dispatch(new UpdateQuestionCommand(id, changes)),
    [dispatch]
  );

  const deleteQuestion = useCallback(
    (id) => dispatch(new DeleteQuestionCommand(id)),
    [dispatch]
  );

  const duplicateQuestion = useCallback(
    (sourceId) => dispatch(new DuplicateQuestionCommand(sourceId)),
    [dispatch]
  );

  const reorderQuestions = useCallback(
    (orderedIds) => dispatch(new ReorderQuestionsCommand(orderedIds)),
    [dispatch]
  );

  const selectQuestion = useCallback(
    (id) => dispatch(new SelectQuestionCommand(id)),
    [dispatch]
  );

  const setQuestions = useCallback(
    (questions, selId) => dispatch(new SetQuestionsCommand(questions, selId)),
    [dispatch]
  );

  const selectedQuestion = state.questions.find((q) => q.id === state.selectedId) || null;

  return {
    questions: state.questions,
    selectedId: state.selectedId,
    selectedQuestion,
    dirty: state.dirty,
    dispatch,

    addQuestion,
    updateQuestion,
    deleteQuestion,
    duplicateQuestion,
    reorderQuestions,
    selectQuestion,
    setQuestions,
  };
}
