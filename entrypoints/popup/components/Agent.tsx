interface AgentProps {
  detectedCount: number;
}
// This React component represents the user interface for the Browser Agent popup. It displays the detection status of sensitive and financial elements on the webpage, provides a text area for users to describe tasks they want the agent to perform, and includes a button to start the agent. The component receives a prop called detectedCount, which indicates the number of detected sensitive elements.
export default function Agent({
  detectedCount,
}: AgentProps) {
  return (
    <main className="flex h-[560px] w-[420px] flex-col overflow-hidden bg-zinc-50">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center border-b border-zinc-200 bg-white px-5">
        <div className="flex items-center gap-2">
          <span className="text-sm">🤖</span>

          <span className="text-sm font-semibold text-zinc-900">
            Browser Agent
          </span>
        </div>
      </header>

      {/* Detection Status */}
      <div className="px-6 pt-5">
        <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3">
          <div>
            <p className="text-xs font-semibold text-zinc-800">
              Perception
            </p>

            <p className="mt-0.5 text-[11px] text-zinc-500">
              Sensitive & financial elements detected
            </p>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg bg-zinc-100 px-2.5 py-1.5">
            <span className="text-sm">🛡️</span>

            <span className="text-sm font-semibold text-zinc-900">
              {detectedCount}
            </span>

            <span className="text-[11px] text-zinc-500">
              detected
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col px-6 pt-10">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-900">
            What would you like to do?
          </h1>

          <p className="mt-1 text-xs text-zinc-500">
            Describe the task you want the browser agent to perform.
          </p>
        </div>

        {/* Task Input */}
        <textarea
          placeholder="e.g. Find the cheapest product and add it to the cart"
          className="mt-5 h-28 w-full resize-none rounded-xl border border-zinc-200 bg-white px-3.5 py-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100"
        />

        {/* Start Agent */}
        <button
          type="button"
          className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 text-sm font-semibold text-white transition hover:bg-zinc-800 active:scale-[0.99]"
        >
          <span>Start Agent</span>

          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M5 12H19"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />

            <path
              d="M13 6L19 12L13 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </main>
  );
}