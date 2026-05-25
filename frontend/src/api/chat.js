import { API_BASE } from "./client";

// Stream a chat turn against the prompture AsyncAgent-backed endpoint.
// Returns an abort function the caller can invoke to cancel mid-stream.
//
// Events delivered to onEvent (see api/routes/chat.py for the producer):
//   { type: "turn_start", turn_index }
//   { type: "text", content }
//   { type: "thinking", content }
//   { type: "tool_call", id, name }
//   { type: "tool_input_delta", id, fragment }
//   { type: "tool_use_stop", id, name, input }
//   { type: "tool_result", id, name, output, is_error }
//   { type: "message_stop", stop_reason }
//   { type: "done", model, usage, message_id }
//   { type: "error", message }
export function streamChat(projectId, slug, message, opts = {}) {
  const controller = new AbortController();
  const { onEvent, onError, model = "", editContext = null } = opts;

  (async () => {
    try {
      const body = { message, model };
      if (editContext) body.edit_context = editContext;
      const res = await fetch(
        `${API_BASE}/api/projects/${projectId}/pages/${slug}/chat/stream`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (!payload) continue;
          try {
            onEvent?.(JSON.parse(payload));
          } catch {
            // skip malformed frame
          }
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        onError?.(err);
      }
    }
  })();

  return () => controller.abort();
}
