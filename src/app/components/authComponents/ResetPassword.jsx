"use client";
import { useForm } from "react-hook-form";
import { useState } from "react";
import FloatingInput from "../FloatingInput";
import { api } from "../../../../lib/axios/axios";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

export default function ResetPassword({ resetToken }) {
  const [message, setMessage] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting, isDirty, isValid },
    reset,
  } = useForm();

  const router = useRouter();

  const onSubmit = async (data) => {
    try {
      const response = await api.post("/api/auth/reset-password", {
        resetToken,
        password: data.password,
        confirmPassword: data.confirmPassword,
      });

      toast.success("تم تحديث كلمة السر بنجاح!");

      router.replace("/login"); // or router.push("/login")
    } catch (err) {
      console.error("Reset failed", err);

      toast.error(
        err.response?.data?.message ||
          err.message ||
          "حدث خطأ ما. حاول مرة أخرى.",
      );
    }
  };

  const password = watch("password");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="max-w-md">
        <div className="w-full text-center space-y-4 mb-6">
          <h1 className="text-3xl font-bold text-primary">
            إعادة تعيين كلمة السر
          </h1>
          <p className="text-gray-600 leading-relaxed">
            من فضلك اكتب كلمة السر الجديدة وأكّدها عشان تحدّث حسابك.
          </p>
        </div>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-8 mx-auto rounded-xl max-w-md"
        >
          <FloatingInput
            type="password"
            label="كلمة السر الجديدة"
            register={register("password", {
              required: "من فضلك اكتب كلمة السر الجديدة",
              minLength: {
                value: 6,
                message: "كلمة السر ٦ حروف على الأقل",
              },
            })}
          />
          {errors.password && (
            <p className="text-red-500 text-sm">{errors.password.message}</p>
          )}

          <FloatingInput
            type="password"
            label="تأكيد كلمة السر"
            register={register("confirmPassword", {
              required: "من فضلك أكّد كلمة السر",
              validate: (value) =>
                value === password || "كلمتا السر غير متطابقتين",
            })}
          />
          {errors.confirmPassword && (
            <p className="text-red-500 text-sm">
              {errors.confirmPassword.message}
            </p>
          )}

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-base border-2 border-primary bg-primary text-white hover:bg-transparent hover:text-primary transition-all duration-300 active:scale-95 shadow-md disabled:opacity-50 disabled:hover:bg-primary disabled:hover:text-white disabled:cursor-not-allowed"
            disabled={isSubmitting || !isValid || !isDirty}
          >
            {isSubmitting ? "جاري تحديث كلمة السر..." : "تحديث كلمة السر"}
          </button>

          {message && (
            <p className="text-center mt-4 text-sm font-semibold text-green-600">
              {message}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
