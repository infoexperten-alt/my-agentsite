import { useCallback, useEffect, useRef, useState } from "react";
import { streamChat } from "../api/chat";

/**
 * Self-contained chat state + streaming for any Prompture SSE endpoint.
 *
 * Drop-in for surfaces that don't need AgentSite's full generation
 * interleaving (PageBuilderPage has its own setup because it mixes chat
 * with the pipeline / WS events).
 *
 * Config:
 *   - projectId, slug: the Prompture context (the existing streamChat
 *     wrapper expects these — for non-AgentSite use cases, pass any
 *     pair the endpoint understands)
 *   - model: optional model override
 *   - editContext: optional dict passed verbatim as `edit_context`
 *   - toolHandlers: { [tool_name]: (input) => void } — fires on
 *     tool_use_stop for the named tool. Common use: route `patch`
 *     events into htmlstudio's applyPatch.
 *   - persistMessage?: ({role, content, meta}) => void — host hook to
 *     persist user/agent messages somewhere durable
 *   - seed?: ChatMessage[] — initial messages
 *
 * Returns:
 *   - messages, send({text, image?}), generating, abort(), reset(), pushMessage(msg)
 */
export default function useChat({
  projectId,
  slug,
  model = "",
  editContext = null,
  toolHandlers = {},
  persistMessage = null,
  seed = [],
} = {}) {
  const [messages, setMessages] = useState(seed);
  const [generating, setGenerating] = useState(false);
  const abortRef = useRef(null);

  // Refs so the streaming closure always sees the latest handlers
  // without re-binding the SSE connection.
  const handlersRef = useRef(toolHandlers);
  const editCtxRef = useRef(editContext);
  useEffect(() => { handlersRef.current = toolHandlers; }, [toolHandlers]);
  useEffect(() => { editCtxRef.current = editContext; }, [editContext]);

  const pushMessage = useCallback((msg) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const reset = useCallback(() => {
    setMessages(seed);
  }, [seed]);

  const abort = useCallback(() => {
    if (abortRef.current) {
      abortRef.current();
      abortRef.current = null;
    }
    setGenerating(false);
  }, []);

  const send = useCallback(({ text }) => {
    if (!text || !text.trim()) return;
    const userMsg = {
      role: "user",
      content: text,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, userMsg]);
    persistMessage?.({ role: "user", content: text });

    const liveId = `chat-${Date.now()}`;
    setMessages((prev) => [...prev, { role: "agent", content: "", _liveId: liveId }]);
    setGenerating(true);

    let agentText = "";
    abortRef.current = streamChat(projectId, slug, text, {
      model,
      editContext: editCtxRef.current,
      onEvent: (event) => {
        if (event.type === "text") {
          agentText += event.content;
          setMessages((prev) =>
            prev.map((m) => (m._liveId === liveId ? { ...m, content: agentText } : m)),
          );
        } else if (event.type === "tool_use_stop") {
          const handler = handlersRef.current?.[event.name];
          if (handler && event.input && typeof event.input === "object") {
            try { handler(event.input); } catch (err) {
              console.error(`useChat: toolHandler '${event.name}' threw`, err);
            }
          }
        } else if (event.type === "done") {
          setMessages((prev) =>
            prev.map((m) => (m._liveId === liveId ? { role: "agent", content: agentText } : m)),
          );
          persistMessage?.({ role: "agent", content: agentText });
          setGenerating(false);
          abortRef.current = null;
        } else if (event.type === "error") {
          setMessages((prev) =>
            prev.map((m) =>
              m._liveId === liveId ? { role: "agent", content: `Error: ${event.message}` } : m,
            ),
          );
          setGenerating(false);
          abortRef.current = null;
        }
      },
      onError: (err) => {
        setMessages((prev) =>
          prev.map((m) =>
            m._liveId === liveId
              ? { role: "agent", content: `Connection error: ${err.message}` }
              : m,
          ),
        );
        setGenerating(false);
        abortRef.current = null;
      },
    });
  }, [projectId, slug, model, persistMessage]);

  // Clean up on unmount.
  useEffect(() => () => { if (abortRef.current) abortRef.current(); }, []);

  return { messages, send, generating, abort, reset, pushMessage };
}
