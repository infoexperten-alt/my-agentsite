<div align="center">

# AgentSite

**AI-Powered Website Builder using Multi-Agent Orchestration**

[![Python 3.10+](https://img.shields.io/badge/python-3.10%2B-3776ab?style=flat-square&logo=python&logoColor=white)](https://www.python.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)
[![Built with Prompture](https://img.shields.io/badge/built%20with-Prompture-blueviolet?style=flat-square)](https://pypi.org/project/prompture/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Code style: ruff](https://img.shields.io/badge/code%20style-ruff-000000?style=flat-square)](https://github.com/astral-sh/ruff)

Generate complete, production-ready websites from a single text prompt.<br>
Four specialized AI agents collaborate to **plan**, **design**, **build**, and **review** your site.

---

</div>

## How It Works

```
Prompt ──> PM Agent ──> Designer Agent ──> Developer Agent ──> Reviewer Agent ──> Website
           (plan)       (style)           (code)              (QA)
```

| Agent | Role | Output |
|:------|:-----|:-------|
| **PM** | Analyzes prompt, plans site structure and build order | `SitePlan` |
| **Designer** | Defines colors, typography, spacing, and visual system | `StyleSpec` |
| **Developer** | Writes semantic HTML, CSS, and vanilla JS for each page | `PageOutput` |
| **Reviewer** | Evaluates quality, accessibility, and correctness | `ReviewFeedback` |

The reviewer can trigger revision loops, sending feedback back to the developer until quality meets the approval threshold.

## Features

- **Multi-agent pipeline** &mdash; four agents with distinct personas coordinate through [Prompture](https://pypi.org/project/prompture/) groups
- **Real-time progress** &mdash; WebSocket-based live updates during generation
- **Web UI** &mdash; browser interface with live preview, chat input, style controls, and usage dashboard
- **CLI** &mdash; generate sites directly from the terminal
- **Multi-provider LLM support** &mdash; OpenAI, Claude, Google, Groq, Grok, Ollama, LM Studio, OpenRouter, and more
- **Export** &mdash; download generated sites as ZIP archives
- **Accessible output** &mdash; agents enforce WCAG AA contrast, semantic HTML, ARIA labels, and keyboard navigation

## Quick Start

### Installation

```bash
pip install -e ".[dev]"
```

### Configuration

```bash
cp .env.copy .env
# Edit .env with your API keys
```

### Generate from the CLI

```bash
agentsite generate "A portfolio website for a photographer"
```

### Start the Web UI

```bash
agentsite serve
# Open http://127.0.0.1:8000
```

## CLI Reference

```bash
agentsite generate <prompt>       # Generate a website from a text prompt
  -m, --model <provider/model>    # LLM model to use (default: from settings)
  -o, --output <dir>              # Output directory
  -n, --name <name>               # Project name

agentsite serve                   # Start the web UI server
  --host <host>                   # Server host (default: 127.0.0.1)
  --port <port>                   # Server port (default: 8000)
  --reload                        # Enable auto-reload for development

agentsite models                  # List available LLM models
```

## Configuration

| Variable | Description | Default |
|:---------|:------------|:--------|
| `AGENTSITE_DEFAULT_MODEL` | LLM model for all agents | `openai/gpt-4o` |
| `AGENTSITE_DATA_DIR` | Project storage directory | `~/.agentsite` |
| `AGENTSITE_HOST` | Server bind address | `127.0.0.1` |
| `AGENTSITE_PORT` | Server port | `8000` |

Provider API keys (`OPENAI_API_KEY`, `CLAUDE_API_KEY`, `GOOGLE_API_KEY`, etc.) are inherited from [Prompture's configuration](https://pypi.org/project/prompture/).

## Project Structure

```
agentsite/
  agents/            # Agent factories, Prompture Personas, orchestration
    personas.py      # PM, Designer, Developer, Reviewer persona definitions
    orchestrator.py  # Pipeline wiring and group configuration
  api/               # FastAPI application
    routes/          # REST endpoints (projects, generate, models, assets, preview)
    websocket.py     # WebSocket manager for real-time progress
    app.py           # Application factory with CORS and lifespan
  engine/            # Core generation logic
    pipeline.py      # Orchestrates agents, handles file output and events
    project_manager.py  # Filesystem operations for project directories
    asset_handler.py    # Image upload and asset management
  storage/           # Persistence layer
    database.py      # Async SQLite via aiosqlite
    repository.py    # CRUD operations for projects and generations
  cli.py             # Click CLI entry point
  config.py          # Pydantic-settings (env vars, defaults)
  models.py          # Domain models (SitePlan, StyleSpec, PageOutput, etc.)
frontend/            # Browser UI (vanilla JS, no build step)
tests/               # pytest test suite
```

## Tech Stack

| Layer | Technology |
|:------|:-----------|
| Agent orchestration | [Prompture](https://pypi.org/project/prompture/) (Agents, Personas, Groups) |
| API server | [FastAPI](https://fastapi.tiangolo.com) + [Uvicorn](https://www.uvicorn.org) |
| Database | SQLite via [aiosqlite](https://github.com/omnilib/aiosqlite) |
| CLI | [Click](https://click.palletsprojects.com) |
| Config | [Pydantic Settings](https://docs.pydantic.dev/latest/concepts/pydantic_settings/) |
| Frontend | Vanilla JavaScript (no framework, no build step) |
| Linting | [Ruff](https://github.com/astral-sh/ruff) |

## Development

```bash
# Install with dev + test extras
pip install -e ".[dev]"

# Run tests
pytest

# Run tests with verbose output
pytest -v

# Lint
ruff check .

# Format
ruff format .
```

## License

[MIT](LICENSE)

---

<div align="center">

Built by [Juan Denis](mailto:juan@vene.co)

</div>
