# Fix Plan: `_state` Attribute Collision Between Agent and Group Classes

## Problem Summary

The `_state` attribute is used for two completely different purposes across the codebase:

| Class(es) | `_state` Type | Purpose |
|-----------|--------------|---------|
| `Agent`, `AsyncAgent` | `AgentState` enum | Lifecycle tracking (idle/running/stopped/errored) |
| `SequentialGroup`, `LoopGroup`, `ParallelGroup`, `AsyncSequentialGroup`, `AsyncLoopGroup` | `dict[str, Any]` | Shared execution state for prompt interpolation |

When external consumers (e.g. AgentSite's `pipeline.py`) walk a group's `_agents` list and call `agent._state.setdefault(k, v)`, individual `Agent` objects crash because `AgentState` enum has no `.setdefault()` method.

## Affected Files

### Agent lifecycle (`_state` as `AgentState` enum)
- `prompture/agent.py` — 10 references (init, property, run, _execute_iter, _execute_stream)
- `prompture/async_agent.py` — 10 references (same pattern)

### Group shared state (`_state` as `dict`)
- `prompture/groups.py` — `SequentialGroup` (line 106), `LoopGroup` (line 261)
- `prompture/async_groups.py` — `ParallelGroup` (line 62), `AsyncSequentialGroup` (line 206), `AsyncLoopGroup` (line 346)

### Public exports
- `prompture/__init__.py` — exports `AgentState` enum publicly; the `.state` property on `Agent` is part of the public API

### Tests
- `tests/test_groups.py` — tests `_inject_state()` and state propagation in groups

## Fix Strategy

Implement **Option B** (rename) + **Option C** (public API) from PROMPTURE_FIX.md.

### Part 1: Rename Agent lifecycle attribute (`_state` -> `_lifecycle`)

This eliminates the naming collision at the source.

**`prompture/agent.py`:**
- Rename `self._state = AgentState.idle` to `self._lifecycle = AgentState.idle`
- Update the `state` property to return `self._lifecycle`
- Update all assignments: `self._state = AgentState.running` -> `self._lifecycle = AgentState.running` (in `run()`, `_execute_iter()`, `_execute_stream()`)

**`prompture/async_agent.py`:**
- Same changes as `agent.py` (mirror structure)

**No changes needed to:**
- `AgentState` enum itself (stays the same)
- `__init__.py` exports (the public `.state` property still works)
- Group classes (they already use `_state` as dict, which is fine)

### Part 2: Add `inject_state()` public method to all group classes

This gives consumers a safe API so they don't need to access `_state` or `_agents` directly.

**Method signature (same for all group classes):**

```python
def inject_state(self, state: dict[str, Any], *, recursive: bool = False) -> None:
    """Merge external key-value pairs into this group's shared state.

    Existing keys are NOT overwritten (uses setdefault semantics).

    Args:
        state: Key-value pairs to inject.
        recursive: If True, also inject into nested sub-groups.
    """
    for k, v in state.items():
        self._state.setdefault(k, v)
    if recursive:
        for agent, _ in self._agents:
            if hasattr(agent, "inject_state"):
                agent.inject_state(state, recursive=True)
```

**Add to:**
- `prompture/groups.py` — `SequentialGroup`, `LoopGroup`
- `prompture/async_groups.py` — `ParallelGroup`, `AsyncSequentialGroup`, `AsyncLoopGroup`

**Also add a read-only accessor:**

```python
@property
def shared_state(self) -> dict[str, Any]:
    """Return a copy of the current shared execution state."""
    return dict(self._state)
```

### Part 3: Update exports

**`prompture/__init__.py`:**
- No new exports needed (methods are on existing exported classes)

### Part 4: Add tests

**`tests/test_groups.py`:**
- Test `inject_state()` basic merge with setdefault semantics
- Test `inject_state()` does not overwrite existing keys
- Test `inject_state(recursive=True)` propagates to nested groups
- Test `shared_state` property returns a copy (not a reference)

## Risk Assessment

| Change | Risk | Mitigation |
|--------|------|------------|
| Rename `_state` to `_lifecycle` in Agent/AsyncAgent | **Low-Medium** — breaks any code directly accessing `agent._state` | The public API is the `.state` property which remains unchanged. `_state` is a private attribute (underscore prefix). |
| Add `inject_state()` method | **None** — purely additive | New method, no existing behavior changes |
| Add `shared_state` property | **None** — purely additive | New property, no existing behavior changes |

## Execution Order

1. Rename `_state` -> `_lifecycle` in `agent.py`
2. Rename `_state` -> `_lifecycle` in `async_agent.py`
3. Add `inject_state()` and `shared_state` to `SequentialGroup` and `LoopGroup` in `groups.py`
4. Add `inject_state()` and `shared_state` to `ParallelGroup`, `AsyncSequentialGroup`, and `AsyncLoopGroup` in `async_groups.py`
5. Add tests in `tests/test_groups.py`
6. Run full test suite to verify no regressions
