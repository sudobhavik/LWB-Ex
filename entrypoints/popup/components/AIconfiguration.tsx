
import { useState } from "react";

type AIProvider = "openai" | "gemini" | "local";

interface AIConfigurationProps {
  onBack: () => void;
  onContinue: () => void;
}
// this is aI CONFIguration component from where we can select ai provider
export default function AIConfiguration({
  onBack,
  onContinue,
}: AIConfigurationProps) {
  const [provider, setProvider] = useState<AIProvider>("openai");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");

  const canContinue =
    model.trim() !== "" && apiKey.trim() !== "";

  return (
    <main className="flex h-[560px] w-[420px] flex-col overflow-hidden bg-zinc-50">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center border-b border-zinc-200 bg-white px-5">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900"
        >
          {/* Back icon */}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M19 12H5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />

            <path
              d="M12 19L5 12L12 5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          <span>AI Configuration</span>
        </button>
      </header>

      {/* Scrollable Content */}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {/* Heading */}
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-900">
            Choose AI Provider
          </h1>

          <p className="mt-1 text-xs text-zinc-500">
            Select the AI service your browser agent will use.
          </p>
        </div>

        {/* Providers */}
        <div className="mt-5 space-y-2">
          {/* OpenAI */}
          <button
            type="button"
            onClick={() => setProvider("openai")}
            className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition ${
              provider === "openai"
                ? "border-zinc-400 bg-zinc-50"
                : "border-zinc-200 bg-white hover:border-zinc-300"
            }`}
          >
            <Radio selected={provider === "openai"} />

            <div>
              <p className="text-sm font-medium text-zinc-800">
                OpenAI
              </p>

              <p className="mt-0.5 text-[11px] text-zinc-500">
                Use OpenAI models
              </p>
            </div>
          </button>

          {/* Gemini */}
          <button
            type="button"
            onClick={() => setProvider("gemini")}
            className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition ${
              provider === "gemini"
                ? "border-zinc-400 bg-zinc-50"
                : "border-zinc-200 bg-white hover:border-zinc-300"
            }`}
          >
            <Radio selected={provider === "gemini"} />

            <div>
              <p className="text-sm font-medium text-zinc-800">
                Gemini
              </p>

              <p className="mt-0.5 text-[11px] text-zinc-500">
                Use Google Gemini models
              </p>
            </div>
          </button>

          {/* Local Model */}
          <button
            type="button"
            disabled
            className="flex w-full cursor-not-allowed items-center gap-3 rounded-xl border border-zinc-200 bg-white px-3.5 py-3 text-left opacity-50"
          >
            <Radio selected={false} />

            <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-zinc-800">
                  Local Model
                </p>

                <p className="mt-0.5 text-[11px] text-zinc-500">
                  Run AI locally on your device
                </p>
              </div>

              <span className="shrink-0 rounded-md bg-zinc-100 px-2 py-1 text-[10px] font-medium text-zinc-500">
                Coming Soon
              </span>
            </div>
          </button>
        </div>

        {/* Model */}
        <div className="mt-5">
          <label
            htmlFor="model"
            className="block text-sm font-medium text-zinc-800"
          >
            Model
          </label>

          <input
            id="model"
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={
              provider === "openai"
                ? "e.g. gpt-4o"
                : "e.g. gemini-2.5-flash"
            }
            className="mt-2 h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100"
          />
        </div>

        {/* API Key */}
        <div className="mt-4">
          <label
            htmlFor="api-key"
            className="block text-sm font-medium text-zinc-800"
          >
            API Key
          </label>

          <input
            id="api-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your API key"
            className="mt-2 h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100"
          />
        </div>

        {/* Privacy Notice */}
        <div className="mt-5 flex gap-3 rounded-xl border border-zinc-200 bg-white p-3.5">
          {/* Shield Icon */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M12 3L19 6V11C19 15.5 16.1 19.5 12 21C7.9 19.5 5 15.5 5 11V6L12 3Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />

              <path
                d="M9 12L11 14L15 10"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {/* Privacy Text */}
          <div>
            <p className="text-xs font-semibold text-zinc-800">
              Privacy protected
            </p>

            <p className="mt-0.5 text-[11px] leading-4 text-zinc-500">
              Page data is sanitized before being sent to AI.
            </p>
          </div>
        </div>
      </div>

      {/* Fixed Continue Section */}
      <div className="shrink-0 border-t border-zinc-200 bg-white px-6 py-4">
        <button
          type="button"
          disabled={!canContinue}
          onClick={onContinue}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 text-sm font-semibold text-white transition hover:bg-zinc-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-zinc-300"
        >
          <span>Continue</span>

          {/* Arrow Icon */}
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

/* Radio Button */
function Radio({ selected }: { selected: boolean }) {
  return (
    <span
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
        selected ? "border-zinc-900" : "border-zinc-300"
      }`}
    >
      {selected && (
        <span className="h-2 w-2 rounded-full bg-zinc-900" />
      )}
    </span>
  );
}