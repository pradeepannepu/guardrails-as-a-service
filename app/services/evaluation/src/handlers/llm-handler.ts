import axios from "axios";
import type { Policy } from "../evaluation-plane";

interface OpenAIEmbeddingResponse {
  data: Array<{ embedding: number[] }>;
}

const embeddingCache = new Map<string, number[]>();

async function getEmbedding(text: string): Promise<number[]> {
  if (embeddingCache.has(text)) {
    return embeddingCache.get(text)!;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is required for semantic evaluation");
  }

  const { data } = await axios.post<OpenAIEmbeddingResponse>(
    "https://api.openai.com/v1/embeddings",
    {
      input: text,
      model: process.env.EMBEDDING_MODEL || "text-embedding-3-small",
    },
    {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    }
  );

  const embedding = data.data[0].embedding;
  
  // Cache the embedding (with size limit)
  if (embeddingCache.size < 1000) {
    embeddingCache.set(text, embedding);
  }
  
  return embedding;
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magA * magB);
}

export const llmHandler = {
  supports: (t: string) => t === "semantic",
  evaluate: async (ctx: any, p: Policy) => {
    const threshold = parseFloat(process.env.SEMANTIC_THRESHOLD || "0.8");
    
    // Get embeddings for both the resource context and policy expression
    const contextText = JSON.stringify(ctx.resource);
    const [contextEmb, policyEmb] = await Promise.all([
      getEmbedding(contextText),
      getEmbedding(p.expression),
    ]);
    
    const similarity = cosineSimilarity(contextEmb, policyEmb);
    
    // Policy passes if similarity meets threshold
    return similarity >= threshold;
  },
};
