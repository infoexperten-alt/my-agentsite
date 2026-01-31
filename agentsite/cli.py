"""AgentSite CLI — serve the web UI or generate sites from the command line."""

from __future__ import annotations

import json
import sys

import click

from .config import settings


@click.group()
@click.version_option(version="0.1.0", prog_name="agentsite")
def cli():
    """AgentSite — AI-Powered Website Builder."""
    pass


@cli.command()
@click.option("--host", default=None, help="Server host (default: from settings)")
@click.option("--port", default=None, type=int, help="Server port (default: from settings)")
@click.option("--reload", is_flag=True, help="Enable auto-reload for development")
def serve(host: str | None, port: int | None, reload: bool):
    """Start the AgentSite web UI server."""
    import uvicorn

    settings.ensure_dirs()
    uvicorn.run(
        "agentsite.api.app:create_app",
        factory=True,
        host=host or settings.host,
        port=port or settings.port,
        reload=reload,
    )


@cli.command()
@click.argument("prompt")
@click.option("--model", "-m", default=None, help="Model to use (provider/model)")
@click.option("--output", "-o", default=None, help="Output directory")
@click.option("--name", "-n", default=None, help="Project name")
def generate(prompt: str, model: str | None, output: str | None, name: str | None):
    """Generate a website from a text prompt.

    Example: agentsite generate "A portfolio website for a photographer"
    """
    from pathlib import Path

    from .engine.pipeline import GenerationPipeline
    from .engine.project_manager import ProjectManager
    from .models import Project

    settings.ensure_dirs()

    effective_model = model or settings.default_model
    project_name = name or prompt[:50].strip()

    click.echo(f"Generating: {project_name}")
    click.echo(f"Model: {effective_model}")
    click.echo()

    # Create project
    if output:
        pm = ProjectManager(base_dir=Path(output).parent)
    else:
        pm = ProjectManager()

    project = Project(name=project_name, prompt=prompt, model=effective_model)

    if output:
        # Override project dir if custom output
        from pathlib import Path as P

        out_path = P(output)
        out_path.mkdir(parents=True, exist_ok=True)
        project.id = out_path.name

    pm.create(project)

    # Progress callback
    def _on_event(event):
        if event.type == "agent_start":
            click.echo(f"  [{event.agent}] Starting...")
        elif event.type == "agent_complete":
            click.echo(f"  [{event.agent}] Complete")
        elif event.type == "file_written":
            path = event.data.get("path", "")
            click.echo(f"  Written: {path}")
        elif event.type == "error":
            msg = event.data.get("message", "Unknown error")
            click.secho(f"  Error: {msg}", fg="red")
        elif event.type == "generation_complete":
            files = event.data.get("files", [])
            click.echo()
            click.secho(f"Done! Generated {len(files)} file(s)", fg="green")

    pipeline = GenerationPipeline(pm, on_event=_on_event)

    try:
        result = pipeline.generate(project)
        project_dir = pm.project_dir(project.id)
        site_dir = pm.site_dir(project.id)

        click.echo()
        click.echo(f"Output: {site_dir}")

        files = pm.list_site_files(project.id)
        if files:
            click.echo("Files:")
            for f in files:
                click.echo(f"  {f}")

        usage = result.aggregate_usage
        if usage:
            tokens = usage.get("total_tokens", 0)
            cost = usage.get("total_cost", 0.0)
            click.echo(f"\nUsage: {tokens:,} tokens, ${cost:.4f}")

    except Exception as exc:
        click.secho(f"\nGeneration failed: {exc}", fg="red")
        sys.exit(1)


@cli.command("models")
def list_models():
    """List available LLM models from configured providers."""
    try:
        from prompture import get_available_models

        models = get_available_models()
    except Exception as exc:
        click.secho(f"Model discovery failed: {exc}", fg="red")
        sys.exit(1)

    if not models:
        click.echo("No models found. Check your .env configuration.")
        return

    click.echo(f"Found {len(models)} model(s):\n")
    for m in models:
        click.echo(f"  {m}")


if __name__ == "__main__":
    cli()
