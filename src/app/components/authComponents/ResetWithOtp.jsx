"use client";
import { useForm } from "react-hook-form";
import FloatingInput from "../FloatingInput";
import { api } from "../../../../lib/axios/axios";
import toast from "react-hot-toast";

export default function ResetWithOtp({ email, nextStep, setResetToken }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty, isValid },
    reset,
  } = useForm();

  const onSubmit = async (data) => {
    try {
      const res = await api.post("/api/auth/verify-code", {
        email,
        otp: data.otp,
      });
      setResetToken(res.data.resetToken);
      nextStep();
    } catch (err) {
      console.log("Failed to verify code.", err);
      toast.error(
        err.response?.data?.message ||
          err.message ||
          "حدث خطأ ما. حاول مرة أخرى."
      );
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="max-w-md">
        <div className="w-full text-center space-y-4 mb-8">
          <h1 className="text-3xl font-bold text-primary">
            تحقق من الكود
          </h1>
          <p className="text-gray-600 leading-relaxed">
            اكتب كود التحقق المكون من ٦ أرقام اللي اتبعت على بريدك الإلكتروني.
            بعد التحقق هتقدر تعيّن كلمة سر جديدة لحسابك.
          </p>
        </div>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4 mx-auto rounded-xl"
        >
          <div>
            <FloatingInput
              type="text"
              inputMode="numeric"
              label={"كود التحقق"}
              oninput={(e) => {
                e.target.value = e.target.value.replace(/\D/g, "");
              }}
              register={register("otp", {
                required: "من فضلك اكتب كود التحقق",
                pattern: {
                  value: /^[0-9]{6}$/,
                  message:
                    "كود التحقق لازم يكون ٦ أرقام فقط",
                },
              })}
            />

            {errors.otp && (
              <p className="text-red-500 text-sm">{errors.otp.message}</p>
            )}
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-base border-2 border-primary bg-primary text-white hover:bg-transparent hover:text-primary transition-all duration-300 active:scale-95 shadow-md disabled:opacity-50 disabled:hover:bg-primary disabled:hover:text-white disabled:cursor-not-allowed"
            disabled={isSubmitting || !isValid || !isDirty}
          >
            {isSubmitting ? "جاري التحقق..." : "تحقق من الكود"}
          </button>
        </form>
      </div>
    </div>
  );
}
