"""Docker Compose orchestration."""

import subprocess
from pathlib import Path
from typing import List, Optional
from rich.console import Console


console = Console()


class DockerCompose:
    """Wrapper around docker compose CLI."""

    def __init__(self, project_dir: Path):
        self.project_dir = project_dir
        self.compose_file = project_dir / "docker-compose.yml"

    def _run(self, *args: str, check: bool = True) -> subprocess.CompletedProcess:
        """Run docker compose command."""
        cmd = ["docker", "compose", "-f", str(self.compose_file)] + list(args)
        return subprocess.run(cmd, cwd=self.project_dir, check=check, capture_output=False)

    def up(self, services: Optional[List[str]] = None, build: bool = False) -> None:
        """Start services."""
        args = ["up", "-d"]
        if build:
            args.append("--build")
        if services:
            args.extend(services)
        self._run(*args)

    def down(self, remove_volumes: bool = False) -> None:
        """Stop and remove containers."""
        args = ["down"]
        if remove_volumes:
            args.append("-v")
        self._run(*args)

    def ps(self) -> subprocess.CompletedProcess:
        """List containers."""
        return self._run("ps", "--all")

    def logs(self, service: Optional[str] = None, follow: bool = False, tail: int = 100) -> None:
        """Show logs."""
        args = ["logs", f"--tail={tail}"]
        if follow:
            args.append("-f")
        if service:
            args.append(service)
        self._run(*args, check=False)

    def restart(self, services: Optional[List[str]] = None) -> None:
        """Restart services."""
        args = ["restart"]
        if services:
            args.extend(services)
        self._run(*args)

    def stop(self, services: Optional[List[str]] = None) -> None:
        """Stop services (without removing)."""
        args = ["stop"]
        if services:
            args.extend(services)
        self._run(*args)

    def health_check(self) -> dict:
        """Check health of all services."""
        import json
        result = self._run("ps", "--format=json", check=False)
        # Parse and return health status
        return {}
