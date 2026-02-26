"""Extensible agent registry and catalog system.

Provides a central catalog of all available agents with metadata
for discovery, UI rendering, and pipeline construction.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class AgentCategory(str, Enum):
    """Agent functional categories for grouping and UI display."""

    PLANNING = "planning"
    DESIGN = "design"
    CONTENT = "content"
    DEVELOPMENT = "development"
    ASSETS = "assets"
    SEO = "seo"
    QA = "qa"


@dataclass
class AgentDescriptor:
    """Metadata describing a registered agent."""

    key: str  # "pm", "markup", "style_scss", etc.
    name: str  # "Markup Agent"
    category: AgentCategory
    description: str
    icon: str  # Phosphor icon name
    icon_color: str  # Tailwind color class e.g. "text-orange-500"
    default_temperature: float
    max_tokens: int
    factory_fn: str  # dotted import path to factory function
    output_key: str  # shared state key this agent writes to
    singleton: bool = False  # only one per category (e.g. PM)
    capabilities: list[str] = field(default_factory=list)  # ["html", "jsx", "css"]
    legacy: bool = False  # True for the monolithic developer


class AgentRegistry:
    """Central registry of agent descriptors.

    Agents register themselves at import time so the registry
    auto-populates when agent modules are loaded.
    """

    _agents: dict[str, AgentDescriptor] = {}  # noqa: RUF012

    @classmethod
    def register(cls, descriptor: AgentDescriptor) -> None:
        """Register an agent descriptor."""
        cls._agents[descriptor.key] = descriptor

    @classmethod
    def get(cls, key: str) -> AgentDescriptor | None:
        """Get a descriptor by agent key."""
        return cls._agents.get(key)

    @classmethod
    def list_all(cls) -> list[AgentDescriptor]:
        """List all registered agents."""
        return list(cls._agents.values())

    @classmethod
    def by_category(cls, category: AgentCategory) -> list[AgentDescriptor]:
        """List agents in a specific category."""
        return [a for a in cls._agents.values() if a.category == category]

    @classmethod
    def to_catalog(cls) -> list[dict]:
        """Export all agents as serializable dicts for the API."""
        result = []
        for d in cls._agents.values():
            result.append({
                "key": d.key,
                "name": d.name,
                "category": d.category.value,
                "description": d.description,
                "icon": d.icon,
                "icon_color": d.icon_color,
                "default_temperature": d.default_temperature,
                "max_tokens": d.max_tokens,
                "output_key": d.output_key,
                "singleton": d.singleton,
                "capabilities": d.capabilities,
                "legacy": d.legacy,
            })
        return result


# ------------------------------------------------------------------
# Register core agents
# ------------------------------------------------------------------

AgentRegistry.register(AgentDescriptor(
    key="pm",
    name="Product Manager",
    category=AgentCategory.PLANNING,
    description="Plans website structure, pages, build order, and agent selection.",
    icon="Strategy",
    icon_color="text-orange-500",
    default_temperature=0.3,
    max_tokens=4096,
    factory_fn="agentsite.agents.pm.create_pm_agent_auto",
    output_key="site_plan",
    singleton=True,
))

AgentRegistry.register(AgentDescriptor(
    key="designer",
    name="Designer",
    category=AgentCategory.DESIGN,
    description="Defines colors, fonts, spacing, and visual design system.",
    icon="PaintBrushBroad",
    icon_color="text-pink-500",
    default_temperature=0.5,
    max_tokens=4096,
    factory_fn="agentsite.agents.designer.create_designer_agent_auto",
    output_key="style_spec",
    singleton=True,
))

AgentRegistry.register(AgentDescriptor(
    key="developer",
    name="Developer",
    category=AgentCategory.DEVELOPMENT,
    description="Generates HTML/CSS/JS files for each page (monolithic).",
    icon="Code",
    icon_color="text-blue-500",
    default_temperature=0.2,
    max_tokens=65536,
    factory_fn="agentsite.agents.developer.create_developer_agent_auto",
    output_key="page_output",
    legacy=True,
    capabilities=["html", "css", "js"],
))

AgentRegistry.register(AgentDescriptor(
    key="reviewer",
    name="Reviewer",
    category=AgentCategory.QA,
    description="QA reviews generated code for quality, accessibility, and correctness.",
    icon="CheckCircle",
    icon_color="text-red-500",
    default_temperature=0.1,
    max_tokens=4096,
    factory_fn="agentsite.agents.reviewer.create_reviewer_agent_auto",
    output_key="review_feedback",
    singleton=True,
))

# ------------------------------------------------------------------
# Specialist agents
# ------------------------------------------------------------------

AgentRegistry.register(AgentDescriptor(
    key="markup",
    name="Markup Agent",
    category=AgentCategory.DEVELOPMENT,
    description="Writes HTML/JSX markup files only.",
    icon="FileHtml",
    icon_color="text-orange-400",
    default_temperature=0.2,
    max_tokens=32768,
    factory_fn="agentsite.agents.specialists.markup.create_markup_agent",
    output_key="markup_output",
    capabilities=["html", "jsx"],
))

AgentRegistry.register(AgentDescriptor(
    key="style",
    name="Style Agent",
    category=AgentCategory.DEVELOPMENT,
    description="Writes CSS stylesheets only.",
    icon="FileCss",
    icon_color="text-blue-400",
    default_temperature=0.2,
    max_tokens=16384,
    factory_fn="agentsite.agents.specialists.style.create_style_agent",
    output_key="style_output",
    capabilities=["css"],
))

AgentRegistry.register(AgentDescriptor(
    key="style_scss",
    name="SCSS Agent",
    category=AgentCategory.DEVELOPMENT,
    description="Writes SCSS stylesheets only.",
    icon="FileCss",
    icon_color="text-purple-400",
    default_temperature=0.2,
    max_tokens=16384,
    factory_fn="agentsite.agents.specialists.style.create_style_scss_agent",
    output_key="style_output",
    capabilities=["scss"],
))

AgentRegistry.register(AgentDescriptor(
    key="script",
    name="Script Agent",
    category=AgentCategory.DEVELOPMENT,
    description="Writes JavaScript files only.",
    icon="FileJs",
    icon_color="text-yellow-400",
    default_temperature=0.2,
    max_tokens=16384,
    factory_fn="agentsite.agents.specialists.script.create_script_agent",
    output_key="script_output",
    capabilities=["js"],
))

AgentRegistry.register(AgentDescriptor(
    key="image",
    name="Image Agent",
    category=AgentCategory.ASSETS,
    description="Generates images and manages the asset library.",
    icon="ImageSquare",
    icon_color="text-emerald-400",
    default_temperature=0.3,
    max_tokens=4096,
    factory_fn="agentsite.agents.specialists.image.create_image_agent",
    output_key="image_output",
    capabilities=["image"],
))

AgentRegistry.register(AgentDescriptor(
    key="copywriter",
    name="Copywriter",
    category=AgentCategory.CONTENT,
    description="Rewrites placeholder text with compelling, on-brand copy.",
    icon="TextAa",
    icon_color="text-teal-400",
    default_temperature=0.6,
    max_tokens=16384,
    factory_fn="agentsite.agents.specialists.copywriter.create_copywriter_agent",
    output_key="copywriter_output",
    capabilities=["copy"],
))

AgentRegistry.register(AgentDescriptor(
    key="seo",
    name="SEO Agent",
    category=AgentCategory.SEO,
    description="Injects meta tags, structured data, sitemap, and robots.txt.",
    icon="MagnifyingGlass",
    icon_color="text-lime-400",
    default_temperature=0.2,
    max_tokens=8192,
    factory_fn="agentsite.agents.specialists.seo.create_seo_agent",
    output_key="seo_output",
    capabilities=["seo"],
))

AgentRegistry.register(AgentDescriptor(
    key="accessibility",
    name="Accessibility Agent",
    category=AgentCategory.QA,
    description="Adds ARIA labels, fixes contrast, ensures WCAG AA compliance.",
    icon="WheelchairMotion",
    icon_color="text-cyan-400",
    default_temperature=0.1,
    max_tokens=16384,
    factory_fn="agentsite.agents.specialists.accessibility.create_accessibility_agent",
    output_key="accessibility_output",
    capabilities=["a11y"],
))

AgentRegistry.register(AgentDescriptor(
    key="animation",
    name="Animation Agent",
    category=AgentCategory.DEVELOPMENT,
    description="Creates scroll-triggered animations, transitions, and keyframes.",
    icon="Waveform",
    icon_color="text-violet-400",
    default_temperature=0.4,
    max_tokens=16384,
    factory_fn="agentsite.agents.specialists.animation.create_animation_agent",
    output_key="animation_output",
    capabilities=["animation"],
))
