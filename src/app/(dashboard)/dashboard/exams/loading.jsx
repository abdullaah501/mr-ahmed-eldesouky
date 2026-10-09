import React from "react";

export default function loading() {
  return (
    <div className="min-h-screen flex justify-center items-center">
      <div className="size-6 border-2 border-primary-purple rounded-full border-l-0 animate-spin" />
    </div>
  );
}
