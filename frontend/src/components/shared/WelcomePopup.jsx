import { useState } from "react";
import { GithubLogo, Star, Sparkle } from "@phosphor-icons/react";
import Modal from "./Modal";

const LS_KEY = "agentsite_welcome_seen";

export default function WelcomePopup() {
  const [visible, setVisible] = useState(() => !localStorage.getItem(LS_KEY));

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(LS_KEY, "true");
    setVisible(false);
  };

  return (
    <Modal title="Welcome to AgentSite" onClose={dismiss}>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center shrink-0">
            <Sparkle className="text-white" size={22} weight="fill" />
          </div>
          <p className="text-slate-300 text-sm leading-relaxed">
            Build production-ready websites from a single prompt. Four AI agents
            — PM, Designer, Developer, and Reviewer — collaborate to bring your
            ideas to life.
          </p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 text-sm text-slate-400 leading-relaxed">
          Create a project, describe what you want, pick a model, and hit
          Generate. Your site will be ready in seconds.
        </div>

        <div className="flex items-center gap-3 pt-1">
          <a
            href="https://github.com/jhd3197/AgentSite"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm font-medium text-white transition-colors"
          >
            <GithubLogo size={18} weight="fill" />
            <Star size={14} weight="fill" className="text-amber-400" />
            Star on GitHub
          </a>
          <button
            onClick={dismiss}
            className="px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-white transition-colors"
          >
            Get started
          </button>
        </div>
      </div>
    </Modal>
  );
}
