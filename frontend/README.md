# frontend

The Next.js client for the [AG-UI LangGraph Agent](../README.md).

This half is where AG-UI actually lives: the API route translates LangGraph's stream into
AG-UI events, and the browser renders them.

---

## Structure

| File                                      | Role                                                                         |
| ----------------------------------------- | ---------------------------------------------------------------------------- |
| `app/layout.tsx`                          | CopilotKit provider — `runtimeUrl="/api/copilotkit"`, `agent="sample_agent"` |
| `app/api/copilotkit/[[...slug]]/route.ts` | Registers the agent, exports the AG-UI handler                               |
| `app/page.tsx`                            | Layout, events-panel toggle                                                  |
| `app/components/chat.tsx`                 | Chat transcript, status line, tool cards                                     |
| `app/components/ag-ui-panel.tsx`          | Live AG-UI event log                                                         |
| `app/components/chat.css`                 | Chat styling                                                                 |

`app/api/copilotkit/[[...slug]]/route.ts` is the only place the frontend imports
`@ag-ui/langgraph`:

```ts
const runtime = new CopilotRuntime({
  agents: {
    sample_agent: new LangGraphAgent({
      deploymentUrl:
        process.env.LANGGRAPH_DEPLOYMENT_URL || "http://localhost:8123",
      graphId: "sample_agent",
    }),
  },
  runner: new InMemoryAgentRunner(),
});

const handler = createCopilotRuntimeHandler({
  runtime,
  basePath: "/api/copilotkit",
});
export const GET = handler;
export const POST = handler;
```

Everything below the browser is handled by CopilotKit and AG-UI: one POST stays open and
events arrive over SSE. No polling, no websocket.

## How a run flows through the client

1. `chat.tsx` appends the user message and calls `copilotkit.runAgent({ agent })`.
2. `@ag-ui/client` `POST`s to `/api/copilotkit` and keeps the response open.
3. Incoming SSE frames are parsed and applied: `TEXT_MESSAGE_CONTENT` deltas accumulate
   into assistant messages, `TOOL_CALL_ARGS` into tool-call arguments, `STATE_SNAPSHOT`
   into `agent.state`.
4. Every raw event is re-emitted to subscribers — which is how two components can watch
   the same stream independently.
5. `agent.isRunning` flips false on `RUN_FINISHED` or `RUN_ERROR`.

## Technologies

| Package                  | Version | Role                         |
| ------------------------ | ------- | ---------------------------- |
| `next`                   | 16.4.6  | App router, API route        |
| `react`                  | 19.3.0  | UI                           |
| `@copilotkit/runtime`    | 1.89.0  | HTTP handler, agent registry |
| `@copilotkit/react-core` | 1.89.0  | `useAgent`, `useCopilotKit`  |
| `@ag-ui/langgraph`       | 0.0.46  | Server-side protocol adapter |
| `@ag-ui/client`          | 1.0.5   | Browser-side event consumer  |
| `react-markdown`         | —       | Renders assistant text       |

## Environment

| Variable                   | Required | Default                 | Purpose                          |
| -------------------------- | -------- | ----------------------- | -------------------------------- |
| `LANGGRAPH_DEPLOYMENT_URL` | no       | `http://localhost:8123` | Where the LangGraph server lives |

Put overrides in `frontend/.env.local`. No API key is needed here — `DEEPSEEK_API_KEY`
lives in `agent/.env` and never reaches the browser.

## Running

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. Start the agent first — see [`../agent`](../agent).
Requirements: Node.js 20+, port 3000 free, and the agent reachable on 8123.

Other scripts: `npm run build`, `npm run start`, `npm run lint`.

## How events reach the UI

`chat.tsx` and `ag-ui-panel.tsx` each call `agent.subscribe({ onEvent })` on the
`AbstractAgent` returned by `useAgent`. Two independent consumers of one stream:

- **`chat.tsx`** switches on `RUN_STARTED`, `TOOL_CALL_START`, `TOOL_CALL_RESULT`,
  `TEXT_MESSAGE_START`, `RUN_FINISHED`, `RUN_ERROR` to drive the status line.
  Transcript content comes from `agent.messages`, not from raw events.
- **`ag-ui-panel.tsx`** logs every event received, colour-coded by family, merging
  `TEXT_MESSAGE_CONTENT` and `TOOL_CALL_ARGS` deltas into single rows. Events it has no
  formatter for still appear, by type with an empty detail column.

Adding a status state means adding a `case` to the switch in `useAgentStatus`.

## Tool-based generative UI

The agent decides which tool to call and with what arguments; this client decides how that
tool is drawn. Nothing in the UI is hardcoded to a conversation — the card appears because
the agent chose to call `get_weather`, and it fills in as arguments and results stream in.

| Step | What happens                                                                     |
| ---- | -------------------------------------------------------------------------------- |
| 1    | `TOOL_CALL_START` arrives with `toolCallName`                                    |
| 2    | `TOOL_CALL_ARGS` deltas accumulate — parsed on each render, invalid JSON ignored |
| 3    | `TOOLS[name]` supplies the icon and title                                        |
| 4    | `ToolCard` renders `Queued` → `Running`                                          |
| 5    | `TOOL_CALL_RESULT` arrives, matched by `toolCallId` → state becomes `Done`       |

### Adding a tool card

Add an entry to the `TOOLS` map in `chat.tsx`:

```ts
const TOOLS: Record<string, ToolMeta> = {
  get_weather: { icon: "🌤️", title: (a) => `Weather · ${a.city}` },
};
```

The tool name arrives in `TOOL_CALL_START`, so the card renders automatically once the
agent starts calling it. Tools without an entry fall back to pretty-printed JSON, so an
unmapped tool degrades gracefully rather than breaking the thread.

This is the same mechanism CopilotKit exposes as `useRenderTool`, wired directly: one map,
one component, no provider and no extra dependency. If you want a bespoke component per
tool rather than a shared card, that hook is the natural upgrade path.

**Limit:** tool-based only. The agent picks among tools you registered — it cannot emit a
UI specification of its own. Free-form generation is not wired here.

## Notes

- **No auth.** The route accepts unauthenticated requests.
- `InMemoryAgentRunner` keeps thread state in process memory only.
- Security, persistence, multi-user handling, and deployment are out of scope by design.
  See [Scope](../README.md#scope); the rest is on your end.
- This is a Next.js 16 app; several conventions differ from older versions. `AGENTS.md`
  points at the bundled docs in `node_modules/next/dist/docs/`.

## License

See [LICENSE](../LICENSE). Free for personal, educational, research, and non-commercial
use. **Commercial use requires permission first.**
