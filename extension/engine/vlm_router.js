/**
 * Dual VLM Router with Instant Cascading Failover
 * Supports OpenAI (gpt-4o, gpt-4o-mini) and Google Gemini (gemini-2.0-flash, gemini-1.5-flash)
 * for autonomous vision-based browser automation.
 */

class VLMRouter {
  constructor(config = {}) {
    this.openaiKey = config.openaiKey || '';
    this.geminiKey = config.geminiKey || '';
    this.preferredProvider = config.preferredProvider || 'auto'; // 'auto' | 'openai' | 'gemini'
    this.openaiModel = config.openaiModel || 'gpt-4o';
    this.geminiModel = config.geminiModel || 'gemini-2.0-flash';
  }

  setKeys(openaiKey, geminiKey) {
    if (openaiKey !== undefined) this.openaiKey = openaiKey;
    if (geminiKey !== undefined) this.geminiKey = geminiKey;
  }

  /**
   * Generates formatted grounding prompt with visible interactive anchors.
   */
  buildPrompt(goal, anchors = [], stepIndex = 1, history = []) {
    let anchorListStr = '';
    if (anchors.length > 0) {
      anchorListStr = anchors.map(a =>
        `- [Index ${a.index}] "${a.label}" (${a.tag}) at [${a.normX.toFixed(2)}, ${a.normY.toFixed(2)}]`
      ).join('\n');
    } else {
      anchorListStr = 'No distinct interactive anchors detected in viewport.';
    }

    const historyStr = history.length > 0
      ? history.map((h, i) => `Step ${i + 1}: ${h.action} (${h.thought})`).join('\n')
      : 'None (initial step)';

    return `You are an autonomous zero-egress browser automation agent executing on a live web page.
GOAL: "${goal}"

CURRENT STEP: #${stepIndex}
PREVIOUS ACTIONS:
${historyStr}

VISIBLE INTERACTIVE ANCHORS DETECTED ON THIS SCREEN:
${anchorListStr}

NOTE ON SENSITIVE DATA:
All faces and sensitive PII (credit cards, passwords, CVV, identity tokens) have been blurred on-device with [REDACTED_*] placeholder badges. Do not guess redacted values.

TASK:
- If the user is asking a question (e.g. "what is the price of...", "what are the reviews", "what is on this page") and the answer is visible on this page:
  Set "action": "finish" and provide the direct, concise answer in "answer" (e.g. "The price of the Apple MacBook Pro 16 is ₹1,89,900.00").
- If you need to navigate, click, or scroll to find the requested product or answer:
  Set "action": "click" | "type" | "scroll" and target the relevant element.
- If the user gave an action goal (e.g. "buy this product", "add to cart", "checkout"):
  Execute the required clicks and typing, and when the goal is achieved, set "action": "finish" with the summary in "answer".

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
   * Parses raw VLM response with strict JSON hygiene.
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
    }

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
  }

  /**
   * Queries OpenAI Chat Completions API with vision payload.
   */
  async queryOpenAI(prompt, base64DataUrl) {
    if (!this.openaiKey) {
      throw new Error('OpenAI API Key is missing. Please enter it in the side panel.');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.openaiKey}`
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
                  detail: 'low'
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
      throw new Error(`OpenAI API Error (${response.status}): ${errBody}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';
    return this.parseDecision(content);
  }

  /**
   * Queries Google Gemini API with vision payload.
   */
  async queryGemini(prompt, base64DataUrl) {
    if (!this.geminiKey) {
      throw new Error('Gemini API Key is missing. Please enter it in the side panel.');
    }

    const rawBase64 = base64DataUrl.replace(/^data:image\/\w+;base64,/, '');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${this.geminiKey}`;

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
   * Dispatches vision request using preferred provider with automatic failover.
   */
  async decide(goal, base64DataUrl, anchors = [], stepIndex = 1, history = []) {
    const prompt = this.buildPrompt(goal, anchors, stepIndex, history);
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

    // Auto Failover Execution: Try OpenAI first, cascade to Gemini
    if (this.openaiKey) {
      try {
        const decision = await this.queryOpenAI(prompt, base64DataUrl);
        return { decision, providerUsed: 'OpenAI (' + this.openaiModel + ')' };
      } catch (openAiErr) {
        console.warn('[VLMRouter] OpenAI failed, cascading to Gemini:', openAiErr);
        if (this.geminiKey) {
          const decision = await this.queryGemini(prompt, base64DataUrl);
          return { decision, providerUsed: 'Gemini (' + this.geminiModel + ') [Failover]' };
        }
        throw openAiErr;
      }
    } else if (this.geminiKey) {
      const decision = await this.queryGemini(prompt, base64DataUrl);
      return { decision, providerUsed: 'Gemini (' + this.geminiModel + ')' };
    } else {
      throw new Error('No API Keys configured. Please provide an OpenAI or Gemini API key in the side panel.');
    }
  }
}

if (typeof exports !== 'undefined') {
  module.exports = { VLMRouter };
} else if (typeof globalThis !== 'undefined') {
  globalThis.VLMRouter = VLMRouter;
}
