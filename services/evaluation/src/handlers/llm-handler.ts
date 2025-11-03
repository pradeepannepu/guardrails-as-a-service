import type { Policy } from "../evaluation-plane"; // adjust import if interface exported
export const llmHandler = {
  supports: (t: string) => t === "semantic",
  evaluate: async (_ctx: any, _p: Policy) => {
    // Placeholder for embedding similarity check
    return true;
  },
};
