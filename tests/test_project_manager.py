"""Tests for ProjectManager filesystem operations."""

import zipfile
from io import BytesIO

from agentsite.engine.project_manager import ProjectManager
from agentsite.models import Project


class TestProjectManager:
    def test_create_project(self, project_manager, sample_project):
        path = project_manager.create(sample_project)
        assert path.exists()
        assert (path / "site").exists()
        assert (path / "assets").exists()
        assert (path / "project.json").exists()

    def test_list_projects(self, project_manager, sample_project):
        project_manager.create(sample_project)
        ids = project_manager.list_projects()
        assert sample_project.id in ids

    def test_save_and_load_metadata(self, project_manager, sample_project):
        project_manager.create(sample_project)
        loaded = project_manager.load_metadata(sample_project.id)
        assert loaded is not None
        assert loaded.name == sample_project.name
        assert loaded.prompt == sample_project.prompt

    def test_write_and_read_site_file(self, project_manager, sample_project):
        project_manager.create(sample_project)
        project_manager.write_site_file(sample_project.id, "index.html", "<h1>Hello</h1>")

        content = project_manager.read_site_file(sample_project.id, "index.html")
        assert content == "<h1>Hello</h1>"

    def test_write_nested_file(self, project_manager, sample_project):
        project_manager.create(sample_project)
        project_manager.write_site_file(sample_project.id, "css/style.css", "body {}")

        files = project_manager.list_site_files(sample_project.id)
        assert "css/style.css" in files

    def test_list_site_files(self, project_manager, sample_project):
        project_manager.create(sample_project)
        project_manager.write_site_file(sample_project.id, "index.html", "<html></html>")
        project_manager.write_site_file(sample_project.id, "style.css", "body {}")

        files = project_manager.list_site_files(sample_project.id)
        assert len(files) == 2
        assert "index.html" in files
        assert "style.css" in files

    def test_path_traversal_blocked(self, project_manager, sample_project):
        project_manager.create(sample_project)

        import pytest

        with pytest.raises(ValueError, match="traversal"):
            project_manager.write_site_file(sample_project.id, "../../../etc/passwd", "bad")

    def test_export_zip(self, project_manager, sample_project):
        project_manager.create(sample_project)
        project_manager.write_site_file(sample_project.id, "index.html", "<html></html>")
        project_manager.write_site_file(sample_project.id, "style.css", "body {}")

        zip_bytes = project_manager.export_zip(sample_project.id)
        assert len(zip_bytes) > 0

        with zipfile.ZipFile(BytesIO(zip_bytes)) as zf:
            names = zf.namelist()
            assert "index.html" in names
            assert "style.css" in names

    def test_delete_project(self, project_manager, sample_project):
        project_manager.create(sample_project)
        assert project_manager.project_dir(sample_project.id).exists()

        project_manager.delete(sample_project.id)
        assert not project_manager.project_dir(sample_project.id).exists()

    def test_load_nonexistent(self, project_manager):
        result = project_manager.load_metadata("nonexistent")
        assert result is None
