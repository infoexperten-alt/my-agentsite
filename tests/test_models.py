"""Tests for AgentSite domain models."""

from agentsite.models import (
    GeneratedFile,
    Page,
    PageOutput,
    PagePlan,
    PageVersion,
    Project,
    ReviewFeedback,
    SitePlan,
    StyleSpec,
    WSEvent,
)


class TestSitePlan:
    def test_basic_creation(self):
        plan = SitePlan(
            project_name="My Site",
            tagline="A great website",
            pages=[
                PagePlan(slug="index", title="Home", sections=["Hero", "About"]),
                PagePlan(slug="contact", title="Contact", sections=["Form"]),
            ],
        )
        assert plan.project_name == "My Site"
        assert len(plan.pages) == 2
        assert plan.shared_components == ["navbar", "footer"]

    def test_page_plan_defaults(self):
        page = PagePlan(slug="about", title="About Us", sections=["Team"])
        assert page.priority == 1

    def test_json_roundtrip(self):
        plan = SitePlan(
            project_name="Test",
            tagline="Test site",
            pages=[PagePlan(slug="index", title="Home", sections=["Hero"])],
        )
        json_str = plan.model_dump_json()
        restored = SitePlan.model_validate_json(json_str)
        assert restored.project_name == plan.project_name
        assert len(restored.pages) == 1


class TestStyleSpec:
    def test_defaults(self):
        spec = StyleSpec()
        assert spec.primary_color == "#2563eb"
        assert spec.font_heading == "Inter"

    def test_custom_values(self):
        spec = StyleSpec(primary_color="#ff0000", font_heading="Roboto")
        assert spec.primary_color == "#ff0000"
        assert spec.font_heading == "Roboto"


class TestPageOutput:
    def test_with_files(self):
        output = PageOutput(
            files=[
                GeneratedFile(path="index.html", content="<html></html>"),
                GeneratedFile(path="style.css", content="body {}", language="css"),
            ],
            notes="Built homepage",
        )
        assert len(output.files) == 2
        assert output.files[0].language == "html"
        assert output.files[1].language == "css"


class TestReviewFeedback:
    def test_approved(self):
        feedback = ReviewFeedback(score=8, approved=True, issues=[], suggestions=["Add alt text"])
        assert feedback.approved is True
        assert feedback.score == 8

    def test_rejected(self):
        feedback = ReviewFeedback(score=4, approved=False, issues=["Missing navbar"])
        assert feedback.approved is False


class TestProject:
    def test_auto_id(self):
        p1 = Project(name="A")
        p2 = Project(name="B")
        assert p1.id != p2.id
        assert len(p1.id) == 12

    def test_defaults(self):
        p = Project()
        assert p.name == "Untitled Project"
        assert p.description == ""
        assert p.model == ""
        assert p.style_spec is None

    def test_json_roundtrip(self):
        p = Project(name="Test", description="Build a site", model="openai/gpt-4o")
        json_str = p.model_dump_json()
        restored = Project.model_validate_json(json_str)
        assert restored.name == "Test"
        assert restored.id == p.id


class TestPage:
    def test_auto_id(self):
        p = Page(project_id="abc", slug="home", title="Home Page")
        assert len(p.id) == 12
        assert p.project_id == "abc"

    def test_defaults(self):
        p = Page()
        assert p.slug == "home"
        assert p.title == "Home Page"


class TestPageVersion:
    def test_defaults(self):
        v = PageVersion(page_id="xyz", version_number=1)
        assert v.status == "generating"
        assert v.usage == {}
        assert v.error is None

    def test_completed(self):
        v = PageVersion(page_id="xyz", version_number=2, status="completed")
        assert v.status == "completed"


class TestWSEvent:
    def test_creation(self):
        event = WSEvent(type="agent_start", agent="pm", data={"foo": "bar"})
        assert event.type == "agent_start"
        assert event.agent == "pm"

    def test_serialization(self):
        event = WSEvent(type="generation_complete", data={"files": ["index.html"]})
        payload = event.model_dump_json()
        assert "generation_complete" in payload
