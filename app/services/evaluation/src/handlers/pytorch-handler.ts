import axios from "axios";

interface Policy {
  name: string;
  type: string;
  expression: string;
}

type Handler = {
  supports(type: string): boolean;
  evaluate(ctx: any, policy: Policy): Promise<boolean>;
};

export const pytorchHandler: Handler = {
  supports: (t) => t === "pytorch" || t === "ml",
  
  evaluate: async (ctx, policy) => {
    const modelSvcUrl =
      process.env.MODEL_SVC_URL || "http://localhost:8000/inference";
    
    try {
      const { data } = await axios.post(modelSvcUrl, {
        prompt: policy.expression,
        resource: ctx.resource,
        max_new_tokens: 256,
        temperature: 0.2,
      });
      
      // Expect response format: { result: string, in_scope: boolean }
      // Return true if model response is in scope and doesn't contain refusal
      if (data.in_scope === false || 
          data.result?.includes("restricted") || 
          data.result?.includes("out of scope")) {
        return false;
      }
      
      return true;
    } catch (error) {
      console.error("PyTorch model evaluation error:", error);
      // Fail closed - return false on error
      return false;
    }
  },
};
