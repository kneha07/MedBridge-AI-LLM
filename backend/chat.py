"""Policy chatbot: a Groq tool-calling loop over the RAG store and structured payer data.

Stateless: the client sends the full message history each turn.
"""
import asyncio
import json
import os

from agent_runner import get_groq
from rag import store

MAX_TOOL_ROUNDS = 4
TOP_K = int(os.environ.get("CHAT_TOP_K", "4"))  # passages returned per search_policy call (4, 6 and 8 compared in the README)

SYSTEM_PROMPT = """You are MedBridge Assistant, a prior-authorization policy assistant for clinic staff.
Rules:
- For any question about coverage, criteria, required documents or appeals, call search_policy first and answer ONLY from the returned passages. Cite each claim as [Title].
- Say which payer or program each criterion comes from. If the user asks about a payer with no retrieved passages, say the document collection does not cover it.
- If the passages do not answer the question, say you could not find it. Never invent criteria, codes or deadlines.
- You are not a clinician or lawyer; clinical decisions and appeals need physician review.
- Call search_policy at most twice per question. If the passages still do not answer it, say the document collection does not cover it; do not keep searching.
- Keep answers short and concrete."""

TOOLS = [
    {"type": "function", "function": {
        "name": "search_policy",
        "description": "Semantic search over payer prior-authorization policy documents. Returns cited passages.",
        "parameters": {"type": "object", "properties": {
            "query": {"type": "string", "description": "What to look up, e.g. 'lumbar MRI conservative therapy requirement'"},
            "payer": {"type": "string", "description": "Optional payer name, e.g. Aetna, Cigna, Medicare"}},
            "required": ["query"]}}},
]


def _run_tool(name: str, args: dict, citations: dict) -> dict:
    if name == "search_policy":
        hits = store.search(args.get("query", ""), k=TOP_K, payer=args.get("payer") or None)
        for h in hits:
            citations.setdefault(h["title"], {"title": h["title"], "url": h["source"],
                                              "synthetic": h["synthetic"], "score": h["score"],
                                              "passage": h["text"]})
        return {"passages": [{"title": h["title"], "synthetic": h["synthetic"], "text": h["text"]} for h in hits]}
    return {"error": f"unknown tool {name}"}


def _complete(messages):
    return get_groq().chat.completions.create(
        model=os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b"),
        messages=messages, tools=TOOLS, tool_choice="auto", max_tokens=1024)


def _claude_chat(history: list[dict], provider: str) -> dict:
    """Same loop through the Anthropic Messages API (first-party or Bedrock). Tested on Bedrock with us.anthropic.claude-sonnet-4-6."""
    from agent_runner import claude_model, get_anthropic
    client = get_anthropic(provider)
    tools = [{"name": t["function"]["name"], "description": t["function"]["description"],
              "input_schema": t["function"]["parameters"]} for t in TOOLS]
    messages = [{"role": m["role"], "content": m["content"]} for m in history]
    citations, used = {}, []
    for _ in range(MAX_TOOL_ROUNDS + 1):
        resp = client.messages.create(model=claude_model(provider), max_tokens=4000, system=SYSTEM_PROMPT,
                                      tools=tools, messages=messages)
        tool_uses = [b for b in resp.content if b.type == "tool_use"]
        if resp.stop_reason != "tool_use" or not tool_uses:
            reply = "".join(b.text for b in resp.content if b.type == "text")
            return {"reply": reply, "citations": list(citations.values()), "tools_used": used}
        messages.append({"role": "assistant", "content": resp.content})
        results = []
        for tu in tool_uses:
            used.append(tu.name)
            try:
                out = _run_tool(tu.name, tu.input, citations)
            except Exception as e:
                out = {"error": str(e)[:200]}
            results.append({"type": "tool_result", "tool_use_id": tu.id, "content": json.dumps(out)})
        messages.append({"role": "user", "content": results})
    return {"reply": "The document collection does not contain an answer to that question.", "citations": [], "tools_used": used}


async def chat(history: list[dict], provider: str | None = None) -> dict:
    loop = asyncio.get_event_loop()
    provider = provider or os.environ.get("AI_PROVIDER", "groq")
    if provider in ("bedrock", "claude"):
        return await loop.run_in_executor(None, _claude_chat, history, provider)
    messages = [{"role": "system", "content": SYSTEM_PROMPT}] + history
    citations, used = {}, []
    for _ in range(MAX_TOOL_ROUNDS + 1):
        resp = await loop.run_in_executor(None, _complete, messages)
        msg = resp.choices[0].message
        if not msg.tool_calls:
            return {"reply": msg.content or "", "citations": list(citations.values()), "tools_used": used}
        messages.append({"role": "assistant", "content": msg.content, "tool_calls": msg.tool_calls})
        for tc in msg.tool_calls:
            used.append(tc.function.name)
            try:
                result = await loop.run_in_executor(
                    None, _run_tool, tc.function.name, json.loads(tc.function.arguments or "{}"), citations)
            except Exception as e:
                result = {"error": str(e)[:200]}
            messages.append({"role": "tool", "tool_call_id": tc.id, "content": json.dumps(result)})
    return {"reply": "The document collection does not contain an answer to that question.", "citations": [], "tools_used": used}
