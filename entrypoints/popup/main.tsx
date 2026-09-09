import React, { useState } from "react";
import ReactDOM from "react-dom/client";

import "./style.css";

import AIConfiguration from "./components/AIconfiguration";
import Agent from "./components/Agent";

import { runAgent } from "../../agent/agent";
import { executeTool } from "../../executor/executor";

import type { LLMConfig } from "../../agent/llm";

function App() {
  /* ---------------------------------- */
  /* SCREEN STATE                       */
  /* ---------------------------------- */

  const [showAIConfiguration, setShowAIConfiguration] =
    useState(false);

  const [showAgent, setShowAgent] =
    useState(false);

  /* ---------------------------------- */
  /* PERCEPTION STATE                   */
  /* ---------------------------------- */

  const [detectedCount, setDetectedCount] =
    useState(0);

  const [safeScreenshot, setSafeScreenshot] =
    useState<string | null>(null);

  /* ---------------------------------- */
  /* AGENT STATE                        */
  /* ---------------------------------- */

  const [agentRunning, setAgentRunning] =
    useState(false);
const [agentMessage, setAgentMessage] = useState<string | null>(null);
  /* ---------------------------------- */
  /* AI CONFIGURATION                   */
  /* ---------------------------------- */

  const [aiConfig, setAIConfig] =
    useState<LLMConfig | null>(null);

  /* ---------------------------------- */
  /* START AGENT                        */
  /* ---------------------------------- */

  const handleStartAgent = async (
    userTask: string,
  ) => {
    try {
      setAgentRunning(true);

      console.log(
        "[APP] Starting agent:",
        userTask,
      );

      /* ------------------------------ */
      /* CHECK AI CONFIGURATION         */
      /* ------------------------------ */

      if (!aiConfig) {
        throw new Error(
          "AI configuration is missing. Please configure the AI provider first.",
        );
      }

      console.log(
        "[APP] AI Provider:",
        aiConfig.provider,
      );

      console.log(
        "[APP] AI Model:",
        aiConfig.model,
      );

      /* ------------------------------ */
      /* RUN AGENT                     */
      /* ------------------------------ */

     await runAgent(aiConfig, userTask, {
  onPerception: ({ protectedCount, safeScreenshot }) => {
    setDetectedCount(protectedCount);
    setSafeScreenshot(safeScreenshot);
  },

  onMessage: (message) => {
    setAgentMessage(message);
  },

  executeTool: async (tool, screenshot) => {
    await executeTool(tool, screenshot);
  },
});

      console.log(
        "[APP] Agent completed",
      );
    } catch (error) {
      console.error(
        "[APP] Agent failed:",
        error,
      );
    } finally {
      setAgentRunning(false);
    }
  };

  /* ---------------------------------- */
  /* AI CONFIGURATION SCREEN            */
  /* ---------------------------------- */

  if (showAIConfiguration) {
    return (
      <AIConfiguration
        onBack={() => {
          console.log(
            "[APP] Back from AI configuration",
          );

          setShowAIConfiguration(false);
        }}
        onContinue={(
          provider,
          model,
          apiKey,
        ) => {
          console.log(
            "[APP] AI configuration completed",
          );

          console.log(
            "[APP] Provider:",
            provider,
          );

          console.log(
            "[APP] Model:",
            model,
          );

          /*
           * Save the configuration.
           *
           * This configuration will later be
           * used when the user starts a task.
           */

          setAIConfig({
            provider,
            model,
            apiKey,
          });

          /*
           * Move from AI Configuration
           * to Agent screen.
           */

          setShowAIConfiguration(false);
          setShowAgent(true);
        }}
      />
    );
  }

  /* ---------------------------------- */
  /* AGENT SCREEN                       */
  /* ---------------------------------- */

  if (showAgent) {
    return (
      <Agent
  detectedCount={detectedCount}
  onStartAgent={handleStartAgent}
  safeScreenshot={safeScreenshot}
  running={agentRunning}
  agentMessage={agentMessage}
/>
    );
  }

  /* ---------------------------------- */
  /* WELCOME SCREEN                     */
  /* ---------------------------------- */

  return (
    <main
      className="
        flex h-[560px] w-[420px]
        items-center justify-center
        overflow-hidden bg-zinc-50 p-5
      "
    >
      <div
        className="
          w-full rounded-2xl
          border border-zinc-200
          bg-white px-7 py-8
          shadow-sm
        "
      >
        {/* -------------------------------- */}
        {/* ICON                             */}
        {/* -------------------------------- */}

        <div
          className="
            mx-auto mb-6 flex h-14 w-14
            items-center justify-center
            rounded-2xl border
            border-zinc-200
            bg-zinc-100
            text-zinc-900
          "
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="
                M12 3L19 6V11
                C19 15.5 16.1 19.5 12 21
                C7.9 19.5 5 15.5 5 11V6L12 3Z
              "
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

        {/* -------------------------------- */}
        {/* TITLE                            */}
        {/* -------------------------------- */}

        <div className="text-center">
          <h1
            className="
              text-[25px] font-bold
              tracking-tight text-zinc-900
            "
          >
            Welcome to PS171
          </h1>

          <p
            className="
              mt-2 text-sm font-medium
              text-zinc-600
            "
          >
            Privacy-first browser agent
          </p>

          <p
            className="
              mx-auto mt-3 max-w-[300px]
              text-[13px] leading-5
              text-zinc-500
            "
          >
            Your sensitive information stays
            protected before AI sees it.
          </p>
        </div>

        {/* -------------------------------- */}
        {/* FEATURES                         */}
        {/* -------------------------------- */}

        <div
          className="
            mt-7 space-y-3
            rounded-xl border
            border-zinc-200
            bg-zinc-50 p-4
          "
        >
          <Feature
            title="Local privacy detection"
          />

          <Feature
            title="Sensitive data blurring"
          />

          <Feature
            title="AI browser automation"
          />
        </div>

        {/* -------------------------------- */}
        {/* GET STARTED                      */}
        {/* -------------------------------- */}

        <button
          type="button"
          onClick={() => {
            console.log(
              "[APP] Opening AI configuration",
            );

            setShowAIConfiguration(true);
          }}
          className="
            mt-5 flex h-11 w-full
            items-center justify-center
            gap-2 rounded-lg
            bg-zinc-900
            text-sm font-semibold
            text-white
            transition-all
            hover:bg-zinc-800
          "
        >
          <span>
            Get Started
          </span>

          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
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

        {/* -------------------------------- */}
        {/* FOOTER                           */}
        {/* -------------------------------- */}

        <p
          className="
            mt-4 text-center
            text-[11px] text-zinc-400
          "
        >
          Built for private, on-device AI
        </p>
      </div>
    </main>
  );
}

/* ---------------------------------- */
/* FEATURE COMPONENT                  */
/* ---------------------------------- */

function Feature({
  title,
}: {
  title: string;
}) {
  return (
    <div
      className="
        flex items-center gap-3
        text-[13px] font-medium
        text-zinc-700
      "
    >
      <span
        className="
          flex h-5 w-5 shrink-0
          items-center justify-center
          rounded-full
          bg-zinc-200
          text-zinc-800
        "
      >
        ✓
      </span>

      <span>
        {title}
      </span>
    </div>
  );
}

/* ---------------------------------- */
/* REACT ROOT                         */
/* ---------------------------------- */

ReactDOM.createRoot(
  document.getElementById("root")!,
).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);