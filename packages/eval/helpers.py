"""Helper utilities for calling the Arch-Systems portal AI service."""

import json
import os
from pathlib import Path

import httpx

from datasets.golden_cases import get_golden_response

PORTAL_BASE_URL = os.environ.get("PORTAL_BASE_URL", "http://localhost:3000")
AI_CHAT_ENDPOINT = f"{PORTAL_BASE_URL}/api/ai/chat"
CACHE_DIR = Path(__file__).parent / "datasets" / "golden_cases.json"

# System prompts matching the portal's AI service
PROMPTS = {
    "predictiveMaintenance": (
        "You are an industrial maintenance AI. Analyze machine data and provide risk assessment. "
        "Output JSON only."
    ),
    "shiftHandoff": (
        "You are a shift supervisor AI. Summarize shift activities concisely for the next shift."
    ),
    "safetyCompliance": (
        "You are a safety compliance officer AI. Review logs for safety violations and concerns."
    ),
    "equipmentManual": (
        "You are a technical support AI. Answer equipment questions based on manuals and best practices."
    ),
    "translate": (
        "You are a professional translator. Translate accurately while preserving technical terminology."
    ),
}


async def call_ai_service(
    prompt_type: str,
    user_input: str,
    use_cache: bool = True,
) -> str:
    """Call the portal AI service or return a cached golden response.

    Args:
        prompt_type: One of 'predictiveMaintenance', 'shiftHandoff',
                     'safetyCompliance', 'equipmentManual', 'translate'
        user_input: The user message to send
        use_cache: If True and no portal is available, fall back to golden responses

    Returns:
        The AI-generated response text
    """
    if prompt_type not in PROMPTS:
        raise ValueError(f"Unknown prompt type: {prompt_type}. Choose from: {list(PROMPTS.keys())}")

    # Try live API first
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                AI_CHAT_ENDPOINT,
                json={
                    "messages": [
                        {"role": "system", "content": PROMPTS[prompt_type]},
                        {"role": "user", "content": user_input},
                    ],
                },
            )
            if response.status_code == 200:
                data = response.json()
                return data.get("content", "")
    except (httpx.ConnectError, httpx.TimeoutException):
        pass

    # Fall back to cached golden response
    if use_cache:
        cached = get_golden_response(prompt_type, user_input)
        if cached:
            return cached

    raise ConnectionError(
        f"Portal AI service unavailable at {AI_CHAT_ENDPOINT} and no cached response found. "
        f"Start the portal or set EVAL_USE_CACHE=true."
    )


def call_ai_service_sync(prompt_type: str, user_input: str, use_cache: bool = True) -> str:
    """Synchronous wrapper for call_ai_service."""
    import asyncio

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        # We're inside an async context already, create a new loop
        import concurrent.futures

        with concurrent.futures.ThreadPoolExecutor() as executor:
            future = executor.submit(
                asyncio.run, call_ai_service(prompt_type, user_input, use_cache)
            )
            return future.result()
    else:
        return asyncio.run(call_ai_service(prompt_type, user_input, use_cache))