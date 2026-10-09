"use client";
import { Suspense, useState, lazy } from "react";
import { ImSpinner9 } from "react-icons/im";
import { SiChatbot } from "react-icons/si";
const ChatBot = lazy(() => import("./ChatBot"));

export default function ChatContainer() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-12 z-[999] w-fit m-auto md:m-0 right-1 md:right-4">
      {!isOpen ? (
        <div className="flex justify-center items-center size-12 bl-bg cursor-pointer shadow text-white p-2 rounded-full">
          <SiChatbot size={32} onClick={() => setIsOpen(!isOpen)} />
        </div>
      ) : (
        <Suspense
          fallback={
            <div className="text-[#c058ff] w-full flex justify-center item-center">
              <ImSpinner9 className="animate-spin" size={35} />
            </div>
          }
        >
          <ChatBot setIsOpen={setIsOpen} />
        </Suspense>
      )}
    </div>
  );
}
