# agent

The LangGraph side of the [AG-UI LangGraph Agent](../README.md).

A single graph, exposed as `sample_agent` by the LangGraph dev server on port 8123.

**This directory contains no AG-UI code.** It has no `@ag-ui/*` dependency and never
imports one. Protocol translation happens in the frontend's API route — see the
[root README](../README.md#how-it-works).

---

## The graph

`src/agent.ts` compiles:

```
START → agent → (tool_calls?) ─yes→ tools ─┐
                     │                     │
                     no                    │
                     ↓                     │
                    END ←──────────────────┘
```

- **`agent`** — `ChatDeepSeek` with `deepseek-chat` at `temperature: 0`, tools bound.
- **`tools`** — a `ToolNode` over one tool, `get_weather`.
- **`shouldContinue`** — routes back to `tools` while the last `AIMessage` carries
  `tool_calls`, otherwise to `END`.

State is `MessagesAnnotation`, so the message list lives at `state.messages`. The adapter
relies on that key to build `MESSAGES_SNAPSHOT` and to attach tool calls to assistant
messages — renaming it would break the mapping.

## How a run executes

1. The model is invoked with the current message list.
2. If the reply contains `tool_calls`, the conditional edge sends control to the `tools`
   node; `ToolNode` executes each call and appends a tool message.
3. Control returns to `agent` with the tool output in the message list.
4. When a reply has no `tool_calls`, the edge routes to `END` and the run finishes.

Each of these steps is visible in the frontend's events panel as a `TOOL_CALL_*`,
`TEXT_MESSAGE_*`, or `RUN_*` event.

## Technologies

| Package                    | Version | Role                                           |
| -------------------------- | ------- | ---------------------------------------------- |
| `@langchain/langgraph`     | 1.7.5   | `StateGraph`, `MessagesAnnotation`, `ToolNode` |
| `@langchain/core`          | 1.4.2   | `tool`, `AIMessage`                            |
| `@langchain/deepseek`      | 1.1.25  | `ChatDeepSeek` model client                    |
| `zod`                      | 4.6.7   | Tool argument schema                           |
| `@langchain/langgraph-cli` | 1.8.0   | `langgraphjs dev` server                       |

## Tools

`get_weather` is a stub. It returns a fixed string for any city:

```ts
const getWeather = tool(async ({ city }) => `It's 28°C and sunny in ${city}.`, {
  name: "get_weather",
  description: "Get the current weather for a city",
  schema: z.object({ city: z.string() }),
});
```

To add a tool, define it the same way and append it to the `tools` array. The graph needs
no other change — the conditional edge already handles any number of tool calls.

## Environment

| Variable           | Required | Purpose                 |
| ------------------ | -------- | ----------------------- |
| `DEEPSEEK_API_KEY` | **yes**  | Auth for `ChatDeepSeek` |

Put it in `agent/.env`:

```bash
DEEPSEEK_API_KEY=sk-...
```

`langgraph.json` declares `"env": ".env"`, so the dev server loads that file itself. It is
gitignored, and the key stays inside this process.

## Running

```bash
npm install
printf 'DEEPSEEK_API_KEY=sk-...\n' > .env
npm run dev
```

Runs `langgraphjs dev --port 8123 --no-browser`. Serves <http://localhost:8123>.

The frontend discovers the graph by id — `sample_agent` here must match `graphId` in
`frontend/app/api/copilotkit/[[...slug]]/route.ts`.

Requirements: Node.js 20+ (`langgraph.json` pins `node_version: 20`), port 8123 free.
Without a key, runs fail at the model call and surface as `RUN_ERROR` in the frontend.

## Notes

- `deepseek-chat` is used rather than `deepseek-reasoner` because the reasoner is a poor
  fit for tool calling.
- The `get_weather` result is hardcoded — there is no network call and no real forecast.
- Security, persistence, and scaling are out of scope by design. This is base
  infrastructure; those concerns are the integrator's responsibility. See
  [Scope](../README.md#scope).
- No auth, no persistence, no checkpointing. Dev server only.

## License

See [LICENSE](../LICENSE). Free for personal, educational, research, and non-commercial
use. **Commercial use requires permission first.**
