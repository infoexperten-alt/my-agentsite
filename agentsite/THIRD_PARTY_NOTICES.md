# Third-Party Notices

AgentSite incorporates content ported from open-source projects. This file
records the attributions; the upstream projects retain their own licenses.

## Open Design — Apache-2.0

Source: <https://github.com/dottxt-ai/open-design> (`apps/daemon`, `skills/`,
`design-systems/`, `prompt-templates/`, `assets/frames/`).

Ported into AgentSite:

- **Phase 1** — Discovery form JSON shape (`agentsite/agents/discovery.py`)
  derived from `apps/daemon/src/prompts/discovery.ts`. Stable `value` keys
  (`pick_direction`, `brand_spec`, `reference_match`) preserved verbatim so
  downstream routing remains compatible.
- **Phase 2** — Five `DesignDirection` entries in
  `agentsite/agents/directions.py` with palette OKLch values, font stacks,
  and posture cues copied verbatim from
  `apps/daemon/src/prompts/directions.ts`:
  `editorial-monocle`, `modern-minimal`, `human-approachable`,
  `tech-utility`, `brutalist-experimental`.
- **Phase 4** — Multi-dimensional critique pattern + ratchet semantics
  ("only-up", per-dimension floors, accept iff every dimension meets floor)
  derived from `apps/daemon/src/critique/{orchestrator,conformance,ratchet,scoreboard}.ts`.
  AgentSite reimplements in Python on top of Prompture's `AsyncDebateGroup`;
  no source files copied directly.
- **Phase 5** — Skill catalog frontmatter shape and selected skill bodies
  modeled after `apps/daemon/src/skills.ts` and `skills/*/SKILL.md`. The
  eight bundled AgentSite skills (`saas-landing`, `pricing-page`,
  `dashboard`, `docs-page`, `blog-post`, `portfolio`, `mobile-app`,
  `coming-soon`) are AgentSite-authored using the OD pattern; they are not
  verbatim ports.
- **Phase 7** — Steer / interrupt protocol shape derived from
  `apps/daemon/src/critique/interrupt-handler.ts`. AgentSite uses an
  asyncio Queue mailbox model; no source files copied.
- **Phase 8** — SSRF guard pattern in `agentsite/api/deps.py::guard_external_url`
  modeled after `apps/daemon/src/origin-validation.ts`.

Open Design is © its authors and licensed under Apache-2.0. See the upstream
repository for the full license text.

## Prompture — owned by the AgentSite author

`prompture` (<https://github.com/jhd3197/prompture>) ships AgentSite's core
primitives (Agent, AsyncAgent, AsyncSequentialGroup, AsyncLoopGroup,
ParallelGroup, AsyncDebateGroup, Persona, ToolRegistry, SkillInfo, RAGPipeline,
ingestion, security, refusal, model routing). AgentSite depends on it as a
first-class library; both repositories share an author. Bug fixes for
Prompture issues encountered while developing AgentSite are made directly in
the Prompture repo per the project's contribution policy.
