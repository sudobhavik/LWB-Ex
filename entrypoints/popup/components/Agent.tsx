import React, {
  useState,
} from "react";
// This component represents the user interface for the PS171 Agent, allowing users to input tasks, view agent messages, and see a safe screenshot of the webpage. It manages the state of the user task input and handles starting the agent when the user submits a task. The component also displays the number of protected elements detected on the page and provides feedback on the agent's status.
interface AgentProps {
  detectedCount: number;
  onStartAgent: (userTask: string) => Promise<void>;
  safeScreenshot: string | null;
  running: boolean;
  agentMessage: string | null;
}

export default function Agent({
  detectedCount,
  onStartAgent,
  safeScreenshot,
  running,
  agentMessage,
}: AgentProps) {
  const [userTask, setUserTask] =
    useState("");

  const handleStart = async () => {
    const task =
      userTask.trim();

    if (!task || running) {
      return;
    }

    await onStartAgent(task);
  };

  return (
    <div className="flex h-[560px] w-[420px] flex-col overflow-hidden bg-zinc-50">

      {/* HEADER */}

      <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4 py-3">

        <div>
          <h2 className="text-sm font-bold text-zinc-900">
            PS171 Agent
          </h2>

          <p className="text-[11px] text-zinc-500">
            {running
              ? "Agent working..."
              : "Privacy protected"}
          </p>
        </div>

        <div className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-700">
          {detectedCount} protected
        </div>

      </div>


      {/* CHAT */}

      <div className="flex-1 overflow-y-auto p-4">

        <div className="space-y-4">

          <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-white p-3 shadow-sm">

            <p className="text-xs leading-5 text-zinc-700">
              Tell me what you want me to do
              on the current webpage.
            </p>

          </div>


          {userTask && (
            <div className="ml-auto max-w-[90%] rounded-2xl rounded-tr-sm bg-zinc-900 p-3 shadow-sm">

              <p className="text-xs leading-5 text-white">
                {userTask}
              </p>

            </div>
          )}


          {safeScreenshot && (
            <div className="max-w-full rounded-2xl rounded-tl-sm bg-white p-3 shadow-sm">

              <p className="mb-2 text-[11px] font-semibold text-zinc-500">
                SAFE SCREENSHOT
              </p>

              <div className="flex max-h-[300px] w-full items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 p-1">

                <img
                  src={safeScreenshot}
                  alt="Sanitized webpage screenshot"
                  className="block max-h-[290px] max-w-full object-contain"
                />

              </div>

            </div>
          )}
          {agentMessage && (
  <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-white p-3 shadow-sm">
    <p className="text-xs leading-5 text-zinc-700">
      {agentMessage}
    </p>
  </div>
)}

        </div>

      </div>


      {/* INPUT */}

      <div className="shrink-0 border-t border-zinc-200 bg-white p-3">

        <div className="flex gap-2">

          <input
            value={userTask}
            onChange={(e) =>
              setUserTask(
                e.target.value,
              )
            }
            onKeyDown={(e) => {
              if (
                e.key === "Enter"
              ) {
                e.preventDefault();
                handleStart();
              }
            }}
            disabled={running}
            placeholder="What should I do?"
            className="
              h-10 min-w-0 flex-1
              rounded-lg border border-zinc-200
              bg-zinc-50 px-3 text-xs
              text-zinc-900 outline-none
              placeholder:text-zinc-400
              focus:border-zinc-400
            "
          />

          <button
            type="button"
            onClick={handleStart}
            disabled={
              running ||
              !userTask.trim()
            }
            className="
              h-10 shrink-0 rounded-lg
              bg-zinc-900 px-4
              text-xs font-semibold text-white
              transition hover:bg-zinc-800
              disabled:cursor-not-allowed
              disabled:opacity-40
            "
          >
            {running
              ? "Running..."
              : "Run"}
          </button>

        </div>

      </div>

    </div>
  );
}