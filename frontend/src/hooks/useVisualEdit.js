import { useCallback, useEffect, useRef, useState } from "react";
import { tagHtml, untagHtml, injectBridge, applyPatch } from "htmlstudio";
import { fetchRawHtml, saveEditedHtml } from "../api/edit.js";

/**
 * Orchestrates the htmlstudio round-trip for a single page version.
 *
 * Flow:
 *   1. fetch raw HTML from /preview
 *   2. inject a <base href> so relative asset URLs still resolve, tag, inject the bridge
 *   3. expose `srcDoc` for PreviewFrame
 *   4. listen to postMessage events from the bridge, expose `selection`
 *   5. on patch: applyPatch → update srcDoc → debounce PUT to backend
 *
 * Set `enabled=false` and the hook is a no-op (no fetch, no listener).
 */
export default function useVisualEdit({ projectId, slug, version, enabled }) {
  const [taggedSource, setTaggedSource] = useState(null);
  const [srcDoc, setSrcDoc] = useState(null);
  const [selection, setSelection] = useState(null);
  const [ready, setReady] = useState(false);
  const [saveState, setSaveState] = useState({ status: "idle", error: null });
  const saveTimer = useRef(null);

  // Build a bridged srcDoc from a (tagged) source string.
  const buildSrcDoc = useCallback(
    (tagged) => {
      const baseHref = version
        ? `${window.location.origin}/preview/${projectId}/${slug}/v/${version}/`
        : `${window.location.origin}/preview/${projectId}/${slug}/`;

      const withBase = /<head[^>]*>/i.test(tagged)
        ? tagged.replace(/<head([^>]*)>/i, `<head$1><base href="${baseHref}">`)
        : `<!doctype html><html><head><base href="${baseHref}"></head><body>${tagged}</body></html>`;

      return injectBridge(withBase, { targetOrigin: "*" });
    },
    [projectId, slug, version],
  );

  // Load + tag whenever enabled/version changes.
  useEffect(() => {
    if (!enabled || !projectId || !slug) {
      setTaggedSource(null);
      setSrcDoc(null);
      setSelection(null);
      setReady(false);
      return;
    }
    let cancelled = false;
    setReady(false);
    fetchRawHtml(projectId, slug, version)
      .then((html) => {
        if (cancelled) return;
        const tagged = tagHtml(html);
        setTaggedSource(tagged);
        setSrcDoc(buildSrcDoc(tagged));
        setReady(true);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("useVisualEdit: failed to load preview HTML", err);
        setReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, projectId, slug, version, buildSrcDoc]);

  // Bridge → host
  useEffect(() => {
    if (!enabled) return undefined;
    const onMessage = (e) => {
      const msg = e.data;
      if (!msg || msg.channel !== "ve") return;
      if (msg.type === "select") setSelection(msg.payload);
      else if (msg.type === "hover") {/* available if a breadcrumb panel wants it */}
      else if (msg.type === "dblclick-text") {
        applyAndPersist({ kind: "set-text", id: msg.payload.id, value: msg.payload.value });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // applyAndPersist is stable below via the function declaration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, taggedSource]);

  const scheduleSave = useCallback(
    (html) => {
      if (!version) return; // only persist when looking at a real version
      if (saveTimer.current) clearTimeout(saveTimer.current);
      setSaveState({ status: "pending", error: null });
      saveTimer.current = setTimeout(async () => {
        setSaveState({ status: "saving", error: null });
        try {
          const clean = untagHtml(html);
          await saveEditedHtml(projectId, slug, version, clean);
          setSaveState({ status: "saved", error: null, savedAt: Date.now() });
        } catch (err) {
          setSaveState({ status: "error", error: err.message });
        }
      }, 600);
    },
    [projectId, slug, version],
  );

  const applyAndPersist = useCallback(
    (patch) => {
      setTaggedSource((current) => {
        if (!current) return current;
        const r = applyPatch(current, patch);
        if (!r.ok) {
          console.warn("htmlstudio patch failed:", r.error);
          return current;
        }
        setSrcDoc(buildSrcDoc(r.source));
        scheduleSave(r.source);
        return r.source;
      });
    },
    [buildSrcDoc, scheduleSave],
  );

  return {
    srcDoc,           // pass to <iframe srcDoc={...} />
    selection,        // currently selected element info or null
    setSelection,     // for closing the inspector
    applyPatch: applyAndPersist,
    ready,
    saveState,
  };
}
