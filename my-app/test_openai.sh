#!/bin/bash
source .env
echo "Testing OpenAI API Key..."
echo "Key starts with: ${OPENAI_API_KEY:0:20}..."
echo "Base URL: $OPENAI_BASE_URL"
echo "Model: $OPENAI_MODEL"
echo ""
echo "Testing API connection..."
curl -s https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  | head -20
