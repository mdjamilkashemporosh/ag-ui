"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useAgent } from "@copilotkit/react-core/v2";

/** Only the AG-UI event fields we actually read. */
type AgUiEvent = {
  type: string;
  delta?: string;
  toolCallName?: string;
  content?: unknown;
  snapshot?: unknown;
  messages?: unknown[];
  message?: string;
};

type Entry = {
  id: number;
  time: string;
  type: string;
  detail: string;
  count: number;
};

const COLOR: Record<string, string> = {
  RUN_STARTED: "#16a34a",
  RUN_FINISHED: "#16a34a",
  RUN_ERROR: "#dc2626",
  TEXT_MESSAGE_START: "#2563eb",
  TEXT_MESSAGE_CONTENT: "#2563eb",
  TEXT_MESSAGE_END: "#2563eb",
  TOOL_CALL_START: "#d97706",
  TOOL_CALL_ARGS: "#d97706",
  TOOL_CALL_END: "#d97706",
  TOOL_CALL_RESULT: "#d97706",
  STATE_SNAPSHOT: "#9333ea",
  STATE_DELTA: "#9333ea",
  MESSAGES_SNAPSHOT: "#0891b2",
};

const MERGEABLE = new Set(["TEXT_MESSAGE_CONTENT", "TOOL_CALL_ARGS"]);
const MAX_DETAIL = 5000;
const PREVIEW = 160;

function stringify(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return String(value);
  }
}

function describe(e: AgUiEvent): string {
  switch (e.type) {
    case "TEXT_MESSAGE_CONTENT":
    case "TOOL_CALL_ARGS":
      return e.delta ?? "";
    case "TOOL_CALL_START":
      return e.toolCallName ?? "";
    case "TOOL_CALL_RESULT":
      return stringify(e.content);
    case "STATE_SNAPSHOT":
      return stringify(e.snapshot ?? {});
    case "STATE_DELTA":
      return stringify(e.delta ?? []);
    case "MESSAGES_SNAPSHOT":
      return `${e.messages?.length ?? 0} messages (full history)`;
    case "RUN_ERROR":
      return e.message ?? "";
    default:
      return "";
  }
}

export function AgUiPanel() {
  const { agent } = useAgent({ agentId: "sample_agent" });
  const [entries, setEntries] = useState<Entry[]>([]);
  const nextId = useRef(0);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const { unsubscribe } = agent.subscribe({
      onEvent: ({ event }) => {
        const e = event as unknown as AgUiEvent;
        const type = String(e.type);
        const detail = describe(e).slice(0, MAX_DETAIL);
        const time = new Date().toLocaleTimeString();

        setEntries((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.type === type && MERGEABLE.has(type)) {
            const merged: Entry = {
              ...last,
              detail: (last.detail + detail).slice(0, MAX_DETAIL),
              count: last.count + 1,
            };
            return [...prev.slice(0, -1), merged];
          }
          const entry: Entry = {
            id: nextId.current++,
            time,
            type,
            detail,
            count: 1,
          };
          return [...prev, entry].slice(-300);
        });
      },
    });
    return () => unsubscribe();
  }, [agent]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

  const box: CSSProperties = {
    border: "1px solid rgba(127,127,127,0.3)",
    borderRadius: 10,
    background: "rgba(127,127,127,0.06)",
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        height: "100%",
        minHeight: 0,
        minWidth: 0,
      }}
    >
      <div style={{ ...box, padding: 12, fontSize: 13 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontWeight: 600,
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: agent.isRunning ? "#16a34a" : "#9ca3af",
            }}
          />
          {agent.isRunning ? "Agent running…" : "Agent idle"}
        </div>
        <div style={{ opacity: 0.7, marginTop: 6 }}>
          Messages: {agent.messages.length} · Events: {entries.length}
        </div>
        <details style={{ marginTop: 8 }}>
          <summary style={{ cursor: "pointer" }}>Shared state</summary>
          <pre style={{ fontSize: 11, overflow: "auto", maxHeight: 120 }}>
            {JSON.stringify(agent.state ?? {}, null, 2)}
          </pre>
        </details>
      </div>

      <div
        style={{
          ...box,
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "8px 12px",
            display: "flex",
            justifyContent: "space-between",
            borderBottom: "1px solid rgba(127,127,127,0.3)",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          AG-UI events
          <button
            onClick={() => setEntries([])}
            style={{
              fontSize: 12,
              cursor: "pointer",
              background: "none",
              border: "none",
              color: "inherit",
              opacity: 0.7,
            }}
          >
            Clear
          </button>
        </div>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
            padding: 8,
            fontFamily: "ui-monospace, monospace",
            fontSize: 11.5,
          }}
        >
          {entries.length === 0 && (
            <div style={{ opacity: 0.6, padding: 8 }}>
              Send a message to see the event stream.
            </div>
          )}
          {entries.map((e) => (
            <div
              key={e.id}
              style={{ padding: "3px 0", display: "flex", gap: 6, minWidth: 0 }}
            >
              <span style={{ opacity: 0.5, flexShrink: 0 }}>{e.time}</span>
              <span
                style={{
                  color: COLOR[e.type] ?? "inherit",
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {e.type}
                {e.count > 1 ? ` ×${e.count}` : ""}
              </span>
              <span
                style={{ opacity: 0.85, minWidth: 0, overflowWrap: "anywhere" }}
              >
                {e.detail.length > PREVIEW ? (
                  <details>
                    <summary style={{ cursor: "pointer" }}>
                      {e.detail.slice(0, PREVIEW)}…
                    </summary>
                    {e.detail}
                  </details>
                ) : (
                  e.detail
                )}
              </span>
            </div>
          ))}
          <div ref={bottom} />
        </div>
      </div>
    </div>
  );
}
