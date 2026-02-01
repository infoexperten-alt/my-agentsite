import { Sparkle } from "@phosphor-icons/react";

export default function ChatMessage({ message }) {
  const isUser = message.role === "user";

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
