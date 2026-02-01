# Prompture Bug: `AgentState` vs `_state` dict collision

## The Error

```
File "agentsite/engine/pipeline.py", line 67, in _sync_state_to_nested_groups
    agent._state.setdefault(k, v)
AttributeError: 'AgentState' object has no attribute 'setdefault'
```

## Root Cause

In Prompture, two different things use the `_state` attribute name:

| Object | `_state` type | Purpose |
|--------|--------------|---------|
| `Agent` | `AgentState` enum (`idle`, `running`, `stopped`, `errored`) | Lifecycle state |
| `SequentialGroup` / `LoopGroup` | `dict[str, Any]` | Shared execution state for prompt interpolation |

When AgentSite iterates over `group._agents` and checks `hasattr(agent, "_state")`, it matches **both** groups (correct, dict) and individual agents (wrong, enum). Calling `.setdefault()` on the enum crashes.

## Where It Happens

In `pipeline.py`, three helper functions walk the group tree:

1. **`_sync_state_to_nested_groups()`** — copies parent state into child groups
2. **`_merge_nested_group_state()`** — copies child state back to parent
3. **`_patch_pipeline_deps()`** — injects `deps` into agent `run()` methods

Functions 1 and 2 check `hasattr(agent, "_state")` which is ambiguous. Function 3 correctly checks `hasattr(agent, "_agents")` to distinguish groups from agents.

## Fix Options

### Option A: Fix in AgentSite (pipeline.py) — already applied

Change the type check to verify `_state` is a dict before using dict methods, and additionally check for `_agents` to confirm it's a group:

```python
# Before (broken):
if hasattr(agent, "_state"):
    for k, v in parent_state.items():
        agent._state.setdefault(k, v)

# After (fixed):
if hasattr(agent, "_agents") and isinstance(getattr(agent, "_state", None), dict):
    for k, v in parent_state.items():
        agent._state.setdefault(k, v)
```

### Option B: Fix in Prompture — rename the enum attribute

Rename the `Agent` lifecycle attribute from `_state` to `_lifecycle` or `_agent_state` to avoid the collision:

**File: `prompture/agent_types.py`** (or wherever `AgentState` is defined)
- No changes needed to the enum itself

**File: `prompture/agent.py`** (or wherever `Agent` class is)
- Rename `self._state` to `self._lifecycle` (or `self._agent_state`)
- Update all internal references: `self._state = AgentState.running` → `self._lifecycle = AgentState.running`
- Update any property that exposes it (e.g. `agent.state` property)

This is the cleaner fix because it removes the ambiguity at the source.

### Option C: Fix in Prompture — add state propagation API

Add a public method to groups for state sharing, so consumers don't need to access `_state` directly:

```python
class SequentialGroup:
    def inject_state(self, state: dict[str, Any], recursive: bool = False) -> None:
        """Inject external state values into this group's shared state.

        Args:
            state: Key-value pairs to inject. Existing keys are not overwritten.
            recursive: If True, also inject into nested sub-groups.
        """
        for k, v in state.items():
            self._state.setdefault(k, v)
        if recursive:
            for item in self._agents:
                agent = item[0] if isinstance(item, tuple) else item
                if hasattr(agent, "inject_state"):
                    agent.inject_state(state, recursive=True)
```

Same for `LoopGroup`. This gives consumers a safe API without touching internals.

## Recommended Approach

**Do both Option A (immediate fix) and Option C (long-term fix):**

1. Option A is already applied in pipeline.py to unblock generation right now
2. Option C should be added to Prompture so that AgentSite (and other consumers) can use `group.inject_state(state, recursive=True)` instead of walking `_agents` manually

Option B is also good but is a larger refactor with more risk of breaking other code.
