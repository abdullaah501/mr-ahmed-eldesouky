"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { readCandidates } from "./core";
import MathRenderer from "@/app/components/math/MathRenderer";

function CheckIcon() {
 return (
 <svg
 className="w-4 h-4"
 fill="none"
 stroke="currentColor"
 viewBox="0 0 24 24"
 aria-hidden="true"
 >
 <path
 strokeLinecap="round"
 strokeLinejoin="round"
 strokeWidth="2"
 d="M5 13l4 4L19 7"
 />
 </svg>
 );
}

function CrossIcon() {
 return (
 <svg
 className="w-4 h-4"
 fill="none"
 stroke="currentColor"
 viewBox="0 0 24 24"
 aria-hidden="true"
 >
 <path
 strokeLinecap="round"
 strokeLinejoin="round"
 strokeWidth="2"
 d="M6 18L18 6M6 6l12 12"
 />
 </svg>
 );
}

function buildAnswerPool(question) {
 const fromConfig = readCandidates(question).filter(
 (candidate) => candidate.text,
 );

 if (fromConfig.length > 0) return fromConfig;

 if (question.correctAnswer?.trim()) {
 return [
 {
 id: "legacy-0",
 text: question.correctAnswer.trim(),
 isCorrect: true,
 },
 ];
 }

 return [];
}

function shuffleOnce(arr) {
 const a = [...arr];
 for (let i = a.length - 1; i > 0; i--) {
 const j = Math.floor(Math.random() * (i + 1));
 [a[i], a[j]] = [a[j], a[i]];
 }
 return a;
}

function splitText(questionText) {
 const text = questionText || "";
 const parts = text.split("____");
 const blankCount = Math.max(0, parts.length - 1);
 return { parts, blankCount };
}

function parseLegacyUserAnswer(userAnswer, pool, blankCount) {
 if (!userAnswer || !blankCount) return Array(blankCount).fill(null);

 const chunks = String(userAnswer).split(" ||| ");
 if (chunks.length === blankCount) {
 return chunks.map((chunk) => {
 const idx = pool.findIndex((p) => p.text === chunk.trim());
 return idx >= 0 ? idx : null;
 });
 }

 const idx = pool.findIndex((p) => p.text === String(userAnswer).trim());
 if (idx >= 0) {
 const arr = Array(blankCount).fill(null);
 arr[0] = idx;
 return arr;
 }

 return Array(blankCount).fill(null);
}

function blanksToFormValue(blanks, pool) {
 const texts = blanks.map((idx) =>
 idx != null && pool[idx] ? pool[idx].text : "",
 );
 if (texts.length <= 1) return texts[0] || "";
 if (texts.some((t) => !t)) return "";
 return texts.join(" ||| ");
}

export default function FillBlankQuizRenderer({
 question,
 register,
 setValue,
 isSubmitted,
 userAnswer,
 mode,
}) {
 const { parts, blankCount } = useMemo(
 () => splitText(question.questionText),
 [question.questionText],
 );

 const pool = useMemo(() => {
 const built = buildAnswerPool(question);
 return shuffleOnce(built);
 }, [question]);

 const [blanks, setBlanks] = useState(() =>
 parseLegacyUserAnswer(userAnswer, pool, blankCount),
 );
 const [activeBlank, setActiveBlank] = useState(null);
 const [dragPoolIdx, setDragPoolIdx] = useState(null);

 useEffect(() => {
 setBlanks((prev) => {
 if (prev.length === blankCount) return prev;
 const next = Array(blankCount).fill(null);
 for (let i = 0; i < Math.min(prev.length, blankCount); i++)
 next[i] = prev[i];
 return next;
 });
 }, [blankCount]);

 const usedPoolIndices = useMemo(() => {
 const set = new Set();
 blanks.forEach((idx) => {
 if (idx != null) set.add(idx);
 });
 return set;
 }, [blanks]);

 const syncForm = useCallback(
 (nextBlanks) => {
 const value = blanksToFormValue(nextBlanks, pool);
 setValue?.(question._id, value, {
 shouldValidate: true,
 shouldDirty: true,
 });
 },
 [pool, setValue, question._id],
 );

 const placeToken = useCallback(
 (blankIndex, poolIdx) => {
 if (isSubmitted || blankIndex == null || poolIdx == null) return;
 setBlanks((prev) => {
 const next = [...prev];
 const existingBlank = next.findIndex((b) => b === poolIdx);
 if (existingBlank >= 0) next[existingBlank] = null;
 next[blankIndex] = poolIdx;
 syncForm(next);
 return next;
 });
 setActiveBlank(null);
 setDragPoolIdx(null);
 },
 [isSubmitted, syncForm],
 );

 const clearBlank = useCallback(
 (blankIndex) => {
 if (isSubmitted) return;
 setBlanks((prev) => {
 const next = [...prev];
 next[blankIndex] = null;
 syncForm(next);
 return next;
 });
 setActiveBlank(null);
 },
 [isSubmitted, syncForm],
 );

 const handleTokenActivate = useCallback(
 (poolIdx) => {
 if (isSubmitted || usedPoolIndices.has(poolIdx)) return;

 if (activeBlank != null) {
 placeToken(activeBlank, poolIdx);
 return;
 }

 const firstEmpty = blanks.findIndex((b) => b == null);
 if (firstEmpty >= 0) placeToken(firstEmpty, poolIdx);
 },
 [isSubmitted, usedPoolIndices, activeBlank, blanks, placeToken],
 );

 // ─── REVIEW MODE ─────────────────────────────────────────────
 if (mode === "review") {
 const isCorrect =
 question.isCorrect !== undefined ? question.isCorrect : true;
 const reviewBlanks = parseLegacyUserAnswer(userAnswer, pool, blankCount);
 const correctPool = buildAnswerPool(question);
 const correctTexts = correctPool
 .filter((a) => a.isCorrect || correctPool.length === 1)
 .map((a) => a.text);
 if (correctTexts.length === 0 && question.correctAnswer) {
 correctTexts.push(question.correctAnswer.trim());
 }

 const studentTexts = reviewBlanks.map((idx) =>
 idx != null && pool[idx] ? pool[idx].text : null,
 );

 if (studentTexts.every((t) => t == null) && userAnswer) {
 const chunks = String(userAnswer).split(" ||| ");
 chunks.forEach((c, i) => {
 if (i < studentTexts.length) studentTexts[i] = c.trim();
 });
 if (studentTexts.length === 0)
 studentTexts.push(String(userAnswer).trim());
 }

 return (
 <div className="space-y-4">
 <div className="text-foreground text-lg leading-relaxed flex flex-wrap items-center gap-1">
 {parts.map((part, i) => (
 <span key={`rp-${i}`} className="contents">
 <MathRenderer text={part} className="inline" />
 {i < blankCount && (
 <span
 className={`inline-flex items-center gap-1.5 mx-1 px-3 py-1 rounded-xl border-2 text-base font-semibold ${
 isCorrect
 ? "border-green-500/30 bg-green-500/10 text-green-600 "
 : "border-red-500/30 bg-red-500/10 text-red-600 "
 }`}
 >
 <MathRenderer text={studentTexts[i] || "—"} />
 {isCorrect ? (
 <span
 className="text-green-600 "
 aria-label="صحيحة"
 >
 <CheckIcon />
 </span>
 ) : (
 <span
 className="text-red-600 "
 aria-label="غير صحيحة"
 >
 <CrossIcon />
 </span>
 )}
 </span>
 )}
 </span>
 ))}
 </div>

 {!isCorrect && (
 <div className="text-sm bg-green-500/10 border border-green-500/20 rounded-2xl p-3 text-green-700 ">
 <span className="font-semibold">الإجابة الصحيحة: </span>
 {correctTexts.length > 1 ? (
 correctTexts.map((t, i) => (
 <span key={i}>
 {i > 0 && " / "}
 <strong>{t}</strong>
 </span>
 ))
 ) : (
 <strong>{correctTexts[0] || question.correctAnswer}</strong>
 )}
 </div>
 )}
 </div>
 );
 }

 // ─── LEGACY FALLBACK: no configured answers → text input ─────
 if (pool.length === 0 || blankCount === 0) {
 return (
 <div className="space-y-3">
 <p className="text-foreground text-lg leading-relaxed">
 {(question.questionText || "").replace(/____/g, "________")}
 </p>
 <input
 type="text"
 defaultValue={userAnswer || ""}
 disabled={isSubmitted}
 placeholder="اكتب إجابتك هنا..."
 {...(register ? register(question._id, { required: true }) : {})}
 className="w-full p-4 border-2 border-foreground/10 bg-background text-foreground rounded-2xl focus:border-primary focus:outline-none text-center text-lg disabled:opacity-60"
 />
 </div>
 );
 }

 // ─── ANSWER MODE: blanks + token pool ────────────────────────
 return (
 <div className="space-y-5" dir="ltr">
 {/* Sentence with blanks */}
 <div className="text-foreground text-lg leading-relaxed flex flex-wrap items-center gap-1">
 {parts.map((part, i) => (
 <span key={`p-${i}`} className="contents">
 <MathRenderer text={part} className="inline" />
 {i < blankCount && (
 <button
 type="button"
 disabled={isSubmitted}
 onClick={() => {
 if (blanks[i] != null) {
 clearBlank(i);
 } else {
 setActiveBlank((prev) => (prev === i ? null : i));
 }
 }}
 onDragOver={(e) => {
 e.preventDefault();
 e.dataTransfer.dropEffect = "move";
 }}
 onDrop={(e) => {
 e.preventDefault();
 const idx = Number(e.dataTransfer.getData("text/plain"));
 if (!Number.isNaN(idx)) placeToken(i, idx);
 }}
 className={`inline-flex items-center justify-center min-w-[5.5rem] mx-0.5 px-3 py-1.5 rounded-xl border-2 border-dashed text-base font-semibold transition-all focus:outline-none ${
 blanks[i] != null
 ? "border-primary bg-primary/10 text-primary border-solid cursor-pointer"
 : activeBlank === i
 ? "border-primary bg-primary/20 text-primary"
 : "border-foreground/20 bg-foreground/[0.02] text-foreground/40 hover:border-primary/40"
 } disabled:opacity-60 disabled:cursor-not-allowed`}
 >
 {blanks[i] != null ? <MathRenderer text={pool[blanks[i]]?.text} /> : "____"}
 </button>
 )}
 </span>
 ))}
 </div>

 {/* Token pool */}
 <div>
 <p className="text-xs text-foreground/50 mb-2">
 {activeBlank != null
 ? `اختار إجابة للفراغ رقم ${activeBlank + 1}`
 : "اسحب إجابة أو اضغط عليها لملء الفراغ"}
 </p>
 <div className="flex flex-wrap gap-2">
 {pool.map((token, poolIdx) => {
 const used = usedPoolIndices.has(poolIdx);
 return (
 <button
 key={token.id}
 type="button"
 disabled={isSubmitted || used}
 draggable={!isSubmitted && !used}
 onDragStart={(e) => {
 e.dataTransfer.setData("text/plain", String(poolIdx));
 e.dataTransfer.effectAllowed = "move";
 setDragPoolIdx(poolIdx);
 }}
 onDragEnd={() => setDragPoolIdx(null)}
 onClick={() => handleTokenActivate(poolIdx)}
 className={`px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-all select-none focus:outline-none ${
 used
 ? "border-foreground/5 bg-foreground/[0.02] text-foreground/20 cursor-default line-through"
 : dragPoolIdx === poolIdx
 ? "border-primary bg-primary/20 text-primary opacity-60"
 : "border-foreground/10 bg-background text-foreground hover:border-primary/40 hover:bg-foreground/[0.03] cursor-grab active:cursor-grabbing shadow-sm"
 } disabled:opacity-50`}
 >
 <MathRenderer text={token.text} />
 </button>
 );
 })}
 </div>
 </div>

 <input
 type="hidden"
 {...(register ? register(question._id, { required: true }) : {})}
 />
 </div>
 );
}
