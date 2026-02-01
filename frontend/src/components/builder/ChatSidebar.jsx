import { useRef, useEffect } from "react";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import { Sparkle, SpinnerGap } from "@phosphor-icons/react";

export default function ChatSidebar({
  messages,
  onSend,
  generating,
  agentStatus,
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

        {generating && agentStatus && (
          <div className="flex flex-col items-start gap-1">
            <div className="flex items-center gap-2 mb-1 ml-1">
              <div className="w-5 h-5 rounded bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center">
                <Sparkle className="text-white" weight="fill" size={10} />
              </div>
              <span className="text-xs font-medium text-slate-400">
                AgentSite
              </span>
            </div>
            <div className="bg-slate-900/50 border border-brand-500/30 text-slate-300 px-4 py-3 rounded-2xl msg-agent max-w-[90%] thinking-state flex items-center gap-3">
              <SpinnerGap className="animate-spin text-brand-400" size={16} />
              <span className="text-sm text-brand-200">{agentStatus}</span>
            </div>
          </div>
        )}
      </div>

      <ChatInput onSend={onSend} disabled={generating} />
    </aside>
  );
}
