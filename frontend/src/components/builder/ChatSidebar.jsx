import { useRef, useEffect } from "react";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import { Sparkle, PencilSimple, Cursor } from "@phosphor-icons/react";

export default function ChatSidebar({
  messages,
  onSend,
  onSteer = null,
  generating,
  discoveryForm = null,
  todoStream = null,
  editMode = false,
  editSelection = null,
  editSelections = [],
}) {
  const scrollRef = useRef(null);
  const formRef = useRef(null);

  useEffect(() => {
    // When a discovery form appears, scroll it into view instead of
    // auto-scrolling to the bottom (which buries the form below prior
    // chat history when the panel has scrolled past it).
    if (discoveryForm && formRef.current) {
      formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, generating, discoveryForm]);

  return (
    <aside className="w-[420px] flex flex-col border-r border-slate-800 bg-slate-950 relative z-10 shadow-2xl">
      {editMode && (
        <div className="border-b-2 border-brand-500/60 bg-gradient-to-r from-brand-500/20 via-brand-500/10 to-purple-500/10 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-white font-semibold">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-brand-500 shadow-lg shadow-brand-500/40">
              <PencilSimple size={11} weight="fill" className="text-white" />
            </span>
            <span>Tweak mode</span>
            <span className="text-[10px] font-mono uppercase tracking-wider text-brand-300/80 ml-auto px-1.5 py-0.5 bg-brand-500/20 rounded">
              no rebuild
            </span>
          </div>
          <div className="mt-1.5 text-[11px] text-brand-200/80 leading-snug">
            Chat here adjusts what you see. The agent can only{" "}
            <span className="font-mono text-brand-300">patch</span> /{" "}
            <span className="font-mono text-brand-300">find</span> /{" "}
            <span className="font-mono text-brand-300">insert blocks</span> — it
            will not rerun the PM → Designer → Developer pipeline.
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-mono">
            <Cursor size={11} className="text-brand-300/70" />
            {editSelections && editSelections.length > 1 ? (
              <span className="text-purple-300 font-semibold">
                {editSelections.length} elements selected
              </span>
            ) : editSelection ? (
              <>
                <span className="text-brand-200">&lt;{editSelection.tag}&gt;</span>
                <span className="text-brand-300/50 truncate">{editSelection.id}</span>
              </>
            ) : (
              <span className="text-brand-300/50">
                click an element (shift-click for multi-select)
              </span>
            )}
          </div>
        </div>
      )}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 && !generating && !discoveryForm && (
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

        {/* Surface the brief survey at the TOP so it stays visible even
            after the panel scrolls — burying it below the message list
            (the previous layout) meant users frequently never saw it. */}
        {discoveryForm && (
          <div ref={formRef} className="sticky top-0 z-10 -mt-4 -mx-4 px-4 pt-4 pb-2 bg-slate-950 border-b border-slate-800">
            {discoveryForm}
          </div>
        )}

        {messages.map((msg, i) => (
          <ChatMessage key={i} message={msg} />
        ))}

        {todoStream}
      </div>

      <ChatInput
        onSend={onSend}
        onSteer={onSteer}
        generating={generating}
        disabled={!!discoveryForm}
      />
    </aside>
  );
}
