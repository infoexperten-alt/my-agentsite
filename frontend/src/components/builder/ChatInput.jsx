import { useState, useRef } from "react";
import { Image, ArrowRight } from "@phosphor-icons/react";

export default function ChatInput({ onSend, disabled }) {
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const fileRef = useRef(null);

  const handleSend = () => {
    if (!text.trim() && !imageFile) return;
    onSend({ text: text.trim(), image: imageFile });
    setText("");
    setImageFile(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="p-4 bg-slate-950 border-t border-slate-800">
      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-brand-600 to-purple-600 rounded-xl opacity-20 group-focus-within:opacity-100 transition duration-500 blur" />
        <div className="relative bg-slate-900 rounded-xl p-2 border border-slate-800 group-focus-within:border-brand-500/50 transition-colors">
          {imageFile && (
            <div className="px-2 pb-2 flex items-center gap-2">
              <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded">
                {imageFile.name}
              </span>
              <button
                onClick={() => setImageFile(null)}
                className="text-xs text-slate-500 hover:text-white"
              >
                x
              </button>
            </div>
          )}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            className="w-full bg-transparent text-sm text-white placeholder-slate-500 resize-none outline-none p-2 h-20"
            placeholder="Describe changes to the AI..."
          />
          <div className="flex justify-between items-center px-2 pb-1">
            <div className="flex gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="text-slate-500 hover:text-white transition-colors"
                title="Upload Image"
              >
                <Image size={18} />
              </button>
            </div>
            <button
              onClick={handleSend}
              disabled={disabled || (!text.trim() && !imageFile)}
              className="bg-white text-slate-950 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors flex items-center gap-1 disabled:opacity-50"
            >
              Send <ArrowRight weight="bold" size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
