import { useCallback, useEffect, useRef, useState } from "react";
import { tagHtml, untagHtml, injectBridge, applyPatch, applyPatches } from "htmlstudio";
import { fetchRawHtml, saveEditedHtml } from "../api/edit.js";

/**
 * Orchestrates the htmlstudio round-trip for a single page version.
 *
 * Flow:
 *   1. fetch raw HTML from /preview
 *   2. inject a <base href> so relative asset URLs still resolve, tag, inject the bridge
 *   3. expose `srcDoc` for PreviewFrame
 *   4. listen to postMessage events from the bridge, expose `selection` / `selections`
 *   5. on patch: applyPatch(es) → update srcDoc → debounce PUT to backend
 *
 * Set `enabled=false` and the hook is a no-op (no fetch, no listener).
 *
 * Selection model:
 *   - `selection` — the currently-focused single element (null when in multi-mode)
 *   - `selections` — array (>= 1 when multi-select is active via shift-click)
 *   - Inspector should prefer `selections` when length > 1, fall back to `selection`.
 */
export default function useVisualEdit({ projectId, slug, version, enabled }) {
  const [taggedSource, setTaggedSource] = useState(null);
  const [srcDoc, setSrcDoc] = useState(null);
  const [selection, setSelection] = useState(null);
  const [selections, setSelections] = useState([]); // multi-select (shift-click)
  const [ready, setReady] = useState(false);
  const [saveState, setSaveState] = useState({ status: "idle", error: null });
  const saveTimer = useRef(null);
  const previewFrameRef = useRef(null); // exposed for host → iframe commands (query, highlight, clear)

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
      setSelections([]);
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
      if (msg.type === "select") {
        setSelection(msg.payload);
        setSelections([]);
      } else if (msg.type === "select-multi") {
        const arr = Array.isArray(msg.payload) ? msg.payload : [];
        setSelections(arr);
        setSelection(null);
      } else if (msg.type === "hover") {
        /* available if a breadcrumb panel wants it */
      } else if (msg.type === "dblclick-text") {
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

  // Apply a sequence of patches atomically — used by the inspector for
  // bulk operations on multi-select. Bails on first error (mirrors
  // htmlstudio's applyPatches behavior).
  const applyManyAndPersist = useCallback(
    (patches) => {
      if (!Array.isArray(patches) || patches.length === 0) return;
      setTaggedSource((current) => {
        if (!current) return current;
        const r = applyPatches(current, patches);
        if (!r.ok) {
          console.warn("htmlstudio applyPatches failed:", r.error);
          return current;
        }
        setSrcDoc(buildSrcDoc(r.source));
        scheduleSave(r.source);
        return r.source;
      });
    },
    [buildSrcDoc, scheduleSave],
  );

  // Pull the outer HTML for a given data-ve-id directly from the tagged
  // source. Used by the "Save as component" flow — we need the actual
  // markup, not just the selection's metadata.
  const getOuterHtml = useCallback(
    (id) => {
      if (!taggedSource || !id) return null;
      // DOMParser is the simplest, browser-native option here — the
      // tagged source is well-formed HTML.
      try {
        const doc = new DOMParser().parseFromString(taggedSource, "text/html");
        const el = doc.querySelector(`[data-ve-id="${CSS.escape(id)}"]`);
        return el ? el.outerHTML : null;
      } catch {
        return null;
      }
    },
    [taggedSource],
  );

  // Clear all selection state and tell the iframe to drop its outlines.
  const clearSelection = useCallback(() => {
    setSelection(null);
    setSelections([]);
    if (previewFrameRef.current?.contentWindow) {
      previewFrameRef.current.contentWindow.postMessage(
        { channel: "ve", type: "clear" },
        "*",
      );
    }
  }, []);

  return {
    srcDoc,
    selection,        // single-select (null when multi-select is active)
    selections,       // multi-select array (length 0 when single-select)
    setSelection,
    setSelections,
    clearSelection,
    applyPatch: applyAndPersist,
    applyPatches: applyManyAndPersist,
    getOuterHtml,     // for "Save as component" — pulls raw markup by id
    ready,
    saveState,
    previewFrameRef,  // attach to the iframe so the hook can post commands
  };
}
