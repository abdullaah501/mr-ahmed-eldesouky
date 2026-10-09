import { describe, it, expect } from "vitest";

import plugin from "../../src/question-system/plugins/true-false/core";

const normalize = (correctAnswer) =>
  plugin.normalize({ type: "true-false", questionText: "q", correctAnswer })
    .correctAnswer;

describe("true-false normalize — canonical string values", () => {
  it.each([
    ["true", "true"],
    ["TRUE", "true"],
    [" true ", "true"],
    ["false", "false"],
    ["FALSE", "false"],
    [" false ", "false"],
  ])("normalize(%j) === %j", (input, expected) => {
    expect(normalize(input)).toBe(expected);
  });
});

describe("true-false normalize — approved legacy aliases", () => {
  it.each([
    ["صح", "true"],
    ["نعم", "true"],
    ["yes", "true"],
    ["Yes", "true"],
    ["خطأ", "false"],
    ["لا", "false"],
    ["no", "false"],
    ["NO", "false"],
  ])("normalize(%j) === %j", (input, expected) => {
    expect(normalize(input)).toBe(expected);
  });
});

describe("true-false normalize — no over-coercion", () => {
  it.each(["1", "0", "y", "n", "correct", "incorrect", "صح/خطأ", "maybe", ""])(
    "does not coerce %j",
    (input) => {
      // Unknown values flow through unchanged into the existing validation
      // behavior instead of being silently converted.
      expect(normalize(input)).toBe(input);
    },
  );
});

describe("true-false normalize — stored representation stays strings", () => {
  it("keeps canonical output as the strings \"true\"/\"false\", never booleans", () => {
    expect(normalize("صح")).toBe("true");
    expect(normalize("خطأ")).toBe("false");
    expect(typeof normalize("true")).toBe("string");
    expect(typeof normalize("false")).toBe("string");
  });
});
