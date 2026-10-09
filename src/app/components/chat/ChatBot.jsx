"use client";

import { RxCross2 } from "react-icons/rx";
import { BsRobot } from "react-icons/bs";
import { useState, useEffect, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import Link from "next/link";

export default function ChatBot() {
 const { register, handleSubmit, reset } = useForm();
 const chatContainerRef = useRef(null);
 const modalRef = useRef(null);

 const [chat, setChat] = useState([]);
 const [isOpen, setIsOpen] = useState(false);
 const [loading, setLoading] = useState(false);
 const [isAccessible, setIsAccessible] = useState(true);

 // Scroll to bottom on new message
 useEffect(() => {
 scrollToBottom();
 }, [chat, loading]);

 const scrollToBottom = () => {
 if (chatContainerRef.current) {
 chatContainerRef.current.scrollTop =
 chatContainerRef.current.scrollHeight;
 }
 };

 const onSubmit = async ({ message }) => {
 const isBot = /bot|crawl|spider/i.test(navigator.userAgent);

 if (isBot) {
 return toast.error("غير مسموح للبوت بالتعليق.");
 }

 if (!message.trim()) return;

 const userMsg = { role: "user", content: message };
 setChat((prev) => [...prev, userMsg]);
 setLoading(true);

 try {
 const res = await fetch("/api/ai/chat-bot", {
 method: "POST",
 headers: {
 "Content-Type": "application/json",
 },
 body: JSON.stringify({ message }),
 });

 if (!res.ok) {
 if (res.status === 429) {
 toast.error("تم تجاوز الحد. حاول غداً.");
 setIsAccessible(false);
 setLoading(false);

 return;
 }
 throw new Error("فشل جلب الرد");
 }

 const data = await res.json();

 if (data.reply) {
 setChat((prev) => [
 ...prev,
 { role: "assistant", content: data.reply },
 ]);
 }

 reset();
 } catch (err) {
 console.error(err);
 toast.error("حدث خطأ أثناء جلب الرد.");
 } finally {
 setLoading(false);
 }
 };

 const getDirectionByString = useCallback((text) => {
 const arabicCharsRegex = /[\u0600-\u06FF]/;
 return arabicCharsRegex.test(text) ? "ltr" : "ltr";
 }, []);

 const parseMessageForUrls = useCallback((text) => {
 const urlRegex = /(https?:\/\/[^\s]+)/g;
 const parts = text.split(urlRegex);

 const formatUrlText = (url) => {
 if (url.length > 45) {
 return url.slice(0, 30) + "..." + url.slice(-12);
 }
 return url;
 };

 return parts.map((part, index) =>
 urlRegex.test(part) ? (
 <Link
 key={index}
 href={part}
 target="_blank"
 rel="noopener noreferrer"
 className="inline-flex items-center gap-1 px-2.5 py-0.5 my-0.5 rounded bg-blue-100 text-primary hover:bg-blue-200 transition max-w-full break-all text-xs"
 title={part}
 >
 <span className="break-all">{formatUrlText(part)}</span>
 <svg
 xmlns="http://www.w3.org/2000/svg"
 width="12"
 height="12"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="2"
 strokeLinecap="round"
 strokeLinejoin="round"
 className="flex-shrink-0"
 >
 <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
 <polyline points="15 3 21 3 21 9"></polyline>
 <line x1="10" y1="14" x2="21" y2="3"></line>
 </svg>
 </Link>
 ) : (
 part
 ),
 );
 }, []);

 // ESC key to close modal
 useEffect(() => {
 const handleKeyDown = (e) => {
 if (e.key === "Escape") setIsOpen(false);
 };
 window.addEventListener("keydown", handleKeyDown);
 return () => window.removeEventListener("keydown", handleKeyDown);
 }, [setIsOpen]); // 👈 this is the issue

 // Click outside to close
 const handleClickOutside = (e) => {
 if (modalRef.current && !modalRef.current.contains(e.target)) {
 setIsOpen(false);
 }
 };

 return (
 <>
 {/* Chat toggle button */}
 {!isOpen && (
 <button
 onClick={() => setIsOpen(true)}
 className="fixed bottom-6 right-6 z-40 bg-primary text-white p-4.5 rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer flex items-center justify-center border border-white/20"
 >
 <BsRobot size={26} />
 </button>
 )}

 {/* Modal */}
 {isOpen && (
 <div className="fixed inset-0 z-50">
 <div
 className="relative inset-0 h-full flex items-end justify-start p-6 md:p-8"
 onClick={handleClickOutside}
 >
 <main
 ref={modalRef}
 className="w-full max-w-md bg-card border border-border/80 p-5 rounded-2xl shadow-2xl animate-fadeIn flex flex-col gap-4 max-h-[500px]"
 onClick={(e) => e.stopPropagation()}
 >
 {/* Header */}
 <div className="w-full flex justify-between items-center pb-3 border-b border-border">
 <h1 className="text-lg flex items-center gap-2 font-bold text-primary">
 <BsRobot size="23" className="text-primary animate-pulse" />
 مساعد الكيمياء الذكي
 </h1>
 <button
 className="cursor-pointer p-1.5 hover:bg-secondary rounded-lg transition-colors text-text-muted hover:text-text-primary"
 onClick={() => setIsOpen(false)}
 >
 <RxCross2 size={20} />
 </button>
 </div>

 {/* Chat Window */}
 <div
 ref={chatContainerRef}
 className="flex-1 overflow-y-auto p-4 rounded-xl bg-secondary/35 border border-border/40 text-sm scrollbar-thin flex flex-col gap-3 min-h-[300px]"
 style={{ scrollBehavior: "smooth" }}
 >
 {chat?.length > 0 ? (
 chat.map((msg, i) => {
 const isUser = msg.role === "user";
 const msgDir = getDirectionByString(msg.content);
 return (
 <div
 key={i}
 className={`flex flex-col max-w-[85%] ${
 isUser ? "self-start" : "self-end"
 }`}
 dir={msgDir}
 >
 <div
 className={`px-4 py-3 rounded-2xl shadow-sm text-sm leading-relaxed break-words overflow-hidden ${
 isUser
 ? "bg-primary text-white rounded-tr-none"
 : "bg-primary-purple/10 border border-primary-purple/20 text-text-primary rounded-tl-none"
 }`}
 >
 {parseMessageForUrls(msg.content)}
 </div>
 <span className="text-[10px] text-text-muted mt-1 px-1">
 {isUser ? "أنت" : "المساعد الذكي"}
 </span>
 </div>
 );
 })
 ) : (
 <div className="text-text-muted italic text-center my-auto flex flex-col items-center gap-2">
 <BsRobot size="32" className="opacity-40 text-primary" />
 <span>أهلاً بيك! إزاي أقدر أساعدك في الكيمياء؟</span>
 </div>
 )}
 {loading && (
 <div className="flex items-center gap-2 text-text-muted italic self-end bg-primary-purple/10 border border-primary-purple/20 px-4 py-2.5 rounded-2xl rounded-tl-none animate-pulse">
 <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"></span>
 <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce delay-100"></span>
 <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce delay-200"></span>
 </div>
 )}
 </div>

 {/* Input Form */}
 <form onSubmit={handleSubmit(onSubmit)} className="flex gap-2">
 <input
 type="text"
 placeholder="اسأل أي حاجة..."
 {...register("message")}
 className="flex-1 border border-border/80 px-4 py-2.5 rounded-xl text-foreground bg-background outline-none focus:border-primary transition-colors text-sm"
 />
 <button
 type="submit"
 disabled={!isAccessible || loading}
 className="bg-primary text-white py-2.5 px-5 cursor-pointer rounded-xl font-bold hover:opacity-95 active:scale-95 transition-all disabled:cursor-not-allowed disabled:opacity-50 text-sm"
 >
 إرسال
 </button>
 </form>
 </main>
 </div>
 </div>
 )}
 </>
 );
}
