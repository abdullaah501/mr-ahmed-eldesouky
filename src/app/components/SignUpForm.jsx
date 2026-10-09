"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { LiaUserEditSolid } from "react-icons/lia";
import { LuCheck } from "react-icons/lu";
import { FaPhone, FaArrowLeft, FaArrowRight } from "react-icons/fa";
import { MdAlternateEmail } from "react-icons/md";
import { RiLockPasswordFill } from "react-icons/ri";
import Image from "next/image";
import Link from "next/link";
import validator from "validator";
import { useRouter, useSearchParams } from "next/navigation";
import FloatingInput from "@/app/components/FloatingInput";
import { api } from "../../../lib/axios/axios";
import getFingerprint from "../../../lib/getFingerprint";
import EgyptGovernoratesSelect from "./EgyptGovernoratesSelect";
import GradesSelection from "./GradesSelection";

const STEPS = [
  { label: "الاسم", fields: ["firstName", "lastName"] },
  { label: "أرقام الموبايل", fields: ["phone", "guardianPhone"] },
  { label: "بيانات التواصل", fields: ["governorate", "gradeId", "email"] },
  { label: "كلمة السر", fields: ["password", "confirmPassword"] },
];

export default function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const adminMode = searchParams.get("mode") === "admin";
  const [serverError, setServerError] = useState("");
  const [step, setStep] = useState(0);

  // `?mode=admin` skips the Grade requirement: no selector, no gradeId sent.
  const activeSteps = adminMode
    ? STEPS.map((s, i) =>
        i === 2 ? { ...s, fields: s.fields.filter((f) => f !== "gradeId") } : s,
      )
    : STEPS;

  const {
    register,
    handleSubmit,
    control,
    trigger,
    formState: { errors, isSubmitting },
    reset,
  } = useForm({ defaultValues: { gradeId: "" } });

  const onSubmit = async (data) => {
    const fingerprint = await getFingerprint();
    setServerError("");
    if (data.password !== data.confirmPassword) {
      setServerError("كلمة السر وتأكيدها غير متطابقين");
      return;
    }
    const body = { ...data, fingerprint };
    if (adminMode) delete body.gradeId;
    try {
      await api.post(
        adminMode ? "/api/auth/register?mode=admin" : "/api/auth/register",
        body,
      );
      reset();
      router.push("/userDashboard/overview");
    } catch (err) {
      setServerError(err.response?.data?.message || "فشل إنشاء الحساب");
    }
  };

  const goNext = async () => {
    const valid = await trigger(activeSteps[step].fields);
    if (valid) setStep((s) => s + 1);
  };
  const goBack = () => {
    setServerError("");
    setStep((s) => s - 1);
  };
  const progress = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <div className="flex min-h-[calc(100dvh-68px)] bg-background px-3 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 lg:flex-row lg:gap-4">
        {/* Form */}
        <div className="flex flex-1 items-center justify-center order-2 lg:order-1">
          <div className="w-full max-w-[540px]">
            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
              <div className="mb-4 flex justify-center lg:hidden">
                <Image
                  src="/logo.png"
                  alt="أ. أحمد الدسوقي — مدرس كيمياء"
                  width={36}
                  height={36}
                  className="h-[36px] w-[36px] object-contain"
                />
              </div>
              <div className="mb-4 text-center">
                <h1 className="text-xl font-extrabold text-text-primary sm:text-2xl">
                  اعمل حساب جديد
                </h1>
                <p className="mt-1 text-sm text-text-muted">
                  {activeSteps[step].label} — الخطوة {step + 1} من{" "}
                  {activeSteps.length}
                </p>
              </div>

              {/* Progress */}
              <div className="mb-6">
                <div className="flex items-center justify-center">
                  {activeSteps.map((s, i) => (
                    <div key={i} className="flex items-center">
                      <span
                        className={`grid h-9 w-9 place-items-center rounded-full border-2 text-xs font-black transition-colors ${i < step ? "border-brand-navy bg-brand-navy text-white" : i === step ? "border-brand-navy bg-brand-navy text-white" : "border-border bg-card text-text-muted"}`}
                      >
                        {i < step ? <LuCheck size={14} /> : i + 1}
                      </span>
                      {i < STEPS.length - 1 && (
                        <span
                          className={`h-0.5 w-10 sm:w-14 transition-colors ${i < step ? "bg-brand-navy" : "bg-border"}`}
                        />
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-background">
                    <div
                      className="h-full rounded-full bg-brand-teal transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span
                    dir="ltr"
                    className="w-10 text-right text-xs font-black tabular-nums text-brand-navy"
                  >
                    {progress}%
                  </span>
                </div>
              </div>

              <form
                onSubmit={handleSubmit(onSubmit)}
                className="flex flex-col gap-4"
              >
                {step === 0 && (
                  <>
                    <div>
                      <FloatingInput
                        id="firstName"
                        label="الاسم الأول"
                        icon={<LiaUserEditSolid size={16} />}
                        register={register("firstName", {
                          required: "هذا الحقل مطلوب",
                        })}
                        error={errors.firstName}
                      />
                      {errors.firstName && (
                        <p className="mt-1 text-xs font-semibold text-danger">
                          {errors.firstName.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <FloatingInput
                        id="lastName"
                        label="اسم العائلة"
                        icon={<LiaUserEditSolid size={16} />}
                        register={register("lastName", {
                          required: "هذا الحقل مطلوب",
                        })}
                        error={errors.lastName}
                      />
                      {errors.lastName && (
                        <p className="mt-1 text-xs font-semibold text-danger">
                          {errors.lastName.message}
                        </p>
                      )}
                    </div>
                  </>
                )}
                {step === 1 && (
                  <>
                    <div>
                      <FloatingInput
                        id="phone"
                        label="رقم الموبايل"
                        icon={<FaPhone size={14} />}
                        register={register("phone", {
                          required: "هذا الحقل مطلوب",
                        })}
                        error={errors.phone}
                      />
                      {errors.phone && (
                        <p className="mt-1 text-xs font-semibold text-danger">
                          {errors.phone.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <FloatingInput
                        id="guardianPhone"
                        label="رقم موبايل ولي الأمر"
                        icon={<FaPhone size={14} />}
                        register={register("guardianPhone", {
                          required: "هذا الحقل مطلوب",
                        })}
                        error={errors.guardianPhone}
                      />
                      {errors.guardianPhone && (
                        <p className="mt-1 text-xs font-semibold text-danger">
                          {errors.guardianPhone.message}
                        </p>
                      )}
                    </div>
                  </>
                )}
                {step === 2 && (
                  <>
                    <Controller
                      name="governorate"
                      control={control}
                      render={({ field }) => (
                        <EgyptGovernoratesSelect
                          {...field}
                          error={errors.governorate}
                        />
                      )}
                    />
                    {!adminMode && (
                      <Controller
                        name="gradeId"
                        control={control}
                        render={({ field }) => (
                          <GradesSelection
                            {...field}
                            role="admin"
                            error={errors.gradeId}
                            fetchUrl="/api/public/grades"
                          />
                        )}
                      />
                    )}
                    <div>
                      <FloatingInput
                        id="email"
                        label="البريد الإلكتروني"
                        type="email"
                        icon={<MdAlternateEmail size={16} />}
                        register={register("email", {
                          required: "هذا الحقل مطلوب",
                          validate: (v) =>
                            validator.isEmail(v) ||
                            "البريد الإلكتروني غير صحيح",
                        })}
                        error={errors.email}
                      />
                      {errors.email && (
                        <p className="mt-1 text-xs font-semibold text-danger">
                          {errors.email.message}
                        </p>
                      )}
                    </div>
                  </>
                )}
                {step === 3 && (
                  <>
                    <div>
                      <FloatingInput
                        id="password"
                        label="كلمة السر"
                        type="password"
                        icon={<RiLockPasswordFill size={16} />}
                        register={register("password", {
                          required: "هذا الحقل مطلوب",
                          minLength: {
                            value: 6,
                            message: "كلمة السر ٦ حروف على الأقل",
                          },
                        })}
                        error={errors.password}
                      />
                      {errors.password && (
                        <p className="mt-1 text-xs font-semibold text-danger">
                          {errors.password.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <FloatingInput
                        id="confirmPassword"
                        label="تأكيد كلمة السر"
                        type="password"
                        icon={<RiLockPasswordFill size={16} />}
                        register={register("confirmPassword", {
                          required: "هذا الحقل مطلوب",
                        })}
                        error={errors.confirmPassword}
                      />
                      {errors.confirmPassword && (
                        <p className="mt-1 text-xs font-semibold text-danger">
                          {errors.confirmPassword.message}
                        </p>
                      )}
                    </div>
                    {serverError && (
                      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-700 ">
                        {serverError}
                      </div>
                    )}
                  </>
                )}

                <div
                  className={`mt-2 flex gap-3 ${step > 0 ? "justify-between" : "justify-end"}`}
                >
                  {step > 0 && (
                    <button
                      type="button"
                      onClick={goBack}
                      className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3.5 text-sm font-bold text-text-secondary hover:border-(--brand-navy-border) hover:bg-brand-navy-soft hover:text-brand-navy transition-colors"
                    >
                      <FaArrowLeft size={12} className="flip-rtl" /> السابق
                    </button>
                  )}
                  {step < activeSteps.length - 1 ? (
                    <button
                      type="button"
                      onClick={goNext}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-navy px-6 py-3.5 text-sm font-extrabold text-white shadow-sm hover:bg-(--brand-navy-hover) active:scale-[0.98]"
                    >
                      التالي <FaArrowRight size={12} className="flip-rtl" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-navy px-6 py-3.5 text-sm font-extrabold text-white shadow-sm hover:bg-(--brand-navy-hover) active:scale-[0.98] disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />{" "}
                          جاري إنشاء الحساب...
                        </>
                      ) : (
                        <>
                          إنشاء الحساب{" "}
                          <FaArrowRight size={12} className="flip-rtl" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </form>

              <p className="mt-6 text-center text-sm text-text-muted">
                عندك حساب بالفعل؟{" "}
                <Link
                  href="/login"
                  className="font-extrabold text-brand-navy hover:underline"
                >
                  سجّل الدخول
                </Link>
              </p>
              <p className="mt-3 text-center text-xs">
                <Link
                  href="/"
                  className="inline-flex items-center gap-1 font-semibold text-text-muted hover:text-brand-navy"
                >
                  <FaArrowRight size={10} className="flip-rtl" /> العودة
                  للرئيسية
                </Link>
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center p-2 order-1 lg:order-2">
          <div className="relative w-full max-w-[520px] overflow-hidden rounded-3xl border border-border bg-card shadow-xl">
            <div className="h-1 w-full bg-gradient-to-l from-[var(--brand-amber)] to-[var(--brand-teal)]" />
            <div className="bg-[var(--background)] p-3 sm:p-4">
              <Image
                src="/signup.jpeg"
                alt="إنشاء حساب — أ. أحمد الدسوقي"
                width={700}
                height={700}
                className="w-full h-auto object-contain rounded-2xl"
                priority
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
