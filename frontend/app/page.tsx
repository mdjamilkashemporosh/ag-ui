"use client";

import { useState } from "react";
import { Chat } from "./components/chat";
import { AgUiPanel } from "./components/ag-ui-panel";

export default function Home() {
  const [showEvents, setShowEvents] = useState(false);

  return (
    <main className={`shell ${showEvents ? "with-events" : ""}`}>
      <Chat
        eventsOpen={showEvents}
        onToggleEvents={() => setShowEvents((v) => !v)}
      />
      {showEvents && (
        <aside className="events">
          <AgUiPanel />
        </aside>
      )}
    </main>
  );
}
