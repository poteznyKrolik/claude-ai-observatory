"""Service configuration and container registry."""

from dataclasses import dataclass
from typing import Dict, List, Optional
from enum import Enum


class ServiceType(str, Enum):
    """Service classification."""
    ANALYTICS = "analytics"
    MONITORING = "monitoring"
    TRANSCRIPTS = "transcripts"
    INTEGRATIONS = "integrations"


@dataclass
class ServicePort:
    """Port mapping for a service."""
    internal: int
    external: int
    protocol: str = "http"


@dataclass
class Service:
    """Service definition."""
    name: str
    container: str
    type: ServiceType
    port: ServicePort
    description: str
    deps: List[str]  # Dependency services to start first
    mounts: Dict[str, str]  # {host_path: container_path}


# Service registry
SERVICES = {
    # Analytics
    "transcripts": Service(
        name="Claude Transcripts",
        container="claude-transcripts",
        type=ServiceType.TRANSCRIPTS,
        port=ServicePort(8765, 8765),
        description="HTML transcript generator for Claude sessions",
        deps=[],
        mounts={"~/.claude": "/root/.claude:ro"},
    ),
    "codeburn": Service(
        name="CodeBurn",
        container="codeburn",
        type=ServiceType.ANALYTICS,
        port=ServicePort(4747, 4747),
        description="Spending breakdown by task/tool/model (multi-agent)",
        deps=[],
        mounts={},
    ),
    "tokdash": Service(
        name="Tokdash (Claude)",
        container="tokdash-claude",
        type=ServiceType.ANALYTICS,
        port=ServicePort(55423, 55423),
        description="Token usage dashboard (Claude-only)",
        deps=[],
        mounts={"~/.claude": "/root/.claude:ro"},
    ),
    # Monitoring
    "dashboard": Service(
        name="Claude Dashboard",
        container="claude-dashboard",
        type=ServiceType.MONITORING,
        port=ServicePort(5173, 5173),
        description="Full observability UI with agent dispatch",
        deps=[],
        mounts={"~/.claude": "/root/.claude:ro"},
    ),
    "agent-monitor": Service(
        name="Claude Agent Monitor",
        container="claude-agent-monitor",
        type=ServiceType.MONITORING,
        port=ServicePort(4820, 4820),
        description="Real-time agent activity tracking",
        deps=[],
        mounts={"~/.claude": "/root/.claude:ro"},
    ),
    "observer": Service(
        name="AI Observer",
        container="ai-observer",
        type=ServiceType.MONITORING,
        port=ServicePort(8080, 8080),
        description="Real-time observability platform (Go + DuckDB)",
        deps=[],
        mounts={},
    ),
    # Integrations
    "chatgpt": Service(
        name="ChatGPT Extractor",
        container="chatgpt-extractor",
        type=ServiceType.INTEGRATIONS,
        port=ServicePort(5000, 5000),
        description="Extract ChatGPT conversations to Markdown/JSON",
        deps=[],
        mounts={},
    ),
}

# Grouped presets
PRESETS = {
    "all": list(SERVICES.keys()),
    "analytics": [k for k, v in SERVICES.items() if v.type == ServiceType.ANALYTICS],
    "monitoring": [k for k, v in SERVICES.items() if v.type == ServiceType.MONITORING],
    "transcripts": ["transcripts"],
    "integrations": [k for k, v in SERVICES.items() if v.type == ServiceType.INTEGRATIONS],
}
