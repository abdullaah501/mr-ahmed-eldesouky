"use client";
import { useForm } from "react-hook-form";
import FloatingInput from "../FloatingInput";
import { api } from "../../../../lib/axios/axios";
import toast from "react-hot-toast";

export default function ForgetPasswordForm({ nextStep, setEmail }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid, isDirty },
  } = useForm({ mode: "onChange" });

  const onSubmit = async (data) => {
    try {
      await api.post("/api/auth/send-code", {
        email: data.email,
      });

      setEmail(data.email);
      nextStep();
    } catch (err) {
      console.log("Failed to send Code.", err);
      toast.error(
        err.response?.data?.message ||
          err.response?.statusText ||
          err.message ||
          "حدث خطأ ما. حاول مرة أخرى.",
      );
    }
  };

  return (
    <div className="flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
        <h1 className="text-xl font-extrabold text-brand-navy mb-2">
          نسيت كلمة السر؟
        </h1>
        <p className="text-sm text-text-muted mb-6 leading-relaxed">
          ولا يهمك! اكتب بريدك الإلكتروني وهنبعتلك كود تحقق عشان تعيد تعيين
          كلمة السر.
        </p>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4 max-w-sm w-full"
        >
          <div className="mb-6">
            <FloatingInput
              type="email"
              register={register("email", {
                required: "البريد الإلكتروني مطلوب",
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: "صيغة البريد الإلكتروني غير صحيحة",
                },
              })}
              label="البريد الإلكتروني"
            />
            {errors.email && (
              <p className="text-red-500 text-sm">{errors.email.message}</p>
            )}
          </div>
          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand-navy px-6 py-3.5 text-sm font-extrabold text-white shadow-sm hover:bg-(--brand-navy-hover) active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSubmitting || !isValid || !isDirty}
          >
            {isSubmitting ? "جاري الإرسال..." : "ابعت كود التحقق"}
          </button>
        </form>
      </div>
    </div>
  );
}
