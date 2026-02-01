"""Tests for ProjectManager filesystem operations."""

import zipfile
from io import BytesIO

from agentsite.engine.project_manager import ProjectManager
from agentsite.models import Project


class TestProjectManager:
    def test_create_project(self, project_manager, sample_project):
        path = project_manager.create(sample_project)
        assert path.exists()
        assert (path / "pages").exists()
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
        assert loaded.description == sample_project.description

    def test_write_and_read_version_file(self, project_manager, sample_project):
        project_manager.create(sample_project)
        project_manager.ensure_version_dir(sample_project.id, "home", 1)
        project_manager.write_version_file(sample_project.id, "home", 1, "index.html", "<h1>Hello</h1>")

        content = project_manager.read_version_file(sample_project.id, "home", 1, "index.html")
        assert content == "<h1>Hello</h1>"

    def test_write_nested_version_file(self, project_manager, sample_project):
        project_manager.create(sample_project)
        project_manager.ensure_version_dir(sample_project.id, "home", 1)
        project_manager.write_version_file(sample_project.id, "home", 1, "css/style.css", "body {}")

        files = project_manager.list_version_files(sample_project.id, "home", 1)
        assert "css/style.css" in files

    def test_list_version_files(self, project_manager, sample_project):
        project_manager.create(sample_project)
        project_manager.ensure_version_dir(sample_project.id, "home", 1)
        project_manager.write_version_file(sample_project.id, "home", 1, "index.html", "<html></html>")
        project_manager.write_version_file(sample_project.id, "home", 1, "style.css", "body {}")

        files = project_manager.list_version_files(sample_project.id, "home", 1)
        assert len(files) == 2
        assert "index.html" in files
        assert "style.css" in files

    def test_path_traversal_blocked(self, project_manager, sample_project):
        project_manager.create(sample_project)
        project_manager.ensure_version_dir(sample_project.id, "home", 1)

        import pytest

        with pytest.raises(ValueError, match="traversal"):
            project_manager.write_version_file(
                sample_project.id, "home", 1, "../../../etc/passwd", "bad"
            )

    def test_export_zip(self, project_manager, sample_project):
        project_manager.create(sample_project)
        project_manager.ensure_version_dir(sample_project.id, "home", 1)
        project_manager.write_version_file(sample_project.id, "home", 1, "index.html", "<html></html>")
        project_manager.write_version_file(sample_project.id, "home", 1, "style.css", "body {}")

        zip_bytes = project_manager.export_zip(sample_project.id)
        assert len(zip_bytes) > 0

        with zipfile.ZipFile(BytesIO(zip_bytes)) as zf:
            names = zf.namelist()
            assert any("index.html" in n for n in names)
            assert any("style.css" in n for n in names)

    def test_delete_project(self, project_manager, sample_project):
        project_manager.create(sample_project)
        assert project_manager.project_dir(sample_project.id).exists()

        project_manager.delete(sample_project.id)
        assert not project_manager.project_dir(sample_project.id).exists()

    def test_delete_page(self, project_manager, sample_project):
        project_manager.create(sample_project)
        project_manager.ensure_version_dir(sample_project.id, "about", 1)
        project_manager.write_version_file(sample_project.id, "about", 1, "index.html", "<h1>About</h1>")

        assert project_manager.page_dir(sample_project.id, "about").exists()
        project_manager.delete_page(sample_project.id, "about")
        assert not project_manager.page_dir(sample_project.id, "about").exists()

    def test_load_nonexistent(self, project_manager):
        result = project_manager.load_metadata("nonexistent")
        assert result is None
