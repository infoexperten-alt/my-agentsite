import ChatPanel from "./ChatPanel";
import useChat from "../../hooks/useChat";

/**
 * Self-contained chat — combines `useChat` (state + streaming) with
 * `<ChatPanel>` (presentation). Drop into any surface that has a
 * Prompture-compatible SSE endpoint.
 *
 * Typical usage:
 *
 *   <StandaloneChat
 *     projectId="abc"
 *     slug="home"
 *     editContext={{ mode: true, selection }}
 *     toolHandlers={{ patch: (p) => editor.applyPatch(p) }}
 *     topBanner={<EditModeBanner ... />}
 *   />
 *
 * For surfaces that need to interleave chat with other event streams
 * (AgentSite's PageBuilderPage with generation progress messages),
 * skip this wrapper and compose `useChat` + `<ChatPanel>` directly so
 * you can push extra messages with `pushMessage`.
 */
export default function StandaloneChat({
  projectId,
  slug,
  model = "",
  editContext = null,
  toolHandlers = {},
  persistMessage = null,
  seed = [],
  topBanner = null,
  stickyForm = null,
  belowMessages = null,
  emptyState = null,
  className,
  inputDisabledReason = null,
}) {
  const chat = useChat({
    projectId,
    slug,
    model,
    editContext,
    toolHandlers,
    persistMessage,
    seed,
  });

  return (
    <ChatPanel
      messages={chat.messages}
      onSend={chat.send}
      generating={chat.generating}
      topBanner={topBanner}
      stickyForm={stickyForm}
      belowMessages={belowMessages}
      emptyState={emptyState}
      className={className}
      inputDisabledReason={inputDisabledReason}
    />
  );
}
