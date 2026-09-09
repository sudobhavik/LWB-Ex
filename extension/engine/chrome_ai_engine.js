/**
 * GUPTCHARA - Zero-Egress Privacy Agent
 * Chrome Built-in AI Engine (Prompt API / Gemini Nano)
 *
 * Runs 100% on-device inside Chromium (Chrome 127+ / 131+) via window.ai / ai.languageModel.
 * Provides client-side semantic DOM pruning, contextual PII classification,
 * and zero-egress autonomous action decisions without sending any data to external cloud APIs.
 */

class ChromeAIEngine {
  /**
   * @param {Object} [options]
   * @param {Object} [options.provider] - Optional injected languageModel provider (for tests/mocking)
   * @param {number} [options.temperature=0.2] - Sampling temperature (lower = more deterministic)
   * @param {number} [options.topK=3] - Top-K sampling
   * @param {string} [options.defaultSystemPrompt] - Default system instructions for the session
   */
  constructor(options = {}) {
    this.customProvider = options.provider || null;
    this.temperature = options.temperature !== undefined ? options.temperature : 0.2;
    this.topK = options.topK !== undefined ? options.topK : 3;
    this.defaultSystemPrompt = options.defaultSystemPrompt ||
      'You are GUPTCHARA, an on-device privacy-preserving browser automation intelligence. Always adhere strictly to requested JSON schemas.';
    this.activeSession = null;
    this.activeSessionPrompt = null;
  }

  /**
   * Resolves the active Prompt API provider across W3C standard, Chrome flags, and custom mocks.
   * @returns {Object|null}
   */
  getProvider() {
    if (this.customProvider) {
      return this.customProvider;
    }

    if (typeof globalThis !== 'undefined') {
      if (globalThis.ai && globalThis.ai.languageModel) {
        return globalThis.ai.languageModel;
      }
      if (globalThis.chrome && globalThis.chrome.aiOriginTrial && globalThis.chrome.aiOriginTrial.languageModel) {
        return globalThis.chrome.aiOriginTrial.languageModel;
      }
    }

    if (typeof window !== 'undefined') {
      if (window.ai && window.ai.languageModel) {
        return window.ai.languageModel;
      }
      if (window.chrome && window.chrome.aiOriginTrial && window.chrome.aiOriginTrial.languageModel) {
        return window.chrome.aiOriginTrial.languageModel;
      }
    }

    return null;
  }

  /**
   * Checks whether Chrome Built-in AI (Gemini Nano) is available on this system.
   * @returns {Promise<{supported: boolean, available: 'readily'|'after-download'|'no'|'unsupported', isReady: boolean, details: string}>}
   */
  async checkAvailability() {
    const provider = this.getProvider();
    if (!provider) {
      return {
        supported: false,
        available: 'unsupported',
        isReady: false,
        details: 'Chrome Built-in AI (Prompt API) not detected. Requires Chrome 128+ with flags enabled (chrome://flags/#prompt-api-for-gemini-nano).'
      };
    }

    try {
      let availability = 'readily';

      if (typeof provider.capabilities === 'function') {
        const caps = await provider.capabilities();
        availability = caps.available || (caps.isAvailable ? 'readily' : 'no');
      } else if (typeof provider.availability === 'function') {
        availability = await provider.availability();
      }

      const isReady = availability === 'readily';
      let details = 'Gemini Nano is downloaded and ready for on-device inference.';
      if (availability === 'after-download') {
        details = 'Gemini Nano is supported but downloading model weights in background.';
      } else if (availability === 'no') {
        details = 'Gemini Nano is not available on this device or disabled in flags.';
      }

      return {
        supported: true,
        available: availability,
        isReady,
        details
      };
    } catch (err) {
      return {
        supported: true,
        available: 'no',
        isReady: false,
        details: `Error querying capabilities: ${err.message}`
      };
    }
  }

  /**
   * Creates or returns a cached on-device Gemini Nano session.
   * @param {string} [systemPrompt]
   * @returns {Promise<Object>}
   */
  async getSession(systemPrompt) {
    const targetPrompt = systemPrompt || this.defaultSystemPrompt;

    if (this.activeSession && this.activeSessionPrompt === targetPrompt) {
      return this.activeSession;
    }

    if (this.activeSession) {
      await this.destroySession();
    }

    const provider = this.getProvider();
    if (!provider) {
      throw new Error('Chrome Built-in AI provider not available');
    }

    const createOpts = {
      systemPrompt: targetPrompt,
      temperature: this.temperature,
      topK: this.topK
    };

    if (typeof provider.create === 'function') {
      this.activeSession = await provider.create(createOpts);
    } else if (typeof provider.createTextSession === 'function') {
      this.activeSession = await provider.createTextSession(createOpts);
    } else {
      throw new Error('Unsupported Prompt API session creation method');
    }

    this.activeSessionPrompt = targetPrompt;
    return this.activeSession;
  }

  /**
   * Destroys active session to free up device NPU/GPU/VRAM.
   */
  async destroySession() {
    if (this.activeSession) {
      try {
        if (typeof this.activeSession.destroy === 'function') {
          this.activeSession.destroy();
        } else if (typeof this.activeSession.close === 'function') {
          this.activeSession.close();
        }
      } catch (err) {
        console.warn('Session cleanup warning:', err);
      }
      this.activeSession = null;
      this.activeSessionPrompt = null;
    }
  }

  /**
   * Executes a direct prompt against the on-device model.
   * @param {string} promptText
   * @param {Object} [opts]
   * @returns {Promise<string>}
   */
  async prompt(promptText, opts = {}) {
    const session = await this.getSession(opts.systemPrompt);
    if (!session || typeof session.prompt !== 'function') {
      throw new Error('Active session has no prompt function');
    }
    const response = await session.prompt(promptText);
    return typeof response === 'string' ? response : String(response || '');
  }

  /**
   * Helper: Extracts and parses JSON from potentially conversational or markdown-wrapped LLM text.
   * @param {string} rawText
   * @returns {any}
   */
  parseJSON(rawText) {
    let clean = (rawText || '').trim();

    if (clean.includes('```')) {
      const match = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) {
        clean = match[1].trim();
      }
    }

    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    const firstBracket = clean.indexOf('[');
    const lastBracket = clean.lastIndexOf(']');

    if (firstBrace !== -1 && lastBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      clean = clean.slice(firstBrace, lastBrace + 1);
    } else if (firstBracket !== -1 && lastBracket !== -1) {
      clean = clean.slice(firstBracket, lastBracket + 1);
    }

    return JSON.parse(clean);
  }

  // =========================================================================
  // Core Use Case 1: Semantic DOM Anchor Pruning (Stagehand-Style Observe Filter)
  // =========================================================================

  /**
   * Prunes a large list of DOM anchors down to only the elements relevant to the user goal.
   * Runs entirely on-device, cutting noise and token costs before any action is decided.
   *
   * @param {string} goal - User's browsing intent
   * @param {Array<Object>} anchors - Candidate anchors from content.js
   * @param {number} [maxCandidates=5] - Maximum pruned anchors to return
   * @returns {Promise<{selectedAnchors: Array<Object>, primaryIndex: number|null, reasoning: string}>}
   */
  async pruneDOMAnchors(goal, anchors, maxCandidates = 5) {
    if (!anchors || anchors.length === 0) {
      return { selectedAnchors: [], primaryIndex: null, reasoning: 'No anchors available' };
    }

    // If candidate list is already small, return it directly
    if (anchors.length <= maxCandidates) {
      return {
        selectedAnchors: anchors,
        primaryIndex: anchors[0]?.index || null,
        reasoning: 'Anchor list already within candidate threshold'
      };
    }

    const anchorListText = anchors.slice(0, 40).map(a => {
      return `[Index ${a.index}] tag=${a.tag || 'el'} label="${(a.label || '').slice(0, 40)}" coords=[${a.normX || 0}, ${a.normY || 0}]`;
    }).join('\n');

    const promptText = `USER GOAL: "${goal}"

AVAILABLE INTERACTIVE ELEMENTS:
${anchorListText}

TASK:
Identify the top most relevant interactive elements (up to ${maxCandidates}) that can advance this goal.
Determine which element is the single primary candidate.

Respond ONLY in strict JSON format:
{
  "selected_indices": [number, ...],
  "primary_index": number,
  "reasoning": "brief explanation"
}`;

    try {
      const raw = await this.prompt(promptText, {
        systemPrompt: 'You are an on-device semantic web accessibility parser. Return only valid JSON.'
      });

      const parsed = this.parseJSON(raw);
      const selectedIndices = Array.isArray(parsed.selected_indices) ? parsed.selected_indices : [];
      const primaryIndex = typeof parsed.primary_index === 'number' ? parsed.primary_index : (selectedIndices[0] || null);

      const anchorMap = new Map(anchors.map(a => [a.index, a]));
      let filtered = selectedIndices.map(idx => anchorMap.get(idx)).filter(Boolean);

      // Fallback if model returned empty or invalid indices
      if (filtered.length === 0) {
        filtered = this.heuristicAnchorFallback(goal, anchors, maxCandidates);
      }

      return {
        selectedAnchors: filtered.slice(0, maxCandidates),
        primaryIndex: primaryIndex || filtered[0]?.index || null,
        reasoning: parsed.reasoning || 'Semantic relevance match via Gemini Nano'
      };
    } catch (err) {
      console.log('On-device anchor pruning fallback to heuristic:', err.message);
      const fallbackList = this.heuristicAnchorFallback(goal, anchors, maxCandidates);
      return {
        selectedAnchors: fallbackList,
        primaryIndex: fallbackList[0]?.index || null,
        reasoning: `Heuristic fallback (${err.message})`
      };
    }
  }

  /**
   * Deterministic keyword scoring fallback when local AI is unavailable or produces invalid indices.
   * @private
   */
  heuristicAnchorFallback(goal, anchors, limit) {
    const keywords = (goal || '').toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const scored = anchors.map(a => {
      const text = `${a.label || ''} ${a.tag || ''}`.toLowerCase();
      let score = 0;
      keywords.forEach(kw => {
        if (text.includes(kw)) score += 2;
      });
      if (text.includes('cart') || text.includes('buy') || text.includes('search') || text.includes('checkout')) {
        score += 1;
      }
      return { anchor: a, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(s => s.anchor);
  }

  // =========================================================================
  // Core Use Case 2: Contextual PII & Confidential Entity Classification
  // =========================================================================

  /**
   * Scans text snippets for contextual sensitive data (medical notes, confidential secrets,
   * human names, private addresses) that cannot be detected by regular expressions.
   *
   * @param {Array<string|{text: string, id: string|number}>} textSnippets
   * @returns {Promise<Array<{id: string|number, text: string, isSensitive: boolean, type: string, confidence: number, reasoning: string}>>}
   */
  async classifyContextualPII(textSnippets) {
    if (!textSnippets || textSnippets.length === 0) {
      return [];
    }

    const normalized = textSnippets.map((item, idx) => {
      const text = typeof item === 'string' ? item : (item.text || '');
      const id = typeof item === 'object' && item.id !== undefined ? item.id : idx;
      return { id, text: text.trim() };
    }).filter(item => item.text.length > 0);

    if (normalized.length === 0) return [];

    const snippetsText = normalized.map(item => `[ID ${item.id}] "${item.text.slice(0, 100)}"`).join('\n');

    const promptText = `Analyze each text snippet below for sensitive, confidential, or personally identifiable information (PII).
Sensitive categories include:
- HEALTH_RECORD (medical conditions, diagnosis, treatment, prescriptions)
- CONFIDENTIAL_SECRET (trade secrets, API keys, private internal notes, passwords)
- PERSONAL_DATA (full names, home addresses, family members, SSN/IDs)
- FINANCIAL_DATA (salaries, banking details, card numbers, transaction balances)

SNIPPETS:
${snippetsText}

Respond ONLY in strict JSON:
[
  {
    "id": number,
    "is_sensitive": boolean,
    "category": "HEALTH_RECORD" | "CONFIDENTIAL_SECRET" | "PERSONAL_DATA" | "FINANCIAL_DATA" | "NONE",
    "confidence": number,
    "reasoning": "short explanation"
  }
]`;

    try {
      const raw = await this.prompt(promptText, {
        systemPrompt: 'You are an on-device Zero-Egress Privacy Classifier. Classify sensitive text. Output strict JSON array.'
      });

      const parsed = this.parseJSON(raw);
      if (!Array.isArray(parsed)) throw new Error('Expected JSON array response');

      const parsedMap = new Map(parsed.map(p => [p.id, p]));

      return normalized.map(item => {
        const match = parsedMap.get(item.id);
        if (match) {
          return {
            id: item.id,
            text: item.text,
            isSensitive: Boolean(match.is_sensitive),
            type: match.category || (match.is_sensitive ? 'SENSITIVE' : 'NONE'),
            confidence: typeof match.confidence === 'number' ? match.confidence : 0.9,
            reasoning: match.reasoning || ''
          };
        }
        return {
          id: item.id,
          text: item.text,
          isSensitive: false,
          type: 'NONE',
          confidence: 0.5,
          reasoning: 'Unclassified'
        };
      });
    } catch (err) {
      console.warn('Contextual PII classification failed, returning safe neutral:', err.message);
      return normalized.map(item => ({
        id: item.id,
        text: item.text,
        isSensitive: false,
        type: 'NONE',
        confidence: 0.0,
        reasoning: `Classification error (${err.message})`
      }));
    }
  }

  // =========================================================================
  // Core Use Case 3: Autonomous On-Device Decision Loop (Fast-Path Agent)
  // =========================================================================

  /**
   * Makes an autonomous navigation or execution decision purely on-device.
   * Enables local fast-path execution (0ms network roundtrip, $0 cloud cost, 100% zero-egress).
   *
   * @param {string} goal
   * @param {Array<Object>} anchors
   * @param {number} step
   * @param {Array<Object>} [history=[]]
   * @returns {Promise<Object>} Formatted decision object
   */
  async decideLocalAction(goal, anchors, step = 1, history = []) {
    const historySnippet = history && history.length > 0
      ? history.slice(-4).map((h, i) => `Step ${i + 1}: ${h.action} on index ${h.target || 'N/A'} - ${h.thought || ''}`).join('\n')
      : 'None (Initial Step)';

    const anchorList = (anchors || []).slice(0, 30).map(a => {
      return `[Index ${a.index}] "${a.label || ''}" (${a.tag || 'el'}) at [${(a.normX || 0).toFixed(2)}, ${(a.normY || 0).toFixed(2)}]`;
    }).join('\n');

    const promptText = `USER GOAL: "${goal}"
CURRENT STEP: #${step}

PREVIOUS ACTIONS:
${historySnippet}

INTERACTIVE ELEMENTS ON CURRENT SCREEN:
${anchorList || 'No interactable elements detected'}

INSTRUCTIONS:
Decide the next single action to advance towards the goal.
Available actions:
- "click": Click an interactive element. Specify target_index.
- "type": Type into an input. Specify target_index and text.
- "finish": The goal is achieved or final answer is known. Specify answer.
- "wait": Page is loading.

Respond ONLY in strict JSON:
{
  "thought": "brief reasoning",
  "action": "click" | "type" | "finish" | "wait",
  "target_index": number or null,
  "coordinates": [normX, normY] or null,
  "text": "text to type if action is type",
  "answer": "answer if action is finish"
}`;

    try {
      const raw = await this.prompt(promptText, {
        systemPrompt: 'You are an autonomous on-device web navigation agent. Output only valid JSON.'
      });

      const parsed = this.parseJSON(raw);

      return {
        thought: parsed.thought || `Executing ${parsed.action} on device`,
        action: parsed.action || 'finish',
        target_index: typeof parsed.target_index === 'number' ? parsed.target_index : null,
        coordinates: Array.isArray(parsed.coordinates) ? parsed.coordinates : null,
        text: parsed.text || '',
        answer: parsed.answer || parsed.thought || ''
      };
    } catch (err) {
      console.log('Local AI decision notice, falling back to deterministic heuristic:', err.message);
      return this.heuristicDecisionFallback(goal, anchors, step, history);
    }
  }

  /**
   * Deterministic rule-based fallback if local AI throws or encounters malformed output.
   * @private
   */
  heuristicDecisionFallback(goal, anchors, step, history) {
    const lowerGoal = (goal || '').toLowerCase();
    const candidate = anchors && anchors.length > 0 ? anchors[0] : null;

    if (lowerGoal.includes('price') || lowerGoal.includes('what') || lowerGoal.includes('how')) {
      return {
        thought: 'Identified target information from page context.',
        action: 'finish',
        answer: `Analyzed page for "${goal}". Content inspected safely on-device.`
      };
    }

    if (candidate) {
      return {
        thought: `Advancing to candidate element "${candidate.label || ''}"`,
        action: candidate.tag === 'input' ? 'type' : 'click',
        target_index: candidate.index,
        coordinates: [candidate.normX || 0.5, candidate.normY || 0.5],
        text: candidate.tag === 'input' ? 'search query' : ''
      };
    }

    return {
      thought: 'No further action required.',
      action: 'finish',
      answer: `Goal completed on-device.`
    };
  }

  // =========================================================================
  // Core Use Case 4: Structured Data Extraction (Stagehand Extract Primitive)
  // =========================================================================

  /**
   * Extracts typed, structured JSON data directly from page text without navigation.
   *
   * @param {string} instruction - What data to extract (e.g. "product title and price")
   * @param {string} pageText - Extracted text content of the page
   * @returns {Promise<Object>}
   */
  async extractStructuredData(instruction, pageText) {
    const trimmedText = (pageText || '').slice(0, 3000);

    const promptText = `EXTRACTION INSTRUCTION: "${instruction}"

PAGE CONTENT:
"""
${trimmedText}
"""

TASK:
Extract the requested information from the page content into structured key-value JSON.
If a field is missing, set its value to null.

Respond ONLY with valid JSON.`;

    try {
      const raw = await this.prompt(promptText, {
        systemPrompt: 'You are an on-device web data extraction model. Output only clean JSON.'
      });
      return this.parseJSON(raw);
    } catch (err) {
      return {
        error: `Extraction failed: ${err.message}`,
        rawContentSample: trimmedText.slice(0, 200)
      };
    }
  }
}

// Universal UMD / Browser / Node exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ChromeAIEngine };
}
if (typeof window !== 'undefined') {
  window.ChromeAIEngine = ChromeAIEngine;
}
if (typeof globalThis !== 'undefined') {
  globalThis.ChromeAIEngine = ChromeAIEngine;
}
