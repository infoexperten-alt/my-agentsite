import { useState, useEffect } from "react";
import { GithubLogo, Star, Heart } from "@phosphor-icons/react";
import Modal from "./Modal";

const COUNT_KEY = "agentsite_generation_count";
const SEEN_KEY = "agentsite_support_seen";
const THRESHOLD = 3;

export default function SupportPopup() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const check = () => {
      const count = parseInt(localStorage.getItem(COUNT_KEY) || "0", 10);
      if (count >= THRESHOLD && !localStorage.getItem(SEEN_KEY)) {
        setVisible(true);
      }
    };

    // Check on mount and listen for storage changes (from useGeneration)
    check();
    window.addEventListener("storage", check);
    // Also listen for a custom event dispatched from the same tab
    window.addEventListener("agentsite_generation_complete", check);
    return () => {
      window.removeEventListener("storage", check);
      window.removeEventListener("agentsite_generation_complete", check);
    };
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(SEEN_KEY, "true");
    setVisible(false);
  };

  return (
    <Modal title="Enjoying AgentSite?" onClose={dismiss}>
      <div className="space-y-4">
        <p className="text-slate-300 text-sm leading-relaxed">
          <Heart size={16} weight="fill" className="inline text-red-400 mr-1 -mt-0.5" />
          You've completed {localStorage.getItem(COUNT_KEY)} generations so far!
          If AgentSite has been useful, consider starring the repo — it helps
          others discover the project and keeps development going.
        </p>

        <div className="flex items-center gap-3 pt-1">
          <a
            href="https://github.com/jhd3197/AgentSite"
            target="_blank"
            rel="noopener noreferrer"
            onClick={dismiss}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-brand-500 to-purple-600 hover:from-brand-400 hover:to-purple-500 rounded-lg text-sm font-medium text-white transition-colors"
          >
            <GithubLogo size={18} weight="fill" />
            <Star size={14} weight="fill" className="text-amber-200" />
            Star on GitHub
          </a>
          <button
            onClick={dismiss}
            className="px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-white transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </Modal>
  );
}
