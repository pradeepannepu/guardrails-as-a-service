#!/bin/bash

# Install dependencies if needed
pip install -r requirements.txt

# Set environment variables (optional)
export BASE_MODEL="${BASE_MODEL:-google/gemma-3-270m}"
export ADAPTER_PATH="${ADAPTER_PATH:-./guard_adapter-mini}"

# Run the server
python src/inference-server.py
