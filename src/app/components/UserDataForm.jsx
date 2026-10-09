"use client";

import React, { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { FaPhone } from "react-icons/fa";
import { LiaUserEditSolid } from "react-icons/lia";
import { MdAlternateEmail, MdImage } from "react-icons/md";
import validator from "validator";
import toast from "react-hot-toast";
import EgyptGovernoratesSelect from "@/app/components/EgyptGovernoratesSelect";
import FloatingInput from "@/app/components/FloatingInput";
import GradesSelection from "@/app/components/GradesSelection";
import { updateUserData } from "@/app/actions/userActions";
import Image from "next/image";
import { getImageSrc } from "./ImagePreview";
import { useUserStore } from "../../../stores/user";
import { upload } from "../../../lib/upload";

export default function UserDataForm({ user: initialUser }) {
  const user = useUserStore((state) => state.user) || initialUser;
  const setUser = useUserStore((state) => state.setUser);
  const queryClient = useQueryClient();
  const router = useRouter();
  const [thumbnailPreview, setThumbnailPreview] = useState(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    setValue,
    reset,
  } = useForm({
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
      guardianPhone: "",
      governorate: "",
      gradeId: "",
      email: "",
      image: {
        url: "",
        cloudId: "",
      },
    },
  });

  useEffect(() => {
    register("image.url");
    register("image.cloudId");
  }, [register]);

  useEffect(() => {
    if (user) {
      reset({
        firstName: user?.firstName || "",
        lastName: user?.lastName || "",
        phone: user?.phone || "",
        guardianPhone: user?.guardianPhone || "",
        governorate: user?.governorate || "",
        gradeId: user?.gradeId || "",
        email: user?.email || "",
        image: {
          url: user?.image?.url || "",
          cloudId: user?.image?.cloudId || "",
        },
      });

      if (user?.image?.url && user?.image?.cloudId) {
        setThumbnailPreview({
          url: user?.image?.url,
          cloudId: user?.image?.cloudId,
        });
      }
    }
  }, [user, reset]);

  const handleUpload = (e) => {
    upload(e, ({ url, cloudId }) => {
      if (url) {
        setThumbnailPreview({ url, cloudId });
        setValue("image.url", url);
        setValue("image.cloudId", cloudId);
        toast.success("تم رفع الصورة بنجاح!");
      }
    });
  };

  const onSubmit = async (formData) => {
    const changedData = {};

    Object.keys(formData).forEach((key) => {
      if (key === "image") {
        const hasValidImage =
          formData.image?.url?.trim() && formData.image?.cloudId?.trim();

        const isDifferentFromUser =
          formData.image?.url !== user?.image?.url ||
          formData.image?.cloudId !== user?.image?.cloudId;

        if (hasValidImage && isDifferentFromUser) {
          changedData.image = formData.image;
        }
      } else {
        const oldValue = user?.[key];
        const newValue = formData[key];

        if (newValue === oldValue) return;

        if (newValue === "" || newValue === null || newValue === undefined)
          return;

        changedData[key] = newValue;
      }
    });

    if (Object.keys(changedData).length === 0) {
      toast("مفيش أي تغييرات.");
      return;
    }

    try {
      const res = await updateUserData(
        user?.email || "abdullahnaser5001@gmail.com",
        changedData,
      );

      setUser(res?.data);
      toast.success(res?.message || "تم تحديث الملف الشخصي بنجاح");
      reset(formData);
      // Grade changed: the student's Grade-dependent content resolves from
      // User.gradeId — drop the stale queries so the new Grade shows up now.
      if (changedData.gradeId) {
        queryClient.invalidateQueries({ queryKey: ["myGrades"] });
        queryClient.invalidateQueries({ queryKey: ["myGradesList"] });
        router.refresh();
      }
    } catch (err) {
      console.error(err.response?.data?.message || "Update failed");
      toast.error("فشل تحديث بياناتك");
    }
  };

  return (
    <div className="px-10 py-6">
      <h1 className="mb-10 text-right text-2xl font-bold text-foreground">
        بيانات الملف الشخصي
      </h1>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="grid md:grid-cols-2 grid-cols-1 gap-y-10 gap-6 max-w-2xl mx-auto"
      >
        <div className="relative md:col-span-2">
          <label className="block mb-2 text-sm font-medium text-text-secondary">
            الصورة الشخصية
          </label>
          <div className="size-32 border-2 border-dashed border-border hover:border-primary transition rounded-full mx-auto flex flex-col items-center justify-center cursor-pointer bg-gray-50 text-center relative">
            {thumbnailPreview?.url ? (
              <Image
                src={getImageSrc(thumbnailPreview)}
                alt="معاينة الصورة"
                width={128}
                height={128}
                className="size-32 object-cover rounded-full mb-2 border"
              />
            ) : (
              <MdImage className="text-4xl text-gray-400 mb-2" />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleUpload}
              className="opacity-0 absolute inset-0 cursor-pointer"
            />
          </div>
        </div>

        <FloatingInput
          id="firstName"
          name="firstName"
          label="الاسم الأول"
          icon={<LiaUserEditSolid />}
          register={register("firstName")}
          error={errors.firstName}
        />
        <FloatingInput
          id="lastName"
          name="lastName"
          label="اسم العائلة"
          icon={<LiaUserEditSolid />}
          register={register("lastName")}
          error={errors.lastName}
        />
        <FloatingInput
          id="phone"
          name="phone"
          label="رقم الموبايل"
          icon={<FaPhone />}
          register={register("phone")}
          error={errors.phone}
        />
        <FloatingInput
          id="guardianPhone"
          name="guardianPhone"
          label="رقم موبايل ولي الأمر"
          icon={<FaPhone />}
          register={register("guardianPhone")}
          error={errors.guardianPhone}
        />

        <Controller
          name="governorate"
          control={control}
          render={({ field }) => (
            <EgyptGovernoratesSelect {...field} error={errors.governorate} />
          )}
        />

        <Controller
          name="gradeId"
          control={control}
          render={({ field }) => (
            <GradesSelection {...field} role={"admin"} error={errors.gradeId} />
          )}
        />

        <FloatingInput
          id="email"
          name="email"
          label="البريد الإلكتروني"
          type="email"
          icon={<MdAlternateEmail />}
          className="md:col-span-2"
          register={register("email", {
            validate: (value) =>
              validator.isEmail(value) || "البريد الإلكتروني غير صحيح",
          })}
          error={errors.email}
        />

        <button
          type="submit"
          disabled={isSubmitting}
          className={`md:col-span-2 flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-base border-2 border-primary bg-primary text-white hover:bg-transparent hover:text-primary transition-all duration-300 active:scale-95 shadow-md
            ${
              isSubmitting
                ? "opacity-50 hover:bg-primary hover:text-white cursor-not-allowed"
                : ""
            }
          `}
        >
          {isSubmitting && (
            <svg
              className="animate-spin h-5 w-5 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
          )}
          {isSubmitting ? "جاري الحفظ..." : "حفظ"}
        </button>
      </form>
    </div>
  );
}
