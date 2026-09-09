export type ToolName =
  | "click"
  | "type"
  | "scroll"
  | "wait";

export interface ToolCall {
  name: ToolName;

  arguments: {
    x?: number;
    y?: number;
    value?: string;
    direction?: "up" | "down";
    amount?: number;
    milliseconds?: number;
  };
}

export interface AgentDecision {
  tools: ToolCall[];

  done: boolean;

  message?: string;
}

export interface AgentContext {
  userTask: string;
  screenshot: string;
}