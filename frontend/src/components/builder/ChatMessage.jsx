import { useState } from "react";
import { Sparkle, WarningCircle, SpinnerGap, CheckCircle, CaretDown, CaretRight } from "@phosphor-icons/react";

function AgentProgressMessage({ message }) {
  const [expanded, setExpanded] = useState(false);
  const { agents = [], done } = message;

  const current = agents.find((a) => a.status === "running");
  const lastCompleted = [...agents].reverse().find((a) => a.status === "complete");
  const summary = done
    ? "All agents completed"
    : current
      ? `${current.label} working...`
      : lastCompleted
        ? `${lastCompleted.label} completed`
        : "Starting pipeline...";

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-2 mb-1 ml-1">
        <div className="w-5 h-5 rounded bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center">
          <Sparkle className="text-white" weight="fill" size={10} />
        </div>
        <span className="text-xs font-medium text-slate-400">AgentSite</span>
      </div>
      <div className="bg-slate-900 border border-slate-800 text-slate-300 px-4 py-3 rounded-2xl msg-agent max-w-[90%] shadow-sm w-full">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-2 w-full text-left cursor-pointer"
        >
          {!done && <SpinnerGap className="animate-spin text-brand-400 shrink-0" size={14} />}
          {done && <CheckCircle className="text-emerald-400 shrink-0" weight="fill" size={14} />}
          <span className="text-sm flex-1">{summary}</span>
          {expanded ? (
            <CaretDown className="text-slate-500 shrink-0" size={12} />
          ) : (
            <CaretRight className="text-slate-500 shrink-0" size={12} />
          )}
        </button>
        {expanded && (
          <div className="mt-3 space-y-2 border-t border-slate-800 pt-3">
            {agents.map((a) => (
              <div key={a.name} className="flex items-center gap-2 text-xs">
                {a.status === "complete" && (
                  <CheckCircle className="text-emerald-400 shrink-0" weight="fill" size={12} />
                )}
                {a.status === "running" && (
                  <SpinnerGap className="animate-spin text-brand-400 shrink-0" size={12} />
                )}
                {a.status === "pending" && (
                  <div className="w-3 h-3 rounded-full border border-slate-600 shrink-0" />
                )}
                <span className={a.status === "pending" ? "text-slate-500" : "text-slate-300"}>
                  {a.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatMessage({ message }) {
  const isUser = message.role === "user";
  const isError = !isUser && message.content?.startsWith("Error:");

  if (message.role === "agent-progress") {
    return <AgentProgressMessage message={message} />;
  }

  if (isUser) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="bg-brand-600 text-white px-4 py-3 rounded-2xl msg-user max-w-[90%] shadow-md">
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          {message.image && (
            <img
              src={message.image}
              alt="Uploaded"
              className="mt-2 rounded-lg max-h-40 object-cover"
            />
          )}
        </div>
        {message.time && (
          <span className="text-[10px] text-slate-500 mr-1">
            {message.time}
          </span>
        )}
      </div>
    );
  }

  if (isError) {
    // Parse error: first line is summary, rest (if any) is traceback
    const errorText = message.content.replace(/^Error:\s*/, "");
    const lines = errorText.split("\n\n");
    const summary = lines[0];
    const traceback = lines.length > 1 ? lines.slice(1).join("\n\n") : null;

    return (
      <div className="flex flex-col items-start gap-1">
        <div className="flex items-center gap-2 mb-1 ml-1">
          <div className="w-5 h-5 rounded bg-red-600 flex items-center justify-center">
            <WarningCircle className="text-white" weight="fill" size={12} />
          </div>
          <span className="text-xs font-medium text-red-400">Error</span>
        </div>
        <div className="bg-red-950/40 border border-red-500/20 text-red-300 px-4 py-3 rounded-2xl msg-agent max-w-[90%] shadow-sm">
          <p className="text-sm font-medium mb-1">{summary}</p>
          {traceback && (
            <details className="mt-2">
              <summary className="text-xs text-red-400/70 cursor-pointer hover:text-red-300 select-none">
                Show details
              </summary>
              <pre className="mt-2 text-[11px] text-red-300/60 whitespace-pre-wrap font-mono overflow-x-auto max-h-60 overflow-y-auto bg-red-950/30 rounded-lg p-3 border border-red-500/10">
                {traceback}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-2 mb-1 ml-1">
        <div className="w-5 h-5 rounded bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center">
          <Sparkle className="text-white" weight="fill" size={10} />
        </div>
        <span className="text-xs font-medium text-slate-400">AgentSite</span>
      </div>
      <div className="bg-slate-900 border border-slate-800 text-slate-300 px-4 py-3 rounded-2xl msg-agent max-w-[90%] shadow-sm">
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
}
