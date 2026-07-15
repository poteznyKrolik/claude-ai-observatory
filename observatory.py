#!/usr/bin/env python3
"""Claude AI Observatory — CLI Wrapper

Complete observability suite for Claude Code and LLM inference.
"""

import subprocess
from pathlib import Path
from typing import Optional, List
from dataclasses import dataclass
import typer
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
import json

app = typer.Typer(
    help="Claude AI Observatory — Complete observability suite",
    rich_markup_mode="rich",
)

console = Console()


@dataclass
class Service:
    name: str
    container: str
    type: str
    port: int
    description: str


# Service registry
SERVICES = {
    "transcripts": Service("Claude Transcripts", "claude-transcripts", "analytics", 8765, "HTML transcript generator"),
    "codeburn": Service("CodeBurn", "codeburn", "analytics", 4747, "Spending breakdown by task/tool/model"),
    "tokdash": Service("Tokdash", "tokdash-claude", "analytics", 55423, "Token usage dashboard"),
    "dashboard": Service("Claude Dashboard", "claude-dashboard", "monitoring", 5173, "Full observability UI"),
    "agent-monitor": Service("Agent Monitor", "claude-agent-monitor", "monitoring", 4820, "Real-time agent tracking"),
    "observer": Service("AI Observer", "ai-observer", "monitoring", 8080, "Real-time observability platform"),
    "chatgpt": Service("ChatGPT Extractor", "chatgpt-extractor", "integrations", 5000, "Extract ChatGPT conversations"),
}

PRESETS = {
    "all": list(SERVICES.keys()),
    "analytics": ["transcripts", "codeburn", "tokdash"],
    "monitoring": ["dashboard", "agent-monitor", "observer"],
    "transcripts": ["transcripts"],
    "integrations": ["chatgpt"],
}

PROJECT_ROOT = Path(__file__).parent


class DockerCompose:
    def __init__(self, project_dir: Path):
        self.project_dir = project_dir
        self.compose_file = project_dir / "docker-compose.yml"

    def _run(self, *args: str, check: bool = True) -> subprocess.CompletedProcess:
        cmd = ["docker", "compose", "-f", str(self.compose_file)] + list(args)
        return subprocess.run(cmd, cwd=self.project_dir, check=check, capture_output=False)

    def up(self, services: Optional[List[str]] = None, build: bool = False) -> None:
        args = ["up", "-d"]
        if build:
            args.append("--build")
        if services:
            args.extend(services)
        self._run(*args)

    def down(self, remove_volumes: bool = False) -> None:
        args = ["down"]
        if remove_volumes:
            args.append("-v")
        self._run(*args)

    def ps(self) -> subprocess.CompletedProcess:
        return self._run("ps", "--all")

    def logs(self, service: Optional[str] = None, follow: bool = False, tail: int = 100) -> None:
        args = ["logs", f"--tail={tail}"]
        if follow:
            args.append("-f")
        if service:
            args.append(service)
        self._run(*args, check=False)

    def restart(self, services: Optional[List[str]] = None) -> None:
        args = ["restart"]
        if services:
            args.extend(services)
        self._run(*args)

    def stop(self, services: Optional[List[str]] = None) -> None:
        args = ["stop"]
        if services:
            args.extend(services)
        self._run(*args)


@app.command()
def status() -> None:
    """Show status of all services."""
    docker = DockerCompose(PROJECT_ROOT)
    console.print("[bold cyan]🔍 Service Status[/bold cyan]\n")
    docker.ps()


@app.command()
def start(
    services: Optional[List[str]] = typer.Argument(None),
    build: bool = typer.Option(False, "--build", help="Rebuild images"),
    preset: Optional[str] = typer.Option(None, "--preset", help="Start preset (all, analytics, monitoring, etc)"),
) -> None:
    """Start services."""
    docker = DockerCompose(PROJECT_ROOT)

    svc_list = None
    if preset:
        if preset not in PRESETS:
            console.print(f"[red]✗ Unknown preset: {preset}[/red]")
            raise typer.Exit(1)
        svc_list = PRESETS[preset]
    elif services:
        svc_list = services

    if svc_list:
        console.print(f"[cyan]Starting services: {', '.join(svc_list)}[/cyan]")
        containers = [SERVICES[s].container for s in svc_list if s in SERVICES]
        docker.up(containers, build=build)
    else:
        console.print("[cyan]Starting all services[/cyan]")
        docker.up(build=build)

    console.print("\n[bold green]✓ Services started[/bold green]")
    _show_endpoints(svc_list)


@app.command()
def stop(services: Optional[List[str]] = typer.Argument(None)) -> None:
    """Stop services."""
    docker = DockerCompose(PROJECT_ROOT)

    if services:
        containers = [SERVICES[s].container for s in services if s in SERVICES]
        console.print(f"[cyan]Stopping: {', '.join(containers)}[/cyan]")
        docker.stop(containers)
    else:
        console.print("[cyan]Stopping all services[/cyan]")
        docker.stop()

    console.print("[bold green]✓ Services stopped[/bold green]")


@app.command()
def down(remove_volumes: bool = typer.Option(False, "-v", "--remove-volumes")) -> None:
    """Stop and remove containers."""
    docker = DockerCompose(PROJECT_ROOT)
    docker.down(remove_volumes=remove_volumes)
    console.print("[bold green]✓ Services removed[/bold green]")


@app.command()
def logs(
    service: Optional[str] = typer.Argument(None),
    follow: bool = typer.Option(False, "-f", "--follow"),
    tail: int = typer.Option(100, "--tail"),
) -> None:
    """Show service logs."""
    docker = DockerCompose(PROJECT_ROOT)
    container = SERVICES[service].container if service and service in SERVICES else None
    docker.logs(container, follow=follow, tail=tail)


@app.command()
def restart(services: Optional[List[str]] = typer.Argument(None)) -> None:
    """Restart services."""
    docker = DockerCompose(PROJECT_ROOT)
    if services:
        containers = [SERVICES[s].container for s in services if s in SERVICES]
        docker.restart(containers)
    else:
        docker.restart()
    console.print("[bold green]✓ Services restarted[/bold green]")


@app.command()
def ls() -> None:
    """List all available services."""
    table = Table(title="Claude Observatory Services", show_header=True)
    table.add_column("Name", style="cyan")
    table.add_column("Container", style="magenta")
    table.add_column("Type", style="yellow")
    table.add_column("Port", style="green")
    table.add_column("Description")

    for key in sorted(SERVICES.keys()):
        svc = SERVICES[key]
        table.add_row(key, svc.container, svc.type, str(svc.port), svc.description)

    console.print(table)


@app.command()
def endpoints(services: Optional[List[str]] = typer.Argument(None)) -> None:
    """Show service endpoints."""
    _show_endpoints(services)


def _show_endpoints(services: Optional[List[str]] = None) -> None:
    """Display service endpoints."""
    console.print("\n[bold cyan]📊 Service Endpoints[/bold cyan]\n")

    svc_list = services or list(SERVICES.keys())

    table = Table(show_header=True)
    table.add_column("Service", style="cyan")
    table.add_column("Endpoint", style="green")
    table.add_column("Type", style="yellow")

    for key in sorted(svc_list):
        if key not in SERVICES:
            continue
        svc = SERVICES[key]
        endpoint = f"http://127.0.0.1:{svc.port}"
        table.add_row(svc.name, endpoint, svc.type)

    console.print(table)


@app.command()
def presets() -> None:
    """Show available presets."""
    console.print("[bold cyan]🎯 Available Presets[/bold cyan]\n")

    table = Table(show_header=True)
    table.add_column("Preset", style="cyan")
    table.add_column("Services")

    for name, services in PRESETS.items():
        table.add_row(name, ", ".join(services))

    console.print(table)


@app.command()
def info(service: str = typer.Argument(...)) -> None:
    """Show detailed service information."""
    if service not in SERVICES:
        console.print(f"[red]✗ Unknown service: {service}[/red]")
        raise typer.Exit(1)

    svc = SERVICES[service]

    info_text = f"""
[bold cyan]{svc.name}[/bold cyan]

[yellow]Container:[/yellow] {svc.container}
[yellow]Type:[/yellow] {svc.type}
[yellow]Port:[/yellow] {svc.port}
[yellow]Endpoint:[/yellow] http://127.0.0.1:{svc.port}

[yellow]Description:[/yellow]
{svc.description}
"""

    console.print(Panel(info_text.strip(), title="Service Info"))


@app.command()
def health() -> None:
    """Check health of services."""
    try:
        import requests
    except ImportError:
        console.print("[red]✗ requests library not installed[/red]")
        console.print("Install: uv pip install requests")
        raise typer.Exit(1)

    console.print("[bold cyan]💚 Health Check[/bold cyan]\n")

    table = Table(show_header=True)
    table.add_column("Service", style="cyan")
    table.add_column("Health", justify="center")
    table.add_column("Response")

    for key in sorted(SERVICES.keys()):
        svc = SERVICES[key]
        endpoint = f"http://127.0.0.1:{svc.port}/health"

        try:
            resp = requests.get(endpoint, timeout=2)
            status = "✅" if resp.status_code == 200 else "❌"
            try:
                body = resp.json().get("status", "ok")[:30]
            except:
                body = "ok"[:30]
        except Exception as e:
            status = "⚠️"
            body = str(e)[:30]

        table.add_row(svc.name, status, body)

    console.print(table)


if __name__ == "__main__":
    app()
