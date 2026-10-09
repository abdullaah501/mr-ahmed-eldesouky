"use client";

import { useState } from "react";
import Image from "next/image";
import Modal from "@/app/components/modal/Modal";
import { getImageSrc } from "@/app/components/ImagePreview";

function OptionImage({ cloudId, alt, className = "" }) {
 if (!cloudId) {
 return (
 <div className={`bg-foreground/5 flex items-center justify-center text-foreground/40 text-xs ${className}`}>
 لا توجد صورة
 </div>
 );
 }
 const src = getImageSrc({ cloudId });
 return (
 <Image
 src={src}
 alt={alt || "اختيار"}
 width={400}
 height={400}
 quality={70}
 sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
 className={`w-full h-full object-contain ${className}`}
 />
 );
}

function CheckIcon() {
 return (
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
 </svg>
 );
}

function CrossIcon() {
 return (
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
 </svg>
 );
}

export default function ImageChoiceQuizRenderer({ question, register, isSubmitted, userAnswer, mode }) {
 const [zoomSrc, setZoomSrc] = useState(null);
 const [zoomAlt, setZoomAlt] = useState("");

 function openZoom(cloudId, alt) {
 if (!cloudId) return;
 setZoomSrc(cloudId);
 setZoomAlt(alt || "معاينة الصورة");
 }

 const zoomModal = (
 <Modal isOpen={!!zoomSrc} onClose={() => setZoomSrc(null)} title={zoomAlt}>
 {zoomSrc && (
 <div className="relative w-full aspect-square max-h-[70vh]">
 <Image
 src={getImageSrc({ cloudId: zoomSrc })}
 alt={zoomAlt}
 fill
 sizes="(max-width: 640px) 90vw, 512px"
 quality={85}
 className="object-contain"
 />
 </div>
 )}
 </Modal>
 );

 if (mode === "review") {
 const isCorrect = question.isCorrect !== undefined ? question.isCorrect : true;
 return (
 <>
 <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
 {(question.options || []).map((opt) => {
 const isUser = userAnswer === opt.valueText;
 const isRight = question.correctAnswer === opt.valueText;
 let borderClass = "border-foreground/10 bg-background";
 if (isRight) borderClass = "border-green-500/40 bg-green-500/10";
 else if (isUser && !isCorrect) borderClass = "border-red-500/40 bg-red-500/10";

 return (
 <div
 key={opt.valueText}
 className={`border-2 rounded-2xl overflow-hidden ${borderClass}`}
 >
 <button
 type="button"
 onClick={() => openZoom(opt.image?.cloudId, opt.optionText)}
 className="w-full aspect-square bg-foreground/5 cursor-zoom-in focus:outline-none"
 >
 <OptionImage cloudId={opt.image?.cloudId} alt={opt.optionText} />
 </button>
 <div className="p-3 space-y-1 text-center">
 {opt.optionText && (
 <p className="text-sm font-medium text-foreground">{opt.optionText}</p>
 )}
 {isRight && (
 <span className="inline-flex items-center gap-1 text-xs font-bold text-green-600 ">
 <CheckIcon /> الإجابة الصحيحة
 </span>
 )}
 {isUser && !isRight && (
 <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 ">
 <CrossIcon /> إجابتك
 </span>
 )}
 {isUser && isRight && (
 <span className="inline-flex items-center gap-1 text-xs font-bold text-green-600 ">
 <CheckIcon /> إجابتك
 </span>
 )}
 </div>
 </div>
 );
 })}
 </div>
 {zoomModal}
 </>
 );
 }

 return (
 <>
 <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
 {(question.options || []).map((opt) => (
 <div key={opt.valueText} className="relative">
 <label className="cursor-pointer block">
 <input
 type="radio"
 value={opt.valueText}
 {...(register ? register(question._id, { required: true }) : {})}
 disabled={isSubmitted}
 className="sr-only peer"
 />
 <div
 className="border-2 rounded-2xl overflow-hidden transition-all duration-200
 border-foreground/10 bg-background hover:shadow-md
 peer-checked:border-primary peer-checked:bg-primary/5 peer-checked:shadow-sm
 peer-disabled:opacity-60"
 >
 <div className="aspect-square bg-foreground/5 relative">
 <OptionImage cloudId={opt.image?.cloudId} alt={opt.optionText} />
 </div>
 {opt.optionText && (
 <p className="text-center text-sm p-3 font-medium text-foreground">{opt.optionText}</p>
 )}
 </div>
 </label>
 {opt.image?.cloudId && (
 <button
 type="button"
 onClick={(e) => {
 e.preventDefault();
 e.stopPropagation();
 openZoom(opt.image.cloudId, opt.optionText);
 }}
 className="absolute top-2 left-2 z-10 bg-background/80 hover:bg-background text-foreground rounded-full p-1.5 shadow-sm cursor-zoom-in focus:outline-none"
 aria-label={`تكبير الصورة ${opt.optionText || "اختيار"}`}
 title="تكبير"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
 </svg>
 </button>
 )}
 </div>
 ))}
 </div>
 {zoomModal}
 </>
 );
}
