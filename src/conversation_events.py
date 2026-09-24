"""Request-local, non-authoritative public feedback. Never forward reasoning/tools."""
from contextvars import ContextVar
import json

SINK = ContextVar("conversation_event_sink", default=None)
CONTENT_TYPE = "application/x-ariadne-turn+ndjson"
PATHS = frozenset({"/api/candidate-conversation-turn", "/api/job-conversation-turn",
                   "/api/personal-understanding-turn", "/api/job-overview-turn"})


def emit(kind, **data):
    sink = SINK.get()
    if sink:
        sink({"type": kind, **data})


def encode(event):
    return (json.dumps(event, ensure_ascii=True, separators=(",", ":")) + "\n").encode()


def public_preview(raw):
    """Decode only public answer fields, including incomplete JSON strings.

    A lexical walk, not a regex over arbitrary source/patch/tool fields. Preview
    is never accepted as a domain action, persisted, or described as verified.
    """
    raw = raw[:160000]
    decoder = json.JSONDecoder()
    allowed = {("message",), ("summary",), ("semantic_action", "message")}
    found = []

    def space(i):
        while i < len(raw) and raw[i].isspace(): i += 1
        return i

    def string(i):
        start = i
        i += 1
        while i < len(raw):
            if raw[i] == '"':
                return json.loads(raw[start:i + 1]), i + 1
            if raw[i] == "\\": i += 1
            i += 1
        # Drop only an unfinished escape / surrogate at the boundary.
        tail = raw[start:]
        for trim in range(min(12, len(tail))):
            try:
                text = json.loads((tail[:-trim] if trim else tail) + '"')
                return text, len(raw)
            except ValueError:
                pass
        raise ValueError()

    def value(i, path, depth=0):
        i = space(i)
        if i >= len(raw) or depth > 20: raise ValueError()
        if raw[i] == '"':
            text, end = string(i)
            if path in allowed:
                found.append(text[:6000])
            return end
        if raw[i] == "{":
            i = space(i + 1)
            while i < len(raw) and raw[i] != "}":
                if raw[i] != '"': raise ValueError()
                key, i = string(i)
                i = space(i)
                if i >= len(raw) or raw[i] != ":": raise ValueError()
                i = space(value(i + 1, path + (key,), depth + 1))
                if i < len(raw) and raw[i] == ",": i = space(i + 1)
                elif i < len(raw) and raw[i] != "}": raise ValueError()
            return i + 1
        if raw[i] == "[":
            i = space(i + 1)
            while i < len(raw) and raw[i] != "]":
                i = space(value(i, path + ("[]",), depth + 1))
                if i < len(raw) and raw[i] == ",": i = space(i + 1)
                elif i < len(raw) and raw[i] != "]": raise ValueError()
            return i + 1
        _, end = decoder.raw_decode(raw, i)
        return end

    try:
        value(0, ())
    except (ValueError, RecursionError):
        pass
    # Do not send dangling UTF-16 surrogates to the browser.
    return found[0].encode("utf-8", "replace").decode() if found else ""


class Preview:
    def __init__(self):
        self.previous = ""

    def update(self, raw):
        text = public_preview(raw)
        if text and text != self.previous and (not self.previous or not text.startswith(self.previous) or len(text) - len(self.previous) >= 24):
            self.previous = text
            emit("preview", text=text)


class ChatStream:
    """Bounded Chat Completions SSE -> unchanged domain envelope."""
    def __init__(self, limit):
        self.limit, self.size, self.buffer = limit, 0, b""
        self.response = {"choices": [{"index": 0, "message": {"content": ""}, "finish_reason": None}]}
        self.tools, self.done, self.preview = {}, False, Preview()

    def feed(self, chunk):
        self.size += len(chunk)
        if self.size > self.limit: raise ValueError("PROVIDER_RESPONSE_TOO_LARGE")
        self.buffer += chunk
        while b"\n" in self.buffer:
            line, self.buffer = self.buffer.split(b"\n", 1)
            line = line.rstrip(b"\r")
            if not line.startswith(b"data:"): continue
            data = line[5:].strip()
            if not data: continue
            if data == b"[DONE]":
                self.done = True
                continue
            if self.done: raise ValueError("PROVIDER_STREAM_AFTER_END")
            event = json.loads(data)
            if event.get("error"): raise ValueError("PROVIDER_STREAM_ERROR")
            for key in ("id", "model", "usage"):
                if event.get(key) is not None:
                    if key in {"id", "model"} and key in self.response and self.response[key] != event[key]:
                        raise ValueError("PROVIDER_STREAM_IDENTITY_CHANGED")
                    self.response[key] = event[key]
            for choice in event.get("choices", []):
                if choice.get("index", 0) != 0: raise ValueError("PROVIDER_STREAM_CHOICES_INVALID")
                target = self.response["choices"][0]
                delta = choice.get("delta") or {}
                # reasoning_content, reasoning and tool arguments are never UI events.
                if isinstance(delta.get("content"), str):
                    target["message"]["content"] += delta["content"]
                    self.preview.update(target["message"]["content"])
                if delta.get("refusal"): target["message"]["refusal"] = delta["refusal"]
                for tool in delta.get("tool_calls") or []:
                    index = tool.get("index", 0)
                    if type(index) is not int or index != 0: raise ValueError("PROVIDER_STREAM_TOOLS_INVALID")
                    dest = self.tools.setdefault(index, {"type": "function", "function": {"name": "", "arguments": ""}})
                    if tool.get("id"): dest["id"] = tool["id"]
                    if tool.get("type") and tool["type"] != "function": raise ValueError("PROVIDER_STREAM_TOOLS_INVALID")
                    for key in ("name", "arguments"):
                        fragment = (tool.get("function") or {}).get(key, "")
                        if not isinstance(fragment, str): raise ValueError("PROVIDER_STREAM_INVALID")
                        dest["function"][key] += fragment
                    self.preview.update(dest["function"]["arguments"])
                if choice.get("finish_reason") is not None: target["finish_reason"] = choice["finish_reason"]

    def finish(self):
        if self.buffer.strip(): self.feed(b"\n")
        target = self.response["choices"][0]
        if not self.done or target["finish_reason"] not in {"stop", "tool_calls"}:
            raise ValueError("PROVIDER_STREAM_INCOMPLETE")
        if self.tools:
            target["message"]["tool_calls"] = list(self.tools.values())
            if not target["message"]["content"]: target["message"]["content"] = None
        emit("checking")
        return self.response


def read_chat_stream(response, limit):
    parser = ChatStream(limit)
    while True:
        line = response.readline(limit + 1)
        if not line: break
        parser.feed(line)
    return parser.finish()
