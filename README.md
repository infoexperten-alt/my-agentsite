# AgentSite

[![PyPI version](https://badge.fury.io/py/agentsite.svg)](https://badge.fury.io/py/agentsite)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![Built with Prompture](https://img.shields.io/badge/built%20with-Prompture-blueviolet)](https://pypi.org/project/prompture/)

An AI-powered website builder that uses multi-agent orchestration to generate complete, production-ready websites from a single text prompt.

**PyPI Package:** [pypi.org/project/agentsite](https://pypi.org/project/agentsite/)

---

## Why This Tool?

Most AI website builders give you a single LLM call that dumps out a generic template. The result is usually a wall of code with no real structure, inconsistent styling, and no quality checks. You end up spending more time fixing the output than you saved by generating it.

AgentSite takes a different approach: **four specialized AI agents collaborate in a pipeline**, each handling what they're best at. A PM agent plans the site structure. A Designer agent defines the visual system. A Developer agent writes the actual code. A Reviewer agent evaluates quality and can send work back for revision — just like a real team would.

The entire pipeline is **model-agnostic**. You can use OpenAI, Claude, Google, Groq, Ollama, LM Studio, or any provider supported by [Prompture](https://pypi.org/project/prompture/). Swap models without changing anything else.

You get **two ways to work**: a full Web UI with live preview, chat input, and real-time progress tracking — or a CLI for generating sites directly from the terminal. Both produce the same output: clean, semantic HTML with proper accessibility baked in.

Under the hood, the pipeline enforces **quality gates**. The Reviewer agent scores every page against criteria like accessibility, semantic markup, and visual consistency. If the score is too low, the Developer gets feedback and iterates — up to two revision loops — before the site is finalized.

---

## Table of Contents

- [Quick Start](#quick-start)
- [How It Works](#how-it-works)
- [Features](#features)
- [CLI Reference](#cli-reference)
- [Web UI](#web-ui)
- [Configuration](#configuration)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

---

## Quick Start

```bash
# 1. Install from PyPI
pip install agentsite

# 2. Set up your API keys
cp .env.copy .env
# Edit .env with your provider keys (OPENAI_API_KEY, CLAUDE_API_KEY, etc.)

# 3. Generate a website
agentsite generate "A portfolio website for a photographer"
```

**That's it!** A complete multi-page website will be generated in your output directory.

**Prefer a UI?** Launch the web interface instead:

```bash
agentsite serve
# Open http://127.0.0.1:6391
```

---

## How It Works

```
Prompt --> PM Agent --> Designer Agent --> Developer Agent <--> Reviewer Agent --> Website
          (plan)       (style)            (code)               (QA)
```

| Agent | Role | Output |
| --- | --- | --- |
| **PM** | Analyzes the prompt, plans site structure and page hierarchy | `SitePlan` |
| **Designer** | Defines colors, typography, spacing, and the visual system | `StyleSpec` |
| **Developer** | Writes semantic HTML, CSS, and vanilla JS for each page | `PageOutput` |
| **Reviewer** | Evaluates quality, accessibility, and correctness (score >= 7 = approved) | `ReviewFeedback` |

The Reviewer can trigger revision loops, sending feedback back to the Developer until quality meets the approval threshold. This runs up to two iterations per page.

---

## Features

### Multi-Agent Pipeline

Four agents with distinct personas coordinate through [Prompture](https://pypi.org/project/prompture/) groups. Each agent has a focused role and structured output — no single monolithic prompt trying to do everything.

### Real-Time Progress

WebSocket-based live updates during generation. Watch each agent work in real time through the Web UI with per-agent status, token usage, and timing.

### Multi-Provider LLM Support

Use any model from any provider: OpenAI, Claude, Google, Groq, Grok, Ollama, LM Studio, OpenRouter, and more. Switch models per-generation without changing configuration.

### Accessible Output

Agents enforce WCAG AA contrast, semantic HTML, ARIA labels, and keyboard navigation. Accessibility is built into the generation pipeline, not bolted on after.

### Export

Download generated sites as ZIP archives or browse them directly through the built-in preview server.

---

## CLI Reference

```bash
agentsite generate <prompt>       # Generate a website from a text prompt
  -m, --model <provider/model>    # LLM model to use (default: openai/gpt-4o)
  -o, --output <dir>              # Output directory
  -n, --name <name>               # Project name

agentsite serve                   # Start the web UI server
  --host <host>                   # Server host (default: 127.0.0.1)
  --port <port>                   # Server port (default: 6391)
  --reload                        # Enable auto-reload for development

agentsite models                  # List available LLM models
```

---

## Web UI

Launch the browser-based interface for a full visual experience:

```bash
agentsite serve
```

The Web UI includes:

- **Dashboard** — manage projects, create new sites
- **Page Builder** — chat-based generation with live preview
- **Agent Monitoring** — see each agent's status, metrics, and activity
- **Analytics** — token usage, cost breakdown, and generation history

For development, run the backend and frontend separately with hot-reload:

```bash
# Terminal 1: Backend
agentsite serve --reload

# Terminal 2: Frontend (Vite dev server)
cd frontend && npm run dev
```

---

## Configuration

| Variable | Description | Default |
| --- | --- | --- |
| `AGENTSITE_DEFAULT_MODEL` | LLM model for all agents | `openai/gpt-4o` |
| `AGENTSITE_DATA_DIR` | Project storage directory | `~/.agentsite` |
| `AGENTSITE_HOST` | Server bind address | `127.0.0.1` |
| `AGENTSITE_PORT` | Server port | `6391` |

Provider API keys (`OPENAI_API_KEY`, `CLAUDE_API_KEY`, `GOOGLE_API_KEY`, etc.) are inherited from [Prompture's configuration](https://pypi.org/project/prompture/).

---

## Project Structure

```
agentsite/
  agents/            # Agent factories, Prompture personas, orchestration
    personas.py      # PM, Designer, Developer, Reviewer persona definitions
    orchestrator.py  # Pipeline wiring and group configuration
  api/               # FastAPI application
    routes/          # REST endpoints (projects, generate, models, assets, preview)
    websocket.py     # WebSocket manager for real-time progress
  engine/            # Core generation logic
    pipeline.py      # Orchestrates agents, handles file output and events
  storage/           # Persistence layer
    database.py      # Async SQLite via aiosqlite
    repository.py    # CRUD operations for projects and generations
  cli.py             # Click CLI entry point
  config.py          # Pydantic-settings (env vars, defaults)
  models.py          # Domain models (SitePlan, StyleSpec, PageOutput, etc.)
frontend/            # React 19 + Vite 6 + Tailwind CSS 4 SPA
tests/               # pytest test suite
```

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Agent orchestration | [Prompture](https://pypi.org/project/prompture/) |
| API server | [FastAPI](https://fastapi.tiangolo.com) + [Uvicorn](https://www.uvicorn.org) |
| Database | SQLite via [aiosqlite](https://github.com/omnilib/aiosqlite) |
| CLI | [Click](https://click.palletsprojects.com) |
| Config | [Pydantic Settings](https://docs.pydantic.dev/latest/concepts/pydantic_settings/) |
| Frontend | React 19 + Vite 6 + Tailwind CSS 4 |
| Linting | [Ruff](https://github.com/astral-sh/ruff) |

---

## Development

```bash
# Install with dev + test extras
pip install -e ".[dev]"

# Run tests
pytest

# Lint
ruff check .

# Format
ruff format .

# Build frontend
cd frontend && npm install && npm run build
```

---

## Troubleshooting

### Common Issues

**Generation fails immediately?**

- Check that your `.env` has valid API keys for the provider you're using
- Run `agentsite models` to verify your provider is reachable

**Empty or broken output?**

- Try a different model — some smaller models struggle with structured output
- Check the Reviewer feedback in the Web UI for specific issues

**Frontend not loading?**

- Make sure you've built the frontend: `cd frontend && npm run build`
- For development, run `npm run dev` separately on port 5173

**WebSocket disconnects?**

- The generation is still running server-side — refresh the page to reconnect
- Check the terminal output for any backend errors

---

## Contributing

Contributions welcome! Here's how:

1. **Report bugs** — [GitHub Issues](https://github.com/jhd3197/AgentSite/issues)
2. **Improve docs** — PRs for documentation improvements
3. **Submit PRs** — Bug fixes and features
4. **Add providers** — Extend LLM provider support via Prompture

---

## License

This project is licensed under the **MIT License**.
See the [LICENSE](LICENSE) file for full details.

---

## Get Help

- **PyPI Package** — [pypi.org/project/agentsite](https://pypi.org/project/agentsite/)
- **Issues** — [GitHub Issues](https://github.com/jhd3197/AgentSite/issues)
- **Prompture** — [pypi.org/project/prompture](https://pypi.org/project/prompture/)

---

**Built by [Juan Denis](mailto:juan@vene.co)**
