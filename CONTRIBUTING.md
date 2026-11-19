# Contributing

Thanks for taking a look. This project is deliberately small, and contributions are
welcome within that scope.

---

## Read this first

This repository is **base infrastructure**. It covers the wiring between a LangGraph
agent and an AG-UI React client, and nothing else.

That means some things are out of scope by design, not by neglect:

- authentication, authorization, sessions, CSRF
- persistence, databases, thread storage
- multi-user isolation, queues, scaling
- deployment, containers, TLS
- observability, metrics, cost tracking

If your idea adds one of those, it is probably better as your own fork. If it improves
the wiring, the protocol handling, or the inspector, it belongs here.

## Setup

Two independent installs, no workspace tooling.

```bash
# agent
cd agent
npm install
printf 'DEEPSEEK_API_KEY=sk-...\n' > .env
npm run dev          # http://localhost:8123

# frontend
cd frontend
npm install
npm run dev          # http://localhost:3000
```

Requires Node 20+ and a DeepSeek API key. Do not commit `.env` — it is gitignored, and
keep it that way.

## Architecture rules

Three rules keep the project legible. Please preserve them.

1. **`agent/` stays AG-UI-free.** It must not gain an `@ag-ui/*` dependency. The whole
   point is that the agent knows nothing about the protocol.
2. **Translation lives in one file.** Only
   `frontend/app/api/copilotkit/[[...slug]]/route.ts` imports `@ag-ui/langgraph`. Do not
   spread adapter logic into components.
3. **Components consume, they don't translate.** UI code reads typed AG-UI events and
   `agent.messages`. It should not know LangGraph exists.

## Adding a tool

1. Define it in `agent/src/agent.ts` with `tool(...)` and a zod schema, and add it to the
   `tools` array.
2. Optionally add an icon and title to the `TOOLS` map in
   `frontend/app/components/chat.tsx`.

That is the whole change. `TOOL_CALL_START` carries the name, so the card renders
automatically and unknown tools fall back to JSON.

## Adding an event handler

Status text comes from the switch in `useAgentStatus` in `chat.tsx`. Add a `case` keyed on
the event type, and keep the label short — it renders in a pill and inline in the thread.

If you add a handler for an event type the client does not already fold into state, check
that the field you read is actually populated. See `FEATURES.md` for which events are
applied by `@ag-ui/client` versus merely forwarded.

## Before you open a pull request

- `npm run lint` in `frontend/` passes
- `npm run build` in `frontend/` passes
- You ran both processes and sent at least one message that triggers the tool
- You checked the Events panel for `RUN_ERROR` and unexpected event types
- No secrets, keys, or `.env` content in the diff
- No `node_modules` or `.next` in the diff

## Pull requests

Describe:

- what the change does and why
- which files it touches
- whether it changes behaviour of the translator or the event handling
- anything you tested manually

Small, focused pull requests get reviewed faster than broad ones. If a change alters the
protocol surface, say so explicitly — it is a contract, not an implementation detail.

## Reporting bugs

Useful reports include:

- what you did, what you expected, what happened
- the relevant lines from the Events panel (event type and payload)
- the versions from the root README's version table
- whether the LangGraph server was reachable on `:8123`

For agent-side failures, the `RUN_ERROR` payload usually carries the model or tool error
verbatim.

## License of contributions

By submitting a contribution you agree it may be distributed under the terms in
[LICENSE](LICENSE), and that the maintainer may grant commercial permission for the
project as a whole. See that file before contributing if either point matters to you.
