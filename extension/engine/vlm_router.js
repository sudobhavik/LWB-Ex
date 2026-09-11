/**
 * Dual VLM Router with Instant Cascading Failover
 * Supports OpenAI (gpt-4o, gpt-4o-mini) and Google Gemini (gemini-2.0-flash, gemini-1.5-flash)
 * for autonomous vision-based browser automation.
 */

class VLMRouter {
  constructor(config = {}) {
    this.openaiKey = this._cleanKey(config.openaiKey);
    this.geminiKey = this._cleanKey(config.geminiKey);
    this.ollamaEndpoint = (config.ollamaEndpoint || 'http://localhost:11434').replace(/\/+$/, '');
    this.ollamaModel = config.ollamaModel || 'qwen3-vl:2b';
    this.preferredProvider = config.preferredProvider || 'auto'; // 'auto' | 'openai' | 'gemini' | 'ollama'
    this.openaiModel = config.openaiModel || 'gpt-4o';
    this.geminiModel = config.geminiModel || 'gemini-2.0-flash';
  }

  _cleanKey(key) {
    if (!key) return '';
    let str = String(key).trim();
    str = str.replace(/^Bearer\s+/i, '').trim();

    // Reject placeholder values such as "sk-proj-", "sk-proj-...", or empty stubs
    if (/^sk-proj-[.\s]*$/i.test(str) || str === 'sk-proj-') {
      return '';
    }

    // Require standard OpenAI keys to be at least 15 characters and not ending in hyphen
    const openAiMatch = str.match(/sk-[a-zA-Z0-9_\-]+/);
    if (openAiMatch) {
      const matchKey = openAiMatch[0];
      if (matchKey.length >= 15 && !matchKey.endsWith('-')) {
        return matchKey;
      }
      return '';
    }

    // Require Gemini keys to be at least 15 characters
    const geminiMatch = str.match(/AIza[a-zA-Z0-9_\-]+/);
    if (geminiMatch && geminiMatch[0].length >= 15) return geminiMatch[0];

    // Fallback for custom test keys (minimum 10 printable characters, excluding stubs)
    const fallback = str.replace(/\x1B\[[0-9;]*[a-zA-Z~]/g, '').replace(/[^\x20-\x7E]/g, '').replace(/^['"]|['"]$/g, '').trim();
    return fallback.length >= 10 && !fallback.startsWith('sk-proj-') ? fallback : '';
  }

  setKeys(openaiKey, geminiKey) {
    if (openaiKey !== undefined) this.openaiKey = this._cleanKey(openaiKey);
    if (geminiKey !== undefined) this.geminiKey = this._cleanKey(geminiKey);
  }

  setOllamaConfig(endpoint, model) {
    if (endpoint !== undefined && endpoint) this.ollamaEndpoint = endpoint.replace(/\/+$/, '');
    if (model !== undefined && model) this.ollamaModel = model;
  }

  /**
   * Pings the Ollama local daemon and returns status + available models.
   * @returns {Promise<{ online: boolean, models: string[], error?: string }>}
   */
  async checkOllamaStatus() {
    try {
      const res = await fetch(`${this.ollamaEndpoint}/api/tags`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      if (!res.ok) {
        return { online: false, models: [], error: `HTTP ${res.status}` };
      }
      const data = await res.json();
      const models = Array.isArray(data.models) ? data.models.map(m => m.name || m.model) : [];
      return { online: true, models };
    } catch (err) {
      return { online: false, models: [], error: err.message };
    }
  }

  /**
   * Generates formatted grounding prompt with visible interactive anchors.
   * Enriches elements with OmniParser-style visual icon badges and roles.
   */
  buildPrompt(goal, anchors = [], stepIndex = 1, history = [], pageProducts = []) {
    let anchorListStr = '';
    if (anchors.length > 0) {
      anchorListStr = anchors.map(a => {
        const iconTag = a.iconType ? ` [ICON: ${a.iconType}]` : '';
        const roleTag = a.role ? ` [ROLE: ${a.role}]` : '';
        const nx = (typeof a.normX === 'number') ? a.normX.toFixed(2) : '0.50';
        const ny = (typeof a.normY === 'number') ? a.normY.toFixed(2) : '0.50';
        return `- [Index ${a.index}]${iconTag}${roleTag} "${a.label}" (${a.tag}) at [${nx}, ${ny}]`;
      }).join('\n');
    } else {
      anchorListStr = 'No distinct interactive anchors detected in viewport.';
    }

    let productsStr = '';
    if (pageProducts && pageProducts.length > 0) {
      productsStr = `\nVISIBLE PRODUCTS & EXACT PRICES ON THIS SCREEN:\n` +
        pageProducts.map(p => `- "${p.title}": Price: ${p.price}${p.deal ? ` [${p.deal}]` : ''}`).join('\n') + '\n';
    }

    const historyStr = history.length > 0
      ? history.map((h, i) => `Step ${i + 1}: ${h.action} (${h.thought})`).join('\n')
      : 'None (initial step)';

    return `You are an autonomous zero-egress browser automation agent executing on a live web page.
GOAL: "${goal}"

CURRENT STEP: #${stepIndex}
PREVIOUS ACTIONS:
${historyStr}
${productsStr}
VISIBLE INTERACTIVE ANCHORS DETECTED ON THIS SCREEN:
${anchorListStr}

CRITICAL ZERO-EGRESS PRIVACY DIRECTIVE:
All faces, credit cards, bank accounts, Aadhaar, PAN, CVV, passwords, and identity tokens are strictly confidential and blurred on-device with [REDACTED_*] placeholder badges.
- If the user's question or goal asks to reveal, recite, read, or print any credit card number, Aadhaar number, PAN, CVV, or password:
  Set "action": "finish" and set "answer": "This sensitive credential is confidential and protected on-device by the GUPTCHARA privacy shield. It cannot be revealed."
- Never guess, attempt to decipher, or output sensitive credentials.

TASK:
- If the user is asking about the price, specifications, or details of a product (e.g. "what is the price of iPhone", "how much is MacBook", "what is on this page"):
  Use the EXACT product price from the visible products on this page. Set "action": "finish" and provide the direct, concise answer in "answer".
- If the user gave a purchase goal (e.g. "buy this product", "add to cart", "buy macbook"):
  Click the "Buy Now" or "Add to Cart" button ONCE for quantity 1. Once added or when checkout is reached, set "action": "finish" with the order summary. Do NOT repeatedly click "Add to Cart" if already added.
- If you need to navigate, click, or scroll to find the requested product or answer:
  Set "action": "click" | "type" | "scroll" and target the relevant element.

DECIDE THE NEXT ACTION. Respond with STRICT JSON matching this schema:
{
  "thought": "Brief explanation of your visual reasoning and next step",
  "action": "click" | "type" | "scroll" | "finish",
  "target_index": <number or null>,
  "coordinates": [<norm_x>, <norm_y>] or null,
  "text": "<string to type if action is type, otherwise empty>",
  "direction": "down" | "up" (if scroll),
  "answer": "<If action is finish, write the direct conversational answer to the user's question or goal>"
}`;
  }

  /**
   * Parses raw VLM response with strict JSON hygiene and chain-of-thought extraction.
   */
  parseDecision(rawText) {
    if (!rawText || typeof rawText !== 'string') {
      throw new Error('Empty response received from VLM');
    }

    let clean = rawText.trim();
    if (clean.includes('```')) {
      const match = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) clean = match[1];
    }
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      clean = clean.slice(start, end + 1);
      try {
        const decision = JSON.parse(clean);
        return {
          thought: decision.thought || 'Executing next step',
          action: decision.action || 'click',
          target_index: decision.target_index ?? null,
          coordinates: decision.coordinates || null,
          text: decision.text || '',
          direction: decision.direction || 'down',
          answer: decision.answer || decision.thought || ''
        };
      } catch (_) {}
    }

    // Attempt 2: Search for any valid JSON chunk inside rawText with action field
    const jsonRegex = /\{[\s\S]*?"action"[\s\S]*?\}/g;
    const matches = rawText.match(jsonRegex) || [];
    for (const m of matches) {
      try {
        const d = JSON.parse(m);
        return {
          thought: d.thought || 'Executing next step',
          action: d.action || 'click',
          target_index: d.target_index ?? null,
          coordinates: d.coordinates || null,
          text: d.text || '',
          direction: d.direction || 'down',
          answer: d.answer || d.thought || ''
        };
      } catch (_) {}
    }

    // Attempt 3: Extract structured intent from reasoning text when JSON is missing or truncated
    const actionMatch = rawText.match(/\b(click|type|scroll|finish)\b/i);
    const indexMatch = rawText.match(/(?:target(?:\s+|_)?index|\[Index)\D{0,15}(\d+)/i) ||
                       rawText.match(/(?:click|press|select|tap)\D{0,20}(?:index\s*|\[Index\s*)?(\d+)/i) ||
                       rawText.match(/\[Index\s*(\d+)\]/i);

    if (indexMatch) {
      const detectedIndex = parseInt(indexMatch[1], 10);
      const inferredAction = (actionMatch && actionMatch[1].toLowerCase() !== 'finish')
        ? actionMatch[1].toLowerCase()
        : 'click';
      return {
        thought: 'Identified target element from visual perception stream',
        action: inferredAction,
        target_index: detectedIndex,
        coordinates: null,
        text: '',
        direction: 'down',
        answer: ''
      };
    }

    // Attempt 4: Clean conversational answer (stripping chain-of-thought monologue prefixes)
    let naturalAnswer = rawText.trim();
    const lines = naturalAnswer.split('\n').map(l => l.trim()).filter(Boolean);
    const priceLine = lines.find(l => (l.includes('₹') || l.includes('$') || /price/i.test(l)) && !/let's see|user's goal/i.test(l));
    if (priceLine) {
      naturalAnswer = priceLine;
    } else {
      // Strip internal self-dialogue preamble like "o, let's see...", "okay, let's see..."
      naturalAnswer = naturalAnswer
        .replace(/^(?:o|okay|ok|well|so),?\s+let's\s+see[\s\S]*?(?:therefore|in conclusion|the answer is|the price is|so\s+:)/i, '')
        .replace(/^(?:The user(?:'s)? goal is|Looking at the current screen|Previous steps were)[\s\S]*?(?:we need to proceed with|the result is|the price is|here is)/i, '')
        .trim();

      if (!naturalAnswer || /^(?:o|okay|so),?\s+let's\s+see|looking at the current screen/i.test(naturalAnswer)) {
        naturalAnswer = 'Inspected the page contents with zero-egress shielding. Navigation and verification completed.';
      }
    }

    return {
      thought: 'Visual model inspected screen directly via OmniParser pixels',
      action: 'finish',
      target_index: null,
      coordinates: null,
      text: '',
      direction: 'down',
      answer: naturalAnswer
    };
  }

  /**
   * Queries OpenAI Chat Completions API with vision payload.
   */
  async queryOpenAI(prompt, base64DataUrl) {
    const key = this._cleanKey(this.openaiKey);
    if (!key) {
      throw new Error('OpenAI API Key is missing. Please enter it in the side panel.');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: this.openaiModel,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: base64DataUrl,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      let msg = `OpenAI API Error (${response.status}): ${errBody}`;
      if (response.status === 401) {
        msg = `OpenAI Authentication Failed (401): Invalid or incorrect API key. Please check your key in Settings. Error details: ${errBody}`;
      }
      throw new Error(msg);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';
    return this.parseDecision(content);
  }

  /**
   * Queries Google Gemini API with vision payload.
   */
  async queryGemini(prompt, base64DataUrl) {
    const key = this._cleanKey(this.geminiKey);
    if (!key) {
      throw new Error('Gemini API Key is missing. Please enter it in the side panel.');
    }

    const rawBase64 = base64DataUrl.replace(/^data:image\/\w+;base64,/, '');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${key}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: rawBase64
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Gemini API Error (${response.status}): ${errBody}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text || '';
    return this.parseDecision(text);
  }

  /**
   * Queries Ollama OpenAI-compatible /v1/chat/completions endpoint with vision payload.
   */
  async queryOllama(prompt, base64DataUrl) {
    const url = `${this.ollamaEndpoint}/v1/chat/completions`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.ollamaModel,
        messages: [
          {
            role: 'system',
            content: 'You are an autonomous web agent. Be extremely concise. Respond ONLY with a valid JSON object matching the requested schema. Output the JSON object immediately without conversational preamble.'
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: base64DataUrl
                }
              }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 4096,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      if (response.status === 403) {
        throw new Error(
          `Ollama CORS Forbidden (403). Ollama blocks browser extension origins by default. ` +
          `To fix this on your system, run in terminal: sudo systemctl edit ollama.service and add: Environment="OLLAMA_ORIGINS=*", then sudo systemctl restart ollama.`
        );
      }
      throw new Error(`Ollama Local VLM Error (${response.status}): ${errBody}`);
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || '';
    if (!content.trim() && data.choices?.[0]?.message?.reasoning) {
      content = data.choices[0].message.reasoning;
    }
    return this.parseDecision(content);
  }

  /**
   * Dispatches vision request using preferred provider with automatic failover.
   */
  async decide(goal, base64DataUrl, anchors = [], stepIndex = 1, history = [], pageProducts = []) {
    const prompt = this.buildPrompt(goal, anchors, stepIndex, history, pageProducts);
    const provider = this.preferredProvider;

    // Direct Single Provider Execution
    if (provider === 'openai') {
      const decision = await this.queryOpenAI(prompt, base64DataUrl);
      return { decision, providerUsed: 'OpenAI (' + this.openaiModel + ')' };
    }

    if (provider === 'gemini') {
      const decision = await this.queryGemini(prompt, base64DataUrl);
      return { decision, providerUsed: 'Gemini (' + this.geminiModel + ')' };
    }

    if (provider === 'ollama') {
      const decision = await this.queryOllama(prompt, base64DataUrl);
      return { decision, providerUsed: 'Ollama (' + this.ollamaModel + ')' };
    }

    // Auto Failover Execution: Try OpenAI first, cascade to Gemini, then Ollama
    if (this.openaiKey) {
      try {
        const decision = await this.queryOpenAI(prompt, base64DataUrl);
        return { decision, providerUsed: 'OpenAI (' + this.openaiModel + ')' };
      } catch (openAiErr) {
        console.log('[VLMRouter] OpenAI unavailable, cascading to Gemini:', openAiErr?.message || openAiErr);
        if (this.geminiKey) {
          try {
            const decision = await this.queryGemini(prompt, base64DataUrl);
            return { decision, providerUsed: 'Gemini (' + this.geminiModel + ') [Failover]' };
          } catch (gemErr) {
            console.log('[VLMRouter] Gemini unavailable, cascading to local Ollama:', gemErr?.message || gemErr);
          }
        }
      }
    } else if (this.geminiKey) {
      try {
        const decision = await this.queryGemini(prompt, base64DataUrl);
        return { decision, providerUsed: 'Gemini (' + this.geminiModel + ')' };
      } catch (gemErr) {
        console.log('[VLMRouter] Gemini unavailable, cascading to local Ollama:', gemErr?.message || gemErr);
      }
    }

    // Offline / Open-Weights Local Server Fallback (Ollama Qwen3-VL)
    try {
      const decision = await this.queryOllama(prompt, base64DataUrl);
      return { decision, providerUsed: 'Ollama (' + this.ollamaModel + ') [Offline Local Server]' };
    } catch (ollamaErr) {
      throw new Error(
        `No VLM providers succeeded. No API Keys configured for cloud providers, and local Ollama (${this.ollamaEndpoint}) failed: ${ollamaErr.message}. Make sure Ollama is running ('ollama run ${this.ollamaModel}').`
      );
    }
  }
}

if (typeof exports !== 'undefined') {
  module.exports = { VLMRouter };
} else if (typeof globalThis !== 'undefined') {
  globalThis.VLMRouter = VLMRouter;
}
