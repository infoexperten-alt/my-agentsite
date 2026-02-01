import { useRef, useEffect } from "react";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import { Sparkle } from "@phosphor-icons/react";

export default function ChatSidebar({
  messages,
  onSend,
  generating,
}) {
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, generating]);

  return (
    <aside className="w-[420px] flex flex-col border-r border-slate-800 bg-slate-950 relative z-10 shadow-2xl">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 && !generating && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center mb-4 shadow-lg shadow-brand-500/20">
              <Sparkle className="text-white" weight="fill" size={24} />
            </div>
            <h3 className="text-white font-medium mb-1">Start Building</h3>
            <p className="text-sm text-slate-500 max-w-[280px]">
              Describe what you want to create and the AI agents will build it
              for you.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <ChatMessage key={i} message={msg} />
        ))}
      </div>

      <ChatInput onSend={onSend} disabled={generating} />
    </aside>
  );
}
