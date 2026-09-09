

import { useState } from "react";

type AIProvider = "openai";

interface AIConfigurationProps {
  onBack: () => void;

  onContinue: (
    provider: AIProvider,
    model: string,
    apiKey: string,
  ) => void;
}

export default function AIConfiguration({
  onBack,
  onContinue,
}: AIConfigurationProps) {
 const [provider, setProvider] = useState<AIProvider>("openai");
const [model, setModel] = useState("gpt-4o");
  
  const [apiKey, setApiKey] =
    useState("");

  const canContinue =
    model.trim() !== "" &&
    apiKey.trim() !== "";

  const handleContinue = () => {
    if (!canContinue) {
      return;
    }

    console.log(
      "[AI CONFIG] Configuration completed",
    );

    console.log(
      "[AI CONFIG] Provider:",
      provider,
    );

    console.log(
      "[AI CONFIG] Model:",
      model,
    );

    onContinue(
      provider,
      model.trim(),
      apiKey.trim(),
    );
  };

  return (
    <main className="flex h-[560px] w-[420px] flex-col overflow-hidden bg-zinc-50">
      {/* Header */}

      <header className="flex h-14 shrink-0 items-center border-b border-zinc-200 bg-white px-5">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900"
        >
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

      {/* Content */}

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

        {/* Provider */}

        <div className="mt-5">
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl border border-zinc-400 bg-zinc-50 px-3.5 py-3 text-left"
          >
            <Radio selected={true} />

            <div>
              <p className="text-sm font-medium text-zinc-800">
                OpenRouter
              </p>

              <p className="mt-0.5 text-[11px] text-zinc-500">
                Access GPT-4o through OpenRouter
              </p>
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
            onChange={(e) =>
              setModel(e.target.value)
            }
            placeholder="openai/gpt-4o"
            className="mt-2 h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100"
          />

          <p className="mt-1.5 text-[10px] text-zinc-400">
            OpenRouter model ID
          </p>
        </div>

        {/* API Key */}

        <div className="mt-4">
          <label
            htmlFor="api-key"
            className="block text-sm font-medium text-zinc-800"
          >
            OpenRouter API Key
          </label>

          <input
            id="api-key"
            type="password"
            value={apiKey}
            onChange={(e) =>
              setApiKey(e.target.value)
            }
            placeholder="sk-or-v1-..."
            className="mt-2 h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100"
          />

          <p className="mt-1.5 text-[10px] leading-4 text-zinc-400">
            Used only for making requests to OpenRouter.
            Never commit your key to GitHub.
          </p>
        </div>

        {/* Privacy Notice */}

        <div className="mt-5 flex gap-3 rounded-xl border border-zinc-200 bg-white p-3.5">
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

          <div>
            <p className="text-xs font-semibold text-zinc-800">
              Privacy protected
            </p>

            <p className="mt-0.5 text-[11px] leading-4 text-zinc-500">
              Page data is sanitized locally before
              being sent to the AI model.
            </p>
          </div>
        </div>
      </div>

      {/* Continue */}

      <div className="shrink-0 border-t border-zinc-200 bg-white px-6 py-4">
        <button
          type="button"
          disabled={!canContinue}
          onClick={handleContinue}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 text-sm font-semibold text-white transition hover:bg-zinc-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-zinc-300"
        >
          <span>Continue</span>

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

/* Radio */

function Radio({
  selected,
}: {
  selected: boolean;
}) {
  return (
    <span
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
        selected
          ? "border-zinc-900"
          : "border-zinc-300"
      }`}
    >
      {selected && (
        <span className="h-2 w-2 rounded-full bg-zinc-900" />
      )}
    </span>
  );
}


