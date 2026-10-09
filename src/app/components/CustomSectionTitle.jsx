import React from "react";

export default function CustomSectionTitle({ title, highlightedWord }) {
  return (
    <h3 className="lg:text-5xl md:text-3xl text-2xl font-bold text-foreground relative w-fit lg:my-32 my-10">
      {title}
      {highlightedWord === "" ? (
        ""
      ) : (
        <span className="text-primary">{highlightedWord}</span>
      )}
      <span className="absolute w-16 h-1 right-0 -bottom-5 rounded-full bg-gray-200"></span>
      <span className="absolute w-16 h-1 right-0 -top-7 rounded-full bg-gray-200"></span>
      <span className="absolute w-24 h-1 right-0 -bottom-3 rounded-full bg-gray-200"></span>
    </h3>
  );
}
