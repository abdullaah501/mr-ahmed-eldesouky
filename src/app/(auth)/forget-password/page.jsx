"use client";

import ForgotPasswordForm from "@/app/components/authComponents/ForgetPassword";
import ResetPassword from "@/app/components/authComponents/ResetPassword";
import ResetWithOtp from "@/app/components/authComponents/ResetWithOtp";
import { useState } from "react";

export default function Page() {
  const [steps, setSteps] = useState(1);
  const [resetToken, setResetToken] = useState("");
  const [email, setEmail] = useState("");

  return (
    <>
      {steps === 1 && (
        <ForgotPasswordForm
          nextStep={() => setSteps((prev) => prev + 1)}
          setEmail={setEmail}
        />
      )}
      {steps === 2 && (
        <ResetWithOtp
          email={email}
          nextStep={() => setSteps((prev) => prev + 1)}
          setResetToken={setResetToken}
        />
      )}
      {steps === 3 && <ResetPassword resetToken={resetToken} />}
    </>
  );
}
