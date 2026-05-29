"""Per-project memory facts (Phase 10)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ...models import MemoryFact
from ..deps import get_memory_repo, get_repo

router = APIRouter(prefix="/api/projects", tags=["memory"])


class CreateMemory(BaseModel):
    body: str
    kind: str = "preference"
    confidence: float = 0.8


@router.get("/{project_id}/memories")
async def list_memories(project_id: str, repo=Depends(get_repo), mem=Depends(get_memory_repo)):
    project = await repo.get(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    facts = await mem.list_by_project(project_id, limit=50)
    return [f.model_dump() for f in facts]


@router.post("/{project_id}/memories")
async def add_memory(project_id: str, req: CreateMemory, repo=Depends(get_repo), mem=Depends(get_memory_repo)):
    project = await repo.get(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    fact = MemoryFact(
        project_id=project_id,
        kind=req.kind,
        body=req.body.strip(),
        confidence=max(0.0, min(1.0, req.confidence)),
    )
    if not fact.body:
        raise HTTPException(status_code=400, detail="body is required")
    await mem.create(fact)
    return fact.model_dump()


@router.delete("/{project_id}/memories/{fact_id}")
async def delete_memory(project_id: str, fact_id: str, mem=Depends(get_memory_repo)):
    ok = await mem.delete(fact_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Memory not found")
    return {"deleted": fact_id}


@router.delete("/{project_id}/memories")
async def clear_memories(project_id: str, mem=Depends(get_memory_repo)):
    n = await mem.delete_by_project(project_id)
    return {"deleted_count": n}
