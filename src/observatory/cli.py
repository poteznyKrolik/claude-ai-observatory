"""Main CLI entry point."""

from pathlib import Path
from typing import Optional, List
import typer
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

from .config import SERVICES, PRESETS, ServiceType
from .docker import DockerCompose

app = typer.Typer(
    help="Claude AI Observatory — Complete observability suite for Claude Code and LLM inference",
    rich_markup_mode="rich",
)

console = Console()

# Get project root
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent


@app.callback(invoke_without_command=True)
def main(ctx: typer.Context, version: bool = typer.Option(None, "--version", help="Show version")) -> None:
    """Claude AI Observatory CLI."""
    if version:
        console.print("[cyan]Claude Observatory v0.1.0[/cyan]")
        raise typer.Exit()


@app.command()
def status() -> None:
    """Show status of all services."""
    docker = DockerCompose(PROJECT_ROOT)
    console.print("[bold cyan]🔍 Service Status[/bold cyan]\n")
    docker.ps()


@app.command()
def start(
    services: Optional[List[str]] = typer.Argument(None, help="Services to start (or preset: all, analytics, monitoring)"),
    build: bool = typer.Option(False, "--build", help="Rebuild images"),
    preset: Optional[str] = typer.Option(None, "--preset", help="Start preset (all, analytics, monitoring, transcripts, integrations)"),
) -> None:
    """Start services."""
    docker = DockerCompose(PROJECT_ROOT)

    # Resolve preset
    svc_list = None
    if preset:
        if preset not in PRESETS:
            console.print(f"[red]✗ Unknown preset: {preset}[/red]")
            console.print(f"Available: {', '.join(PRESETS.keys())}")
            raise typer.Exit(1)
        svc_list = PRESETS[preset]
    elif services:
        svc_list = services

    if svc_list:
        console.print(f"[cyan]Starting services: {', '.join(svc_list)}[/cyan]")
        # Map short names to container names
        containers = [SERVICES[s].container for s in svc_list if s in SERVICES]
        docker.up(containers, build=build)
    else:
        console.print("[cyan]Starting all services[/cyan]")
        docker.up(build=build)

    console.print("\n[bold green]✓ Services started[/bold green]")
    _show_endpoints(svc_list)


@app.command()
def stop(services: Optional[List[str]] = typer.Argument(None, help="Services to stop")) -> None:
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
def down(remove_volumes: bool = typer.Option(False, "-v", "--remove-volumes", help="Remove volumes")) -> None:
    """Stop and remove containers."""
    docker = DockerCompose(PROJECT_ROOT)

    if remove_volumes:
        console.print("[yellow]⚠ Removing volumes (data will be deleted)[/yellow]")
    else:
        console.print("[cyan]Stopping services (keeping volumes)[/cyan]")

    docker.down(remove_volumes=remove_volumes)
    console.print("[bold green]✓ Services removed[/bold green]")


@app.command()
def logs(
    service: Optional[str] = typer.Argument(None, help="Service to show logs for"),
    follow: bool = typer.Option(False, "-f", "--follow", help="Follow logs"),
    tail: int = typer.Option(100, "--tail", help="Number of lines"),
) -> None:
    """Show service logs."""
    docker = DockerCompose(PROJECT_ROOT)

    if service and service not in SERVICES:
        console.print(f"[red]✗ Unknown service: {service}[/red]")
        console.print(f"Available: {', '.join(SERVICES.keys())}")
        raise typer.Exit(1)

    container = SERVICES[service].container if service else None
    docker.logs(container, follow=follow, tail=tail)


@app.command()
def restart(services: Optional[List[str]] = typer.Argument(None, help="Services to restart")) -> None:
    """Restart services."""
    docker = DockerCompose(PROJECT_ROOT)

    if services:
        containers = [SERVICES[s].container for s in services if s in SERVICES]
        console.print(f"[cyan]Restarting: {', '.join(containers)}[/cyan]")
        docker.restart(containers)
    else:
        console.print("[cyan]Restarting all services[/cyan]")
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
        table.add_row(
            key,
            svc.container,
            svc.type.value,
            f"{svc.port.external}",
            svc.description,
        )

    console.print(table)


@app.command()
def endpoints(services: Optional[List[str]] = typer.Argument(None, help="Services to show endpoints for")) -> None:
    """Show service endpoints."""
    _show_endpoints(services)


def _show_endpoints(services: Optional[List[str]] = None) -> None:
    """Display service endpoints."""
    console.print("\n[bold cyan]📊 Service Endpoints[/bold cyan]\n")

    svc_list = services or list(SERVICES.keys())

    table = Table(show_header=True)
    table.add_column("Service", style="cyan")
    table.add_column("Endpoint", style="green")
    table.add_column("Status", justify="center")

    for key in sorted(svc_list):
        if key not in SERVICES:
            continue
        svc = SERVICES[key]
        endpoint = f"http://127.0.0.1:{svc.port.external}"
        table.add_row(
            svc.name,
            endpoint,
            "🚀",
        )

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
def info(service: str = typer.Argument(..., help="Service to show info for")) -> None:
    """Show detailed service information."""
    if service not in SERVICES:
        console.print(f"[red]✗ Unknown service: {service}[/red]")
        console.print(f"Available: {', '.join(sorted(SERVICES.keys()))}")
        raise typer.Exit(1)

    svc = SERVICES[service]

    info_text = f"""
[bold cyan]{svc.name}[/bold cyan]

[yellow]Container:[/yellow] {svc.container}
[yellow]Type:[/yellow] {svc.type.value}
[yellow]Port:[/yellow] {svc.port.external} (internal: {svc.port.internal})
[yellow]Endpoint:[/yellow] http://127.0.0.1:{svc.port.external}

[yellow]Description:[/yellow]
{svc.description}

[yellow]Dependencies:[/yellow]
{', '.join(svc.deps) if svc.deps else 'None'}

[yellow]Mounts:[/yellow]
{chr(10).join(f'  {k} → {v}' for k, v in svc.mounts.items()) if svc.mounts else 'None'}
"""

    console.print(Panel(info_text.strip(), title="Service Info"))


@app.command()
def health() -> None:
    """Check health of services."""
    import requests

    console.print("[bold cyan]💚 Health Check[/bold cyan]\n")

    table = Table(show_header=True)
    table.add_column("Service", style="cyan")
    table.add_column("Health", justify="center")
    table.add_column("Response")

    for key in sorted(SERVICES.keys()):
        svc = SERVICES[key]
        endpoint = f"http://127.0.0.1:{svc.port.external}/health"

        try:
            resp = requests.get(endpoint, timeout=2)
            status = "✅" if resp.status_code == 200 else "❌"
            body = resp.json().get("status", "ok")[:30]
        except Exception as e:
            status = "⚠️"
            body = str(e)[:30]

        table.add_row(svc.name, status, body)

    console.print(table)


if __name__ == "__main__":
    app()
