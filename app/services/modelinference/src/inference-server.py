from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
import torch
import os

import sys

sys.path.append("/Users/pannepu/github.com/pradeepannepu/guardrails-as-a-service/model")

from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel

app = FastAPI()


# Load model on startup
class GuardedModel:
    def __init__(self, base_model: str, adapter_path: Optional[str] = None):
        self.tokenizer = AutoTokenizer.from_pretrained(base_model)
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token

        base = AutoModelForCausalLM.from_pretrained(
            base_model,
            torch_dtype=torch.bfloat16 if torch.cuda.is_available() else torch.float32,
            device_map="auto",
        )

        if adapter_path and os.path.exists(adapter_path):
            self.model = PeftModel.from_pretrained(base, adapter_path)
        else:
            self.model = base

    def generate(
        self, prompt: str, max_new_tokens: int = 256, temperature: float = 0.2
    ) -> str:
        formatted = f"Instruction: {prompt}\nResponse:"
        inputs = self.tokenizer(formatted, return_tensors="pt")
        inputs = {k: v.to(self.model.device) for k, v in inputs.items()}

        with torch.no_grad():
            out = self.model.generate(
                **inputs,
                do_sample=temperature > 0,
                temperature=temperature,
                max_new_tokens=max_new_tokens,
                pad_token_id=self.tokenizer.eos_token_id,
            )

        text = self.tokenizer.decode(out[0], skip_special_tokens=True)
        if "Response:" in text:
            text = text.split("Response:", 1)[1].strip()
        return text


# Global model instance
model = GuardedModel(
    base_model=os.getenv("BASE_MODEL", "google/gemma-3-270m"),
    adapter_path=os.getenv("ADAPTER_PATH", "./guard_adapter-mini"),
)


class InferenceRequest(BaseModel):
    prompt: str
    resource: Optional[Dict[str, Any]] = None
    max_new_tokens: int = 256
    temperature: float = 0.2


class InferenceResponse(BaseModel):
    result: str
    in_scope: bool


REFUSAL_KEYWORDS = ["restricted", "out of scope", "appears out of scope"]


@app.post("/inference", response_model=InferenceResponse)
async def inference(request: InferenceRequest):
    try:
        # Combine prompt with resource context if provided
        full_prompt = request.prompt
        if request.resource:
            full_prompt = f"{request.prompt}\nResource: {request.resource}"

        result = model.generate(
            full_prompt,
            max_new_tokens=request.max_new_tokens,
            temperature=request.temperature,
        )

        # Check if response indicates out of scope
        in_scope = not any(kw in result.lower() for kw in REFUSAL_KEYWORDS)

        return InferenceResponse(result=result, in_scope=in_scope)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
