# AgentSite — Onboarding & Status Handoff

This file is the single doorway for a fresh-context chat session picking up the
AgentSite repo. Paste the relevant section into your prompt; the agent can read
the linked files for full details.

**Last updated:** 2026-05-18 — covering branch `dev` through commit `ef2b3bd`.

---

## 1. What this repo is

AgentSite is an AI-powered website builder that turns a one-line brief into a
production-ready static site. The shape:

- **Backend** — Python 3.10+, FastAPI, Uvicorn, SQLite via aiosqlite. Agent
  orchestration uses [Prompture](https://github.com/jhd3197/prompture)
  (`AsyncSequentialGroup`, `AsyncLoopGroup`, `ParallelGroup`,
  `AsyncDebateGroup`, `Persona`, `ToolRegistry`, `SkillInfo`).
- **Frontend** — React 19 + Vite 6 + Tailwind CSS 4 SPA. Built into
  `frontend/dist/` and served by FastAPI with an SPA fallback.
- **Generated sites** — vanilla HTML/CSS/JS (or React+SCSS, PM-decided),
  written by agent tools into `~/.agentsite/projects/<id>/site/`.

The pipeline runs a sequence of specialized agents — PM → Designer →
Developer → Reviewer — with optional specialists (Markup / Style / Script /
Image / Copywriter / SEO / Accessibility / Animation) the PM can swap in.

Read `CLAUDE.md` for the codebase's working conventions and `README.md` for
the user-facing tour.

---

## 2. What ships today (Phases 1–12 + follow-ups)

Twenty commits past `f5b0979`. Counts in parens are tests added by that phase
(suite total: **205 passing, 0 failures**).

| Commit | What landed |
|---|---|
| `1933cd8` Phase 1 | `DiscoveryBrief` Pydantic + form schema (verbatim port of OD's discovery form) + `GET /api/discovery/form` + `discovery_brief_submitted` WS event + DiscoveryForm UI gating first generation. (10) |
| `179dcaf` Phase 2 | 5 OKLch design directions verbatim from open-design (`editorial-monocle`, `modern-minimal`, `human-approachable`, `tech-utility`, `brutalist-experimental`); `direction_id` skips Designer & synthesizes StyleSpec deterministically; DirectionPicker UI. (12) |
| `96c5940` Phase 3 | `write_file` pre-flight gate — Developer must call `read_guide()` for `design-system.md` + `architecture.md` before any write. Gate self-disarms on first satisfied write. Behind `settings.preflight_enabled` (default on). (6) |
| `c27e659` Phase 4 | Multi-dim critique panel: 4 single-dim reviewers (`visual_fidelity`, `accessibility`, `content_quality`, `code_health`) + judge via `AsyncDebateGroup`; per-project `quality_ratchet.json` with only-up floors; `critique_verdict` WS event; `GET /api/projects/{id}/quality`. Behind `settings.use_critique_panel` (default OFF — pair with Phase 11 routing before flipping). (13) |
| `a103c90` Phase 5 | 8 bundled `SKILL.md` files under `agentsite/skills/<id>/` loaded via Prompture; `GET /api/skills`; PM picks `skill_id` per page; Developer prompt interpolates `{skill_instructions}`. (10) |
| `db8eebe` Phase 6 | `write_file(*.html)` publishes `preview_update` WS event with rendered HTML + sha1 content hash; PreviewFrame uses `srcDoc` while generating, swaps back to static URL on completion. (3) |
| `2258681` Phase 7 | `SteerMailbox` (per-project asyncio.Queue) + WS inbound `{type: "steer", text}`; pipeline drains + injects via `{user_steer}`; `AsyncDeepAgent` developer factory behind `settings.use_deep_agent_developer` (default off; falls back when installed Prompture predates `AsyncDeepAgent`). (7) |
| `e150519` Phase 8 | Brand extractor — URL fetch+regex / Pillow image / Prompture ingestion PDF → populated `StyleSpec`; `guard_external_url` SSRF guard; `POST /api/projects/{id}/brand/extract/{url,image,pdf}` with size caps + sanitize. (14) |
| `ece32c2` Phase 9 | 4 bundled design systems (`linear`, `vercel`, `stripe`, `notion`) under `agentsite/design_systems/<id>/{DESIGN.md, tokens.css}`; `StyleSpec.inherits_from`; pipeline prepends the system's raw_css to the Designer prompt. (11) |
| `27f03b9` Phase 10 | `project_memories` table + `MemoryRepository`; heuristic `extract_memories(brief, steer, verdict)`; pipeline loads top-15 facts at run start, extracts after success, dedupes, persists; `memory_extracted` WS event; `GET/POST/DELETE /api/projects/{id}/memories`. (10) |
| `7a52ab1` Phase 11 | `route_for(agent_key, …)` strategy resolver (`fast`/`cost_optimized`/`balanced`/`quality_first`) + `agent_routing` + `routing_model_pools` settings; lightweight token-overlap RAG over skills + design systems with `kinds` filter + process cache. (11) |
| `2bd1a1c` Phase 12 | `detect_refusal()` heuristic + `pick_fallback_model()`; `refusal_detected` WS event; 6 starter prompt templates + `GET /api/prompt-templates`; `THIRD_PARTY_NOTICES.md` attribution. (9) |

**Post-phase follow-ups:**

| Commit | What |
|---|---|
| `de73b78` | Fix: `user_id` column added to base `SCHEMA_SQL` so fresh DBs match migrated DBs. Unblocked 13 pre-existing test failures. |
| `421e7bd` | Analytics widgets: `QualityRatchetChart` (per-project) + `RefusalRateChart` (from `agent_runs.output_summary`). Pipeline persists refusals on the active AgentRun. |
| `ed556df` | UI mounts: `BrandExtractor`, `MemoryPanel`, `DesignSystemPicker` on `ProjectBrandPage`; `TemplateGallery` on `DashboardPage`. |
| `0ba9653` | RAG made load-bearing: PM gets ranked top-5 skills + top-3 design systems per brief, replacing the hardcoded list in `PM_PERSONA`. |
| `2dcc57d` | `agent_runs.strategy` + `agent_runs.model` columns (additive migration); pipeline stamps each run with the routing strategy that picked its model; `CostByRoutingChart` analytics widget; SQLite-backed `DesignSystemRepository` (user systems survive restarts). |
| `80f7831` | `TodoStream.jsx` consuming `todo_update` WS event; `ChatInput` flips to Steer mode while generating; pipeline emits `todo_update` after Developer completion if it has a `deep_state.todos` snapshot. |
| `5706772` | Device frame SVGs (`iphone-15-pro`, `android-pixel`, `ipad-pro`, `macbook`); `DeviceFrame.jsx` overlay; `DeviceSwitcher` grows 4 frame buttons; `PreviewFrame` drops browser chrome when `frame` is set. |
| `ef2b3bd` | `pyproject.toml` package-data globs so `*.md` / `*.css` / `*.json` ship in a wheel; README gains "Phase 1-12 Feature Flags" reference + 11 new Features subsections. |

The execution log lives in `.plan/PHASED_PLAN.md` (gitignored, local-only).
Every phase has a `## Phase N — DONE` entry with deviations, decisions, and
the commit SHA.

---

## 3. Quickstart for the next session

```bash
# Install (editable + dev/test extras)
pip install -e ".[dev]"

# Backend
agentsite serve --reload          # http://127.0.0.1:6391

# Frontend (separate terminal)
cd frontend && npm install
cd frontend && npm run dev        # http://127.0.0.1:5173 (proxies /api, /ws, /preview)

# Tests
pytest                            # 205 passing, ~15s
ruff check .                      # there are pre-existing warnings; new code is clean

# Lint a specific file
ruff check agentsite/engine/pipeline.py
```

---

## 4. Feature flags worth knowing

`agentsite/config.py` (env prefix `AGENTSITE_`):

```
preflight_enabled = True                # Phase 3
preflight_required_guides = [...]
use_critique_panel = False              # Phase 4 — flip on AFTER configuring agent_routing pools
use_deep_agent_developer = False        # Phase 7 — needs AsyncDeepAgent from prompture source
agent_routing = {                       # Phase 11 — per-agent routing strategy
    "accessibility": "cost_optimized",
    "seo": "cost_optimized",
    "critique_*": "fast"|"cost_optimized"|"balanced"|"quality_first",
}
routing_model_pools = {                 # Strategy -> candidate model id pool
    "fast": [], "cost_optimized": [], "balanced": [], "quality_first": [],
}
```

Per-project: `style_spec.inherits_from`, `style_spec.direction_id`.
Per-generation request: `discovery_brief`, `direction_id`, `inherits_from`,
`agent_models`, `provider_keys`, `max_cost`, `budget_policy`.

---

## 5. WebSocket event types

The `WSEvent.type` field is the contract. Full enum lives in
`agentsite/models.py:WSEvent`. Frontend handlers live in
`frontend/src/hooks/useGeneration.js`.

| Type | Emitted by | Frontend handler |
|---|---|---|
| `phase_start`, `pipeline_plan` | pipeline entry | useGeneration sets agents/parallel groups |
| `agent_start`, `agent_complete`, `agent_error` | per-agent | progress message in chat |
| `agent_thinking`, `agent_step`, `agent_iteration` | streaming callbacks | per-agent thinking trace |
| `text_delta`, `tool_start`, `tool_end`, `agent_output` | streaming callbacks | step list |
| `file_written`, `asset_created` | tool callbacks | refresh files list |
| `state_update`, `round_start`, `round_complete` | group callbacks | (unused in UI) |
| `model_fallback`, `budget_exceeded` | budget policy | toast (TODO) |
| **`discovery_brief_submitted`** (P1) | pipeline | (logged) |
| **`critique_verdict`** (P4) | pipeline post-build | (analytics-only today) |
| **`skill_bound`** (P5) | pipeline pre-build | (logged) |
| **`preview_update`** (P6) | `write_file` of *.html | `useGeneration.livePreview` → PreviewFrame srcDoc |
| **`todo_update`** (P7) | post-developer (deep-agent only) | `useGeneration.todos` → TodoStream |
| **`steer_received`, `steer_applied`** (P7) | WS inbound + pipeline drain | (logged) |
| **`memory_extracted`** (P10) | pipeline post-build | (logged) |
| **`refusal_detected`** (P12) | per-agent post-complete | RefusalRateChart on Analytics |

When adding a new event type, append it to the `WSEvent.type` description
string in `agentsite/models.py` so the contract stays self-documenting.

---

## 6. The golden flow you should test in a browser

Backend tests cover unit-level behavior but the UI flow only works end-to-end
in a real browser. Walk through this once:

1. Start backend + frontend dev servers (see Quickstart).
2. Open `http://localhost:5173`. Click **Create New Project** → use a
   template card from the gallery to prefill, OR type a fresh brief.
3. Navigate to the new project → click **Build** on a page. The
   **DiscoveryForm** should pop in chat. Submit it.
4. If you picked `brand: pick_direction`, the **DirectionPicker** should
   appear next. Pick one.
5. Generation runs. You should see:
   - PM, Designer (only if you didn't pick a direction), Developer agents
     in the progress card
   - The preview iframe updates live (srcdoc) as the developer writes
     HTML
   - A `● live` indicator in the chrome corner
6. Mid-flight, type something in the chat — the Send button should be
   labelled **Steer** with a lightning icon. Send it; you should see a
   `steer_applied` event in the network tab.
7. After completion, the preview swaps to the static URL.
8. Go to the project's **Brand** page. The `BrandExtractor`,
   `DesignSystemPicker`, and `MemoryPanel` should be visible.
9. Pick a design system → it sets `inherits_from` on the project.
10. Run another generation. The PM now sees the prior `MemoryFacts` block
    + the inherited design system in the Designer prompt.
11. Open **Analytics**. `QualityRatchetChart` and `RefusalRateChart` and
    `CostByRoutingChart` should populate (the ratchet only populates when
    `use_critique_panel=True`).
12. Try the device frames: in PageBuilder, click an Apple / Android /
    iPad / MacBook button in the DeviceSwitcher. The preview should be
    wrapped in the SVG device chrome.

---

## 7. Known follow-ups (not required for ship, but easy wins)

- **Cost-by-routing per-agent breakdown** — the chart aggregates by strategy;
  could add a drilldown showing which agent burned the most cost on each
  strategy. (~15 minutes.)
- **TodoStream live updates mid-run** — today todos only update at developer
  completion. To stream every `write_todos` call, hook
  `agent.callbacks.on_tool_end` for `write_todos` and emit incrementally.
  Requires Prompture's `AsyncDeepAgent` to be installed (currently only in
  the source repo — `pip install -e C:/Users/Juan/Documents/GitHub/prompture`
  upgrades the installed copy).
- **More bundled design systems** — currently 4 of the planned 10-12 (Linear,
  Vercel, Stripe, Notion). Adding more is data-only: drop a new
  `agentsite/design_systems/<id>/{DESIGN.md, tokens.css}` pair and it
  auto-appears in the picker. Good next additions: Supabase, Anthropic, Cal,
  Discord, Arc, Cursor.
- **`components.html` per design system** — the plan mentioned shipping
  components.html alongside DESIGN.md + tokens.css. Tokens + voice are
  load-bearing today; component examples would tighten visual fidelity.
- **ChromaDB-backed RAG** — `agentsite/engine/rag_index.py` has a
  backend-agnostic surface. Swap the `_get_entries` token-overlap pipeline
  for `prompture.rag.RAGPipeline` + `ChromaVectorStore` once the catalogs
  exceed ~50 entries.
- **Per-agent refusal-aware fallback retry** — `engine/refusal.py` ships
  `pick_fallback_model()`. The hook would be: when `refusal_detected` fires,
  reschedule the agent with the next model from `settings.budget_fallback_models`
  before continuing the pipeline. Today refusals are logged, not retried.
- **Unify the storage `_old_projects` migration** — the schema fix in
  `de73b78` is correct but the migration code path has accumulated several
  `ALTER TABLE`s. A clean SQL migrations directory (per the plan's "Migration"
  cross-cutting concern) would be friendlier.

---

## 8. Files a fresh-context agent should read first

When picking up this codebase, read in this order:

1. `CLAUDE.md` — project conventions, working-cross-repo policy.
2. `README.md` — user-facing tour + the feature-flag reference table.
3. `.plan/PHASED_PLAN.md` (local only — git-ignored) — phase plan with DONE
   entries per phase. The truth source for what shipped and why.
4. `agentsite/engine/pipeline.py` — `GenerationPipeline.generate()` is the
   sequential brain. All other phases hook into it.
5. `agentsite/models.py` — every domain model + the `WSEvent.type` enum.
6. `agentsite/config.py` — the full Settings surface (feature flags).
7. `agentsite/agents/personas.py` — every agent's system prompt.
8. `agentsite/agents/orchestrator.py` — `create_dynamic_pipeline()` and
   `create_specialist_pipeline()` (developer/reviewer loop shapes).
9. `frontend/src/pages/PageBuilderPage.jsx` — the largest end-to-end UI
   wiring (chat ↔ generation ↔ preview).
10. `agentsite/THIRD_PARTY_NOTICES.md` — attribution + porting notes from
    Open Design.

---

## 9. Don't repeat my mistakes

A few things that bit me along the way; future-you should remember:

- `aiosqlite.Row` doesn't support `"col" in row`. Use
  `row.keys()` or wrap in try/except when reading optional columns.
- Adding a column requires updating BOTH `SCHEMA_SQL` (for fresh DBs) AND
  `_migrate()` (for existing DBs). Forgetting `SCHEMA_SQL` was the cause of
  `de73b78`.
- `TestClient(create_app())` skips the FastAPI lifespan. Use
  `with TestClient(create_app()) as client:` when your test hits a route
  that depends on a DB-backed repository.
- The plan file `.plan/PHASED_PLAN.md` is git-ignored locally. Don't try to
  commit it — the README + this ONBOARDING + the per-phase commit messages
  are the durable record.
- Prompture in `site-packages` lags behind the source repo. When a
  primitive you need from the source repo isn't installed, gracefully fall
  back (see `create_developer_deep_agent`) rather than crashing.
