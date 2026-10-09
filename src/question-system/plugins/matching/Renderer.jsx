"use client";

import { useState, useMemo, useCallback } from "react";
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

function fisherYatesShuffle(arr) {
 const copy = [...arr];
 for (let i = copy.length - 1; i > 0; i--) {
 const j = Math.floor(Math.random() * (i + 1));
 [copy[i], copy[j]] = [copy[j], copy[i]];
 }
 return copy;
}

function reconstructSelection(userAnswer, pairs) {
 if (!userAnswer || !pairs?.length) return {};

 try {
 const parsed = JSON.parse(userAnswer);
 if (!parsed) return {};

 if (!Array.isArray(parsed) && typeof parsed === "object") {
 return parsed;
 }

 if (Array.isArray(parsed)) {
 const map = {};
 const byLeft = new Map(pairs.map((p) => [p.leftItem, p.id]));

 for (const entry of parsed) {
 if (!Array.isArray(entry) || entry.length < 2) continue;
 const [left, right] = entry;
 const id = byLeft.get(left);
 if (id != null) map[id] = right || "";
 }
 return map;
 }
 } catch (_) {}

 return {};
}

export default function MatchingQuizRenderer({
 question,
 register,
 setValue,
 isSubmitted,
 userAnswer,
 mode,
}) {
 const pairs = question.config?.pairs || [];

 const [selected, setSelected] = useState(() =>
 reconstructSelection(userAnswer, pairs),
 );

 const shuffledPool = useMemo(() => fisherYatesShuffle(pairs), [question._id]);

 const usedSet = useMemo(() => {
 const set = new Set();
 Object.values(selected).forEach((v) => {
 if (v) set.add(v);
 });
 return set;
 }, [selected]);

 const availableByRow = useMemo(() => {
 return pairs.map((pair) => {
 const current = selected[pair.id] || "";
 const options = shuffledPool.filter(
 (other) => other.rightItem === current || !usedSet.has(other.rightItem),
 );
 const seen = new Set();
 const unique = [];
 for (const o of options) {
 if (!seen.has(o.rightItem)) {
 seen.add(o.rightItem);
 unique.push(o);
 }
 }
 return { pair, options: unique };
 });
 }, [pairs, selected, usedSet, shuffledPool]);

 const emitValue = useCallback(
 (next) => {
 const arr = pairs.map((pp) => [pp.leftItem, next[pp.id] || ""]);
 setValue?.(question._id, JSON.stringify(arr), {
 shouldValidate: true,
 shouldDirty: true,
 });
 },
 [pairs, setValue, question._id],
 );

 if (mode === "review") {
 const reviewMap = reconstructSelection(userAnswer, pairs);

 return (
 <div className="space-y-2 overflow-x-auto">
 <table className="w-full text-sm border-collapse">
 <thead>
 <tr className="bg-foreground/[0.03] border-b border-foreground/10 text-foreground/70">
 <th className="p-3 text-right font-semibold">العنصر</th>
 <th className="p-3 text-right font-semibold">الإجابة الصحيحة</th>
 <th className="p-3 text-right font-semibold">إجابتك</th>
 <th className="p-3 text-center font-semibold w-16">النتيجة</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-foreground/5">
 {pairs.map((p) => {
 const userPair = reviewMap[p.id] || "—";
 const isCorrectPair = userPair === p.rightItem;
 return (
 <tr
 key={p.id}
 className={
 isCorrectPair ? "bg-green-500/10" : "bg-red-500/10"
 }
 >
 <td className="p-3 font-medium text-foreground">
 <MathRenderer text={p.leftItem} />
 </td>
 <td className="p-3 text-green-600 font-medium">
 <MathRenderer text={p.rightItem} />
 </td>
 <td
 className={`p-3 font-medium ${
 isCorrectPair
 ? "text-green-600 "
 : "text-red-600 "
 }`}
 >
 <MathRenderer text={userPair} />
 </td>
 <td className="p-3 text-center">
 {isCorrectPair ? (
 <span
 className="inline-flex items-center justify-center text-green-600 "
 aria-label="صحيحة"
 >
 <CheckIcon />
 </span>
 ) : (
 <span
 className="inline-flex items-center justify-center text-red-600 "
 aria-label="غير صحيحة"
 >
 <CrossIcon />
 </span>
 )}
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 );
 }

 return (
 <div className="space-y-3">
 <p className="text-xs text-foreground/50">
 اختار المقابل المناسب لكل عنصر:
 </p>
 {availableByRow.map(({ pair: p, options }) => {
 const hasValue = !!selected[p.id];
 return (
 <div
 key={p.id}
 className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 border-2 rounded-2xl transition-all ${
 hasValue
 ? "border-primary/40 bg-primary/5"
 : "border-foreground/10 bg-background"
 }`}
 >
 <span className="font-medium text-foreground min-w-[120px] text-sm sm:text-base">
 <MathRenderer text={p.leftItem} />
 </span>
 <span
 className="text-foreground/30 hidden sm:inline"
 aria-hidden="true"
 >
 ←
 </span>
 <select
 value={selected[p.id] || ""}
 onChange={(e) => {
 const next = { ...selected, [p.id]: e.target.value };
 setSelected(next);
 emitValue(next);
 }}
 disabled={isSubmitted}
 className="flex-1 p-2.5 border border-foreground/10 rounded-xl bg-background text-foreground text-sm focus:outline-none focus:border-primary disabled:opacity-60"
 >
 <option value="">اختار...</option>
 {options.map((pp) => (
 <option
 key={pp.id}
 value={pp.rightItem}
 className="bg-background text-foreground"
 >
 {pp.rightItem}
 </option>
 ))}
 </select>
 {hasValue && (
 <span className="text-xs text-primary font-semibold flex-shrink-0">
 تم التوصيل
 </span>
 )}
 </div>
 );
 })}
 <input
 type="hidden"
 {...(register ? register(question._id, { required: true }) : {})}
 />
 </div>
 );
}
