"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useAgent, useCopilotKit } from "@copilotkit/react-core/v2";
import "./chat.css";

const AGENT_ID = "sample_agent";

type AgentInstance = ReturnType<typeof useAgent>["agent"];

type Phase = "idle" | "thinking" | "tool" | "writing" | "error";
type Status = { phase: Phase; label: string };

type ToolCall = {
  id: string;
  function?: { name?: string; arguments?: string };
};

type ChatMessage = {
  id: string;
  role: string;
  content?: unknown;
  toolCalls?: ToolCall[];
  toolCallId?: string;
};

type StatusEvent = { type: string; toolCallName?: string; message?: string };

type ToolMeta = {
  icon: string;
  title: (args: Record<string, unknown>) => string;
};

// Add new tools here: icon + card title
const TOOLS: Record<string, ToolMeta> = {
  get_weather: {
    icon: "🌤️",
    title: (a) => `Weather · ${typeof a.city === "string" ? a.city : "…"}`,
  },
};

const SUGGESTIONS = [
  "What's the weather in Dhaka?",
  "Compare the weather in Tokyo and Paris",
  "Is it nice in Kushtia today?",
];

function asText(content: unknown): string {
  if (typeof content === "string") return content;
  if (content == null) return "";
  try {
    return JSON.stringify(content);
  } catch {
    return String(content);
  }
}

/** Turns raw AG-UI events into a human-readable status. */
function useAgentStatus(agent: AgentInstance): Status {
  const [status, setStatus] = useState<Status>({
    phase: "idle",
    label: "Ready",
  });

  useEffect(() => {
    const { unsubscribe } = agent.subscribe({
      onEvent: ({ event }) => {
        const e = event as unknown as StatusEvent;
        switch (e.type) {
          case "RUN_STARTED":
            setStatus({ phase: "thinking", label: "Thinking…" });
            break;
          case "TOOL_CALL_START":
            setStatus({
              phase: "tool",
              label: `Calling ${e.toolCallName ?? "tool"}…`,
            });
            break;
          case "TOOL_CALL_RESULT":
            setStatus({ phase: "thinking", label: "Reading tool result…" });
            break;
          case "TEXT_MESSAGE_START":
            setStatus({ phase: "writing", label: "Writing answer…" });
            break;
          case "RUN_FINISHED":
            setStatus({ phase: "idle", label: "Ready" });
            break;
          case "RUN_ERROR":
            setStatus({
              phase: "error",
              label: e.message ?? "Something went wrong",
            });
            break;
        }
      },
    });
    return () => unsubscribe();
  }, [agent]);

  return status;
}

function ToolCard({
  call,
  result,
  running,
}: {
  call: ToolCall;
  result?: string;
  running: boolean;
}) {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(call.function?.arguments || "{}") as Record<
      string,
      unknown
    >;
  } catch {
    /* arguments still streaming */
  }
  const name = call.function?.name ?? "tool";
  const meta = TOOLS[name];
  const state = result !== undefined ? "done" : running ? "running" : "pending";

  return (
    <div className="tool">
      <div className="tool-head">
        <span>
          {meta?.icon ?? "🛠️"} {meta ? meta.title(args) : name}
        </span>
        <span className={`tool-state ${state}`}>
          {state === "running" && <span className="spinner" />}
          {state === "done"
            ? "Done"
            : state === "running"
              ? "Running"
              : "Queued"}
        </span>
      </div>
      <div className="tool-body">
        {state === "done"
          ? result
          : !meta && <pre>{JSON.stringify(args, null, 2)}</pre>}
      </div>
    </div>
  );
}

export function Chat({
  eventsOpen,
  onToggleEvents,
}: {
  eventsOpen: boolean;
  onToggleEvents: () => void;
}) {
  const { agent } = useAgent({ agentId: AGENT_ID });
  const { copilotkit } = useCopilotKit();
  const status = useAgentStatus(agent);
  const [input, setInput] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  const messages = agent.messages as unknown as ChatMessage[];
  const running = agent.isRunning;

  const toolResults = new Map<string, string>();
  for (const m of messages) {
    if (m.role === "tool" && m.toolCallId) {
      toolResults.set(m.toolCallId, asText(m.content));
    }
  }
  const visible = messages.filter(
    (m) => m.role === "user" || m.role === "assistant",
  );

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, status.label, running]);

  useEffect(() => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [input]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || running) return;
    setInput("");
    agent.addMessage({ id: crypto.randomUUID(), role: "user", content });
    try {
      await copilotkit.runAgent({ agent });
    } catch (err) {
      console.error("Agent run failed:", err);
    }
  }

  function stop() {
    (agent as unknown as { abortRun?: () => void }).abortRun?.();
  }

  return (
    <div className="chat">
      <header className="chat-header">
        <div className="brand">
          <div className="logo">✦</div>
          <div>
            DeepSeek Agent
            <small>LangGraph · AG-UI · CopilotKit</small>
          </div>
        </div>
        <div className="header-right">
          <span className="pill">
            <span className={`dot ${status.phase}`} />
            {status.phase === "idle" ? "Idle" : status.label}
          </span>
          <button className="ghost-btn" onClick={onToggleEvents}>
            {eventsOpen ? "Hide events" : "Events"}
          </button>
        </div>
      </header>

      <div className="scroll">
        <div className="thread">
          {visible.length === 0 && (
            <div className="empty">
              <div
                className="logo"
                style={{
                  margin: "0 auto",
                  width: 48,
                  height: 48,
                  fontSize: 22,
                }}
              >
                ✦
              </div>
              <h1>How can I help?</h1>
              <p>
                Ask about the weather and watch the agent work in real time.
              </p>
              <div className="chips">
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="chip" onClick={() => void send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {visible.map((m) => {
            const text = asText(m.content);
            return m.role === "user" ? (
              <div key={m.id} className="msg user">
                <div className="bubble-user">{text}</div>
              </div>
            ) : (
              <div key={m.id} className="msg">
                <div className="avatar">✦</div>
                <div className="body">
                  {m.toolCalls?.map((c) => (
                    <ToolCard
                      key={c.id}
                      call={c}
                      result={toolResults.get(c.id)}
                      running={running}
                    />
                  ))}
                  {text.trim() && (
                    <div className="md">
                      <ReactMarkdown>{text}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Live agent status, directly in the thread */}
          {(running || status.phase === "error") && (
            <div className="msg">
              <div className="avatar">✦</div>
              <div className="body">
                <div
                  className={`status ${status.phase === "error" ? "error" : ""}`}
                >
                  {status.phase !== "error" && (
                    <span className="typing">
                      <i />
                      <i />
                      <i />
                    </span>
                  )}
                  {status.label}
                </div>
              </div>
            </div>
          )}
          <div ref={bottom} />
        </div>
      </div>

      <div className="composer-wrap">
        <div className="composer">
          <textarea
            ref={textarea}
            rows={1}
            value={input}
            placeholder="Message the agent…"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
          />
          {running ? (
            <button className="send stop" title="Stop" onClick={stop}>
              ■
            </button>
          ) : (
            <button
              className="send"
              title="Send"
              disabled={!input.trim()}
              onClick={() => void send(input)}
            >
              ↑
            </button>
          )}
        </div>
        <div className="disclaimer">
          AI can make mistakes. Please verify important information.
        </div>
      </div>
    </div>
  );
}
