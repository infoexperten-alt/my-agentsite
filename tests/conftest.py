"""Shared fixtures for AgentSite tests."""

from __future__ import annotations

import tempfile
from pathlib import Path

import pytest

from agentsite.config import Settings
from agentsite.engine.project_manager import ProjectManager
from agentsite.models import Project


@pytest.fixture
def tmp_dir(tmp_path):
    """Provide a temporary directory for test data."""
    return tmp_path


@pytest.fixture
def project_manager(tmp_dir):
    """Create a ProjectManager with a temp base directory."""
    return ProjectManager(base_dir=tmp_dir)


@pytest.fixture
def sample_project():
    """Create a sample project for testing."""
    return Project(
        name="Test Portfolio",
        description="A portfolio website for a photographer",
        model="openai/gpt-4o",
    )
