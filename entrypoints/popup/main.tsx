import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import "./style.css";

import AIConfiguration from "./components/AIconfiguration";
import Agent from "./components/Agent";

function App() {
  
  const [showAIConfiguration, setShowAIConfiguration] =
    useState(false);
    const [detectedCount, setDetectedCount] = useState(0);

  const [showAgent, setShowAgent] =
    useState(false);

  if (showAgent) {
    return <Agent detectedCount={detectedCount} />;
  }

  if (showAIConfiguration) {
    return (
      <AIConfiguration
        onBack={() => setShowAIConfiguration(false)}
       onContinue={async () => {
  console.log("AI configuration completed");

  const [tab] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  }); // Get the active tab in the current window

  if (!tab?.id) {
    return;
  }

  const perception = await browser.tabs.sendMessage(
    tab.id,
    {
      type: "GET_PERCEPTION",
    },
  );// Send a message to the content script to get the perception data

  console.log("Popup received:", perception);

  setDetectedCount(perception.sensitiveCount);
  setShowAgent(true);
}}
      />
    );
  }

  return (
    <main className="flex h-[560px] w-[420px] items-center justify-center overflow-hidden bg-zinc-50 p-5">
      <div className="w-full rounded-2xl border border-zinc-200 bg-white px-7 py-8 shadow-sm">

        {/* Logo */}
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-100 text-zinc-900">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
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

        {/* Hero */}
        <div className="text-center">
          <h1 className="text-[25px] font-bold tracking-tight text-zinc-900">
            Welcome to PS171
          </h1>

          <p className="mt-2 text-sm font-medium text-zinc-600">
            Privacy-first browser agent
          </p>

          <p className="mx-auto mt-3 max-w-[300px] text-[13px] leading-5 text-zinc-500">
            Your sensitive information stays protected
            before AI sees it.
          </p>
        </div>

        {/* Features */}
        <div className="mt-7 space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <Feature title="Local privacy detection" />

          <Feature title="Sensitive data blurring" />

          <Feature title="AI browser automation" />
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={() => setShowAIConfiguration(true)}
          className="
            mt-5
            flex
            h-11
            w-full
            items-center
            justify-center
            gap-2
            rounded-lg
            bg-zinc-900
            text-sm
            font-semibold
            text-white
            transition-all
            hover:bg-zinc-800
            active:scale-[0.99]
            focus:outline-none
            focus:ring-2
            focus:ring-zinc-400
            focus:ring-offset-2
          "
        >
          <span>Get Started</span>

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

        {/* Footer */}
        <p className="mt-4 text-center text-[11px] text-zinc-400">
          Built for private, on-device AI
        </p>
      </div>
    </main>
  );
}

function Feature({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 text-[13px] font-medium text-zinc-700">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-zinc-800">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M5 12L10 17L19 7"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>

      <span>{title}</span>
    </div>
  );
}

ReactDOM.createRoot(
  document.getElementById("root")!,
).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);