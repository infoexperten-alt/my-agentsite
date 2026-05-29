import { fetchJSON, API_BASE } from "./client.js";

/** Fetch raw HTML for a page version. Bypasses fetchJSON so we get the text body, not parsed JSON. */
export async function fetchRawHtml(projectId, slug, version) {
  const path = version
    ? `/preview/${projectId}/${slug}/v/${version}`
    : `/preview/${projectId}/${slug}`;
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load preview HTML: ${res.status}`);
  return res.text();
}

/** PUT edited HTML back to disk + DB. */
export function saveEditedHtml(projectId, slug, version, html, path = "index.html") {
  return fetchJSON(`/api/edit/${projectId}/${slug}/v/${version}/file`, {
    method: "PUT",
    body: JSON.stringify({ html, path }),
  });
}
