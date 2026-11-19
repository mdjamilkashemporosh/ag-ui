# Features

What this project does, what it deliberately does not do, and how much of the protocol it
covers.

---

## Agent

| Capability | Status |
| --- | --- |
| LangGraph `StateGraph` with a model node and a tools node | yes |
| DeepSeek via `ChatDeepSeek`, model `deepseek-chat`, `temperature: 0` | yes |
| Tool calling with a conditional loop back to the model | yes |
| One tool, `get_weather`, returning a fixed string | yes |
| Multiple tool calls per turn | yes — `ToolNode` handles any number |
| Conversation state | per-run `messages` via `MessagesAnnotation` |
| Abort a run from the UI | yes — `agent.abortRun()` |
| Checkpointing, resuming, threads | no |
| Reasoning traces | no — the reasoner is a poor fit for tool calling |
| Sub-agents | no |

## Streaming and protocol

Every step reaches the browser as a typed event over a single long-lived `POST` served as
SSE. There is no polling and no websocket.

| Family | Event types | Folded into state by `@ag-ui/client` | Rendered in UI |
| --- | --- | --- | --- |
| Run lifecycle | `RUN_STARTED`, `RUN_FINISHED`, `RUN_ERROR` | yes | status line |
| Text | `TEXT_MESSAGE_START`, `_CONTENT`, `_END`, `_CHUNK` | yes → `agent.messages` | transcript |
| Tool calls | `TOOL_CALL_START`, `_ARGS`, `_END`, `_CHUNK` | yes → `toolCalls` | tool cards |
| Tool results | `TOOL_CALL_RESULT` | yes → tool messages | card body |
| State | `STATE_SNAPSHOT`, `STATE_DELTA` | yes → `agent.state` | state inspector |
| History | `MESSAGES_SNAPSHOT` | yes | transcript |
| Activity | `ACTIVITY_SNAPSHOT`, `ACTIVITY_DELTA` | no | logged only |
| Steps | `STEP_STARTED`, `STEP_FINISHED` | no | logged only |
| Reasoning | 7 `REASONING_*` types | no | logged only |
| Sub-agents | `SUBAGENT_STARTED`, `_FINISHED`, `_ERROR` | no | logged only |
| Escape hatches | `CUSTOM`, `RAW` | no | logged only |

`@ag-ui/core` 1.0.5 defines **31** event types. The status logic in `chat.tsx` reacts to
**6** of them. Everything else is still parsed, applied where applicable, and printed by
the inspector — it is simply not given a dedicated UI.

## Client UI

| Feature | Notes |
| --- | --- |
| Message thread | user bubbles and assistant responses |
| Markdown rendering | `react-markdown` |
| Live status line | `Thinking…` → `Calling get_weather…` → `Reading tool result…` → `Writing answer…` |
| Inline typing indicator | shown while a run is active |
| Tool cards | icon, title, state (`Queued` / `Running` / `Done`), result body |
| Suggestion chips | three seeded prompts on an empty thread |
| Stop button | aborts the active run |
| Auto-scroll | follows new messages and status changes |
| Auto-growing composer | capped at 160px |
| Error surface | `RUN_ERROR` message shown in-thread and in the status pill |

## Event inspector

Toggle **Events** in the header to open the panel beside the chat.

| Feature | Notes |
| --- | --- |
| Live event log | one row per event, timestamped |
| Colour coding | by event family |
| Delta merging | consecutive `TEXT_MESSAGE_CONTENT` / `TOOL_CALL_ARGS` collapse into one row with a count |
| Long payloads | truncated to a preview, expandable per row |
| Bounded history | keeps the last 300 entries |
| Clear button | resets the log |
| Run indicator | running / idle, message count, event count |
| Shared state viewer | collapsible JSON dump of `agent.state` |

## Architecture

| Property | Value |
| --- | --- |
| Processes | two — agent on `:8123`, frontend on `:3000` |
| Transport | SSE over a single open `POST` |
| Protocol translation | one file, `frontend/app/api/copilotkit/[[...slug]]/route.ts` |
| AG-UI dependencies in `agent/` | none |
| Frontend files that import `@ag-ui/*` | one |
| Framework coupling of the UI | protocol only — the agent side can be replaced |

## Installed but not wired

Present in `node_modules`, not used by any code:

- **A2UI** — `@ag-ui/a2ui-toolkit`, `@ag-ui/a2ui-middleware`, `@copilotkit/a2ui-renderer`.
  Would let the agent emit UI rather than text. Requires binding `generate_a2ui` in the
  agent's tool list and mounting `A2UIProvider` + `A2UIRenderer` on the client.
- **MCP middleware** — `@ag-ui/mcp-apps-middleware`, `@ag-ui/mcp-middleware`.
- **CopilotKit channel adapters** — Slack, Teams. Unused; would let the same agent serve
  other surfaces.

## Not included

By design — see the scope section in the [README](README.md#scope):

- authentication, authorization, sessions, CSRF protection
- persistence, thread storage, checkpointing
- multi-user isolation, queues, concurrency control
- rate limiting, cost limits, quotas
- deployment configuration, containers, TLS
- tracing, metrics, alerting
