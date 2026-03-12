/**
 * vllmClient.js
 *
 * Client for an on-premise vllm server exposing an OpenAI-compatible
 * `/v1/chat/completions` endpoint with vision support.
 *
 * vllm documentation: https://docs.vllm.ai/en/latest/serving/openai_compatible_server.html
 *
 * Recommended vision models for engineering drawing analysis:
 *   - llava-hf/llava-v1.6-mistral-7b-hf
 *   - Qwen/Qwen2-VL-7B-Instruct
 *   - InternVL2-8B
 *   - microsoft/Phi-3.5-vision-instruct
 *
 * Environment variables (set in server/.env):
 *   VLLM_BASE_URL    Base URL of the vllm server  (default: http://localhost:8000/v1)
 *   VLLM_MODEL       Model name as loaded by vllm  (default: llava-hf/llava-v1.6-mistral-7b-hf)
 *   VLLM_API_KEY     API key (optional; vllm can run without auth)
 *   VLLM_TIMEOUT_MS  Request timeout in milliseconds (default: 120000)
 *   VLLM_MAX_TOKENS  Maximum tokens to generate    (default: 4096)
 */

'use strict';

const https = require('https');
const http  = require('http');
const { URL } = require('url');

/**
 * The engineering-drawing analysis prompt.
 * Instructs the VLM to return a JSON object that dxfWriter.generateDXF() can consume.
 *
 * Prompt design is informed by:
 *  - Liu et al. (2023) "LLaVA: Large Language and Vision Assistant"
 *    https://arxiv.org/abs/2304.08485
 *  - Bai et al. (2023) "Qwen-VL: A Versatile Vision-Language Model"
 *    https://arxiv.org/abs/2308.12966
 *  - Wei et al. (2022) "Chain-of-Thought Prompting Elicits Reasoning in Large Language Models"
 *    https://arxiv.org/abs/2201.11903  (used to structure step-by-step entity extraction)
 *  - The SketchCAD / OpenCAD benchmark literature for structured CAD output schemas.
 */
const EXTRACTION_PROMPT = `You are an expert CAD engineer. Carefully analyse this engineering drawing image and extract all geometric and textual elements so they can be reproduced in AutoCAD.

Think step-by-step:
1. Identify the drawing type and overall canvas size.
2. Locate the title block and extract metadata.
3. Systematically scan the drawing from top-left to bottom-right, cataloguing every visible entity.

Respond with ONLY a valid JSON object — no markdown fences, no explanations — with this EXACT structure:

{
  "drawing_type": "<mechanical|electrical|civil|P&ID|instrumentation|architectural|structural>",
  "title_block": {
    "title": "<drawing title or empty string>",
    "drawing_number": "<e.g. DWG-001 or empty string>",
    "scale": "<e.g. 1:100 or empty string>",
    "revision": "<revision letter or empty string>"
  },
  "canvas": {
    "width":  <number: estimated width in mm, e.g. 420 for A3>,
    "height": <number: estimated height in mm, e.g. 297 for A3>
  },
  "entities": [
    { "type": "LINE",      "x1": 0.0, "y1": 0.0, "x2": 100.0, "y2": 0.0,    "layer": "0" },
    { "type": "CIRCLE",    "cx": 50.0, "cy": 50.0, "radius": 25.0,            "layer": "EQUIPMENT" },
    { "type": "ARC",       "cx": 0.0,  "cy": 0.0,  "radius": 50.0, "start_angle": 0.0, "end_angle": 90.0, "layer": "0" },
    { "type": "POLYLINE",  "points": [[0,0],[100,0],[100,100]], "closed": false, "layer": "0" },
    { "type": "RECTANGLE", "x": 0.0, "y": 0.0, "width": 420.0, "height": 297.0, "layer": "BORDER" },
    { "type": "TEXT",      "x": 10.0, "y": 10.0, "text": "Label", "height": 5.0, "layer": "TEXT" }
  ]
}

Coordinate rules:
- Origin (0,0) at bottom-left; Y-axis points upward.
- Scale all coordinates to approximate real-world millimetres.
- Assign entities to appropriate layers: BORDER, WALLS, STRUCTURAL, EQUIPMENT, PIPING, ELECTRICAL, INSTRUMENTATION, ANNOTATIONS, DIMENSIONS, TEXT, HIDDEN, CENTERLINE.
- Aim to extract at least 30 entities for a typical A3 drawing; include ALL visible lines, symbols, and text labels.`;

/**
 * Make a raw HTTPS/HTTP POST request (avoids adding an npm dependency for the
 * server side, which currently has no HTTP client library).
 *
 * @param {string} urlStr   Full URL.
 * @param {object} body     JSON-serialisable request body.
 * @param {object} headers  Extra request headers.
 * @param {number} timeoutMs  Socket timeout in milliseconds.
 * @returns {Promise<object>} Parsed JSON response body.
 */
function httpPost(urlStr, body, headers, timeoutMs) {
  return new Promise((resolve, reject) => {
    const parsed  = new URL(urlStr);
    const payload = JSON.stringify(body);
    const options = {
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + (parsed.search || ''),
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...headers,
      },
      timeout: timeoutMs,
    };

    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        try {
          const json = JSON.parse(text);
          if (res.statusCode >= 400) {
            reject(new Error(`vllm returned HTTP ${res.statusCode}: ${json.error?.message || text}`));
          } else {
            resolve(json);
          }
        } catch {
          reject(new Error(`vllm response is not valid JSON: ${text.slice(0, 200)}`));
        }
      });
    });

    req.on('error',   reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`vllm request timed out after ${timeoutMs} ms`));
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Parse the raw text content returned by the VLM.
 *
 * The model may wrap the JSON in markdown code fences (```json ... ```);
 * this function strips them and returns a parsed object.
 *
 * @param {string} text  Raw VLM response text.
 * @returns {object} Parsed entity data.
 */
function parseVlmResponse(text) {
  // Strip optional markdown code fences
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  cleaned = cleaned.trim();

  // Find the outermost JSON object
  const start = cleaned.indexOf('{');
  const end   = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('VLM response does not contain a JSON object');
  }
  cleaned = cleaned.slice(start, end + 1);

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Failed to parse VLM JSON response: ${err.message}`);
  }
}

/**
 * Send a PDF-page image to the vllm vision model and retrieve structured
 * drawing entity data.
 *
 * @param {string} base64Png  Base64-encoded PNG of the drawing page.
 * @returns {Promise<object>} Parsed entity data (see EXTRACTION_PROMPT schema).
 */
async function extractDrawingEntities(base64Png) {
  const baseUrl = (process.env.VLLM_BASE_URL || 'http://localhost:8000/v1').replace(/\/$/, '');
  const model = process.env.VLLM_MODEL || 'llava-hf/llava-v1.6-mistral-7b-hf';
  const apiKey = process.env.VLLM_API_KEY || '';
  const timeoutMs = parseInt(process.env.VLLM_TIMEOUT_MS || '120000', 10);
  const maxTokens = parseInt(process.env.VLLM_MAX_TOKENS || '4096', 10);

  const endpoint = `${baseUrl}/chat/completions`;
  const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};

  const requestBody = {
    model,
    max_tokens: maxTokens,
    temperature: 0,           // deterministic output for reliable JSON parsing
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:image/png;base64,${base64Png}` },
          },
          {
            type: 'text',
            text: EXTRACTION_PROMPT,
          },
        ],
      },
    ],
  };

  const response = await httpPost(endpoint, requestBody, headers, timeoutMs);

  const rawText = response?.choices?.[0]?.message?.content;
  if (!rawText) {
    throw new Error('VLM response contained no content');
  }

  return parseVlmResponse(rawText);
}

module.exports = { extractDrawingEntities };
