"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { api } from "../../../../lib/axios/axios";
import { FiSend, FiUsers, FiUser, FiBell } from "react-icons/fi";
import StudentSearchSelect from "./StudentSearchSelect";
import MathToolbar from "../math/MathToolbar";
import MathRenderer from "../math/MathRenderer";
import { useRef } from "react";

export const TYPE_OPTIONS = [
  { value: "announcement", label: "إعلان" },
  { value: "schedule_change", label: "تغيير في المواعيد" },
  { value: "attendance", label: "تحديث الحضور" },
];

export default function NotificationsSection() {
  const queryClient = useQueryClient();
  const [audienceType, setAudienceType] = useState("grade");
  const [gradeId, setGradeId] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [type, setType] = useState("announcement");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const titleRef = useRef(null);
  const bodyRef = useRef(null);

  const gradesQuery = useQuery({
    queryKey: ["activeGrades"],
    queryFn: async () => {
      const res = await api.get("/api/grades");
      if (!res?.data?.success)
        throw new Error(res?.data?.message || "Failed to load grades");
      return res.data.data;
    },
    refetchOnWindowFocus: false,
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const payload =
        audienceType === "grade"
          ? { audienceType, gradeId }
          : { audienceType: "user", studentId: selectedStudent?._id || "" };
      payload.type = type;
      payload.title = title.trim();
      if (body.trim()) payload.body = body.trim();
      if (link.trim()) payload.link = link.trim();
      let res;
      try {
        res = await api.post("/api/notifications", payload);
      } catch (err) {
        throw new Error(
          err?.response?.data?.message || "Failed to send notification",
        );
      }
      if (!res?.data?.success)
        throw new Error(res?.data?.message || "Failed to send notification");
      return res.data.data;
    },
    onSuccess: (data) => {
      toast.success(
        data?.inserted != null
          ? `تم الإرسال لـ ${data.inserted} طالب`
          : "تم إرسال الإشعار",
      );
      setTitle("");
      setBody("");
      setLink("");
      setSelectedStudent(null);
      queryClient.invalidateQueries({ queryKey: ["adminNotifications"] });
    },
    onError: (err) => toast.error(err?.message),
  });

  const inputCls =
    "w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm placeholder:text-text-muted focus:border-brand-navy focus:ring-4 focus:ring-ring focus:outline-none";

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-brand-navy to-brand-teal opacity-90" />
      <div className="mb-4 flex items-center gap-3 pt-1">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-navy text-white">
          <FiBell size={16} />
        </span>
        <div>
          <h3 className="text-sm font-extrabold text-text-primary">
            إرسال إشعار جديد
          </h3>
          <p className="text-xs font-medium text-text-muted">
            اختار المستلمين واكتب محتوى الإشعار
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <label
          className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold ${audienceType === "grade" ? "border-brand-navy bg-brand-navy-soft text-brand-navy" : "border-border bg-card text-text-muted"}`}
        >
          <input
            type="radio"
            checked={audienceType === "grade"}
            onChange={() => setAudienceType("grade")}
            className="text-brand-navy focus:ring-brand-navy"
          />
          <FiUsers size={14} /> صف كامل
        </label>
        <label
          className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold ${audienceType === "user" ? "border-brand-navy bg-brand-navy-soft text-brand-navy" : "border-border bg-card text-text-muted"}`}
        >
          <input
            type="radio"
            checked={audienceType === "user"}
            onChange={() => setAudienceType("user")}
            className="text-brand-navy focus:ring-brand-navy"
          />
          <FiUser size={14} /> طالب معين
        </label>
      </div>

      <div className="mt-4">
        {audienceType === "grade" ? (
          <select
            value={gradeId}
            onChange={(e) => setGradeId(e.target.value)}
            className={inputCls}
          >
            <option value="">اختار الصف</option>
            {(gradesQuery.data || []).map((g) => (
              <option key={g._id} value={g._id}>
                {g.name}
              </option>
            ))}
          </select>
        ) : (
          <StudentSearchSelect
            value={selectedStudent}
            onChange={setSelectedStudent}
          />
        )}
      </div>

      <div className="mt-4">
        <label className="mb-1.5 block text-xs font-extrabold text-text-primary">
          النوع
        </label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className={inputCls}
        >
          {TYPE_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4">
        <label className="mb-1.5 block text-xs font-extrabold text-text-primary">
          عنوان الإشعار <span className="text-xs font-normal text-gray-500">(يدعم المعادلات)</span>
        </label>
        <MathToolbar inputRef={titleRef} targetValue={title} onChange={setTitle} />
        <input
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="عنوان الإشعار — مثال: حل $\frac{1}{2}$"
          maxLength={120}
          className={`${inputCls} mt-2`}
        />
        {title && (
          <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded text-sm">
            <MathRenderer text={title} />
          </div>
        )}
      </div>
      <div className="mt-3">
        <label className="mb-1.5 block text-xs font-extrabold text-text-primary">
          الرسالة (اختياري) <span className="text-xs font-normal text-gray-500">(يدعم المعادلات)</span>
        </label>
        <MathToolbar inputRef={bodyRef} targetValue={body} onChange={setBody} />
        <textarea
          ref={bodyRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="الرسالة (اختياري) — مثال: $\sqrt{16}=4$"
          rows={3}
          maxLength={500}
          className={`${inputCls} mt-2`}
        />
        {body && (
          <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded text-sm">
            <MathRenderer text={body} />
          </div>
        )}
      </div>
      <div className="mt-3">
        <label className="mb-1.5 block text-xs font-extrabold text-text-primary">
          لينك داخلي اختياري
        </label>
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="لينك داخلي اختياري (/userDashboard)"
          dir="ltr"
          maxLength={300}
          className={`${inputCls} font-mono text-left`}
          style={{ direction: "ltr" }}
        />
      </div>

      <button
        type="button"
        onClick={() => sendMutation.mutate()}
        disabled={
          sendMutation.isPending ||
          title.trim().length < 2 ||
          (audienceType === "grade" ? !gradeId : !selectedStudent?._id)
        }
        className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-brand-navy px-5 py-2.5 text-sm font-bold text-white hover:bg-(--brand-navy-hover) disabled:opacity-40"
      >
        <FiSend size={14} /> {sendMutation.isPending ? "جاري الإرسال..." : "إرسال"}
      </button>
    </div>
  );
}
