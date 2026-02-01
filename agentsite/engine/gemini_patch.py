"""Monkey-patch for prompture's GoogleDriver to fix tool result formatting.

Gemini expects tool results as ``function_response`` parts and assistant
tool calls as ``function_call`` parts.  The upstream ``_build_generation_args``
method sends them as plain text, which causes Gemini to return empty/confused
responses after tool execution.

This patch is applied once at import time and is safe to call multiple times.
"""

from __future__ import annotations

import json
import logging
from typing import Any

logger = logging.getLogger("agentsite.gemini_patch")

_PATCHED = False


def _patched_build_generation_args(
    self: Any,
    messages: list[dict[str, Any]],
    options: dict[str, Any] | None = None,
) -> tuple[Any, dict[str, Any], dict[str, Any]]:
    """Replacement for GoogleDriver._build_generation_args that handles tool messages."""
    import google.generativeai as genai

    merged_options = self.options.copy()
    if options:
        merged_options.update(options)

    generation_config = merged_options.get("generation_config", {})
    safety_settings = merged_options.get("safety_settings", {})

    if "temperature" in merged_options and "temperature" not in generation_config:
        generation_config["temperature"] = merged_options["temperature"]
    if "max_tokens" in merged_options and "max_output_tokens" not in generation_config:
        generation_config["max_output_tokens"] = merged_options["max_tokens"]
    if "top_p" in merged_options and "top_p" not in generation_config:
        generation_config["top_p"] = merged_options["top_p"]
    if "top_k" in merged_options and "top_k" not in generation_config:
        generation_config["top_k"] = merged_options["top_k"]

    # Native JSON mode support
    if merged_options.get("json_mode"):
        generation_config["response_mime_type"] = "application/json"
        json_schema = merged_options.get("json_schema")
        if json_schema:
            generation_config["response_schema"] = json_schema

    # Convert messages to Gemini format with proper tool handling
    system_instruction = None
    contents: list[dict[str, Any]] = []

    # Track tool_call id → name mapping for tool result messages
    tool_call_names: dict[str, str] = {}

    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content", "")

        if role == "system":
            system_instruction = content if isinstance(content, str) else str(content)

        elif role == "assistant":
            tool_calls = msg.get("tool_calls")
            if tool_calls:
                # Assistant message with function calls → model with function_call parts
                parts = []
                if content:
                    parts.append(genai.types.ContentDict(text=content) if hasattr(genai.types, 'ContentDict') else content)
                for tc in tool_calls:
                    fn = tc.get("function", tc)
                    name = fn.get("name", "")
                    tc_id = tc.get("id", "")
                    # Track the name for matching tool results
                    tool_call_names[tc_id] = name
                    # Parse arguments
                    args = fn.get("arguments", {})
                    if isinstance(args, str):
                        try:
                            args = json.loads(args)
                        except (json.JSONDecodeError, TypeError):
                            args = {}
                    parts.append(
                        genai.protos.Part(
                            function_call=genai.protos.FunctionCall(
                                name=name,
                                args=args,
                            )
                        )
                    )
                contents.append({"role": "model", "parts": parts})
            else:
                # Regular assistant message
                if msg.get("_vision_parts"):
                    contents.append({"role": "model", "parts": content})
                else:
                    contents.append({"role": "model", "parts": [content]})

        elif role == "tool":
            # Tool result → user with function_response part
            tc_id = msg.get("tool_call_id", "")
            name = tool_call_names.get(tc_id, "unknown_tool")
            result_content = content
            # Try to parse as JSON for structured response
            if isinstance(result_content, str):
                try:
                    result_content = json.loads(result_content)
                except (json.JSONDecodeError, TypeError):
                    result_content = {"result": result_content}
            if not isinstance(result_content, dict):
                result_content = {"result": str(result_content)}

            parts = [
                genai.protos.Part(
                    function_response=genai.protos.FunctionResponse(
                        name=name,
                        response=result_content,
                    )
                )
            ]
            contents.append({"role": "user", "parts": parts})

        else:
            # Regular user message
            gemini_role = "user"
            if msg.get("_vision_parts"):
                contents.append({"role": gemini_role, "parts": content})
            else:
                contents.append({"role": gemini_role, "parts": [content]})

    # For a single message, unwrap only if it has exactly one string part
    if len(contents) == 1:
        parts = contents[0]["parts"]
        gen_input = parts[0] if len(parts) == 1 and isinstance(parts[0], str) else contents
    else:
        gen_input = contents

    model_kwargs: dict[str, Any] = {}
    if system_instruction:
        model_kwargs["system_instruction"] = system_instruction

    gen_kwargs: dict[str, Any] = {
        "generation_config": generation_config if generation_config else None,
        "safety_settings": safety_settings if safety_settings else None,
    }

    return gen_input, gen_kwargs, model_kwargs


def apply_gemini_patch() -> None:
    """Apply the monkey-patch to GoogleDriver if available."""
    global _PATCHED
    if _PATCHED:
        return

    try:
        from prompture.drivers.google_driver import GoogleDriver

        GoogleDriver._build_generation_args = _patched_build_generation_args
        _PATCHED = True
        logger.info("Applied Gemini tool result format patch to GoogleDriver")
    except ImportError:
        logger.debug("GoogleDriver not available, skipping patch")
    except Exception:
        logger.warning("Failed to apply Gemini patch", exc_info=True)
