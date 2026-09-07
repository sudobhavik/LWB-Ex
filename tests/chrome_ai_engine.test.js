import { describe, it, expect, beforeEach, vi } from 'vitest';
const { ChromeAIEngine } = require('../extension/engine/chrome_ai_engine.js');

describe('Chrome Built-in AI (Prompt API / Gemini Nano) Engine Tests', () => {
  let mockSession;
  let mockProvider;

  beforeEach(() => {
    mockSession = {
      prompt: vi.fn(),
      destroy: vi.fn(),
      close: vi.fn()
    };

    mockProvider = {
      capabilities: vi.fn().mockResolvedValue({ available: 'readily' }),
      create: vi.fn().mockResolvedValue(mockSession)
    };
  });

  describe('Provider Detection & Availability', () => {
    it('should report unsupported when no AI provider exists in environment', async () => {
      const engine = new ChromeAIEngine({ provider: null });
      // ensure globalThis.ai is undefined
      const origAi = globalThis.ai;
      delete globalThis.ai;

      const status = await engine.checkAvailability();
      expect(status.supported).toBe(false);
      expect(status.available).toBe('unsupported');
      expect(status.isReady).toBe(false);
      expect(status.details).toContain('not detected');

      if (origAi) globalThis.ai = origAi;
    });

    it('should report ready when mock provider capabilities return readily', async () => {
      const engine = new ChromeAIEngine({ provider: mockProvider });
      const status = await engine.checkAvailability();

      expect(status.supported).toBe(true);
      expect(status.available).toBe('readily');
      expect(status.isReady).toBe(true);
      expect(status.details).toContain('ready for on-device inference');
    });

    it('should report downloading state when model weights are loading in background', async () => {
      mockProvider.capabilities.mockResolvedValueOnce({ available: 'after-download' });
      const engine = new ChromeAIEngine({ provider: mockProvider });
      const status = await engine.checkAvailability();

      expect(status.supported).toBe(true);
      expect(status.available).toBe('after-download');
      expect(status.isReady).toBe(false);
      expect(status.details).toContain('downloading model weights');
    });

    it('should support alternative availability() function on provider', async () => {
      const altProvider = {
        availability: vi.fn().mockResolvedValue('readily'),
        create: vi.fn().mockResolvedValue(mockSession)
      };
      const engine = new ChromeAIEngine({ provider: altProvider });
      const status = await engine.checkAvailability();

      expect(status.supported).toBe(true);
      expect(status.isReady).toBe(true);
    });
  });

  describe('Session Lifecycle & Prompting', () => {
    it('should create and cache session with configured temperature and system prompt', async () => {
      const engine = new ChromeAIEngine({
        provider: mockProvider,
        temperature: 0.1,
        topK: 5
      });

      mockSession.prompt.mockResolvedValueOnce('Hello from on-device Nano');

      const res = await engine.prompt('Test prompt');
      expect(res).toBe('Hello from on-device Nano');
      expect(mockProvider.create).toHaveBeenCalledTimes(1);
      expect(mockProvider.create).toHaveBeenCalledWith(expect.objectContaining({
        temperature: 0.1,
        topK: 5
      }));

      // Second prompt should reuse cached session
      mockSession.prompt.mockResolvedValueOnce('Reused session answer');
      const res2 = await engine.prompt('Second prompt');
      expect(res2).toBe('Reused session answer');
      expect(mockProvider.create).toHaveBeenCalledTimes(1);
    });

    it('should destroy previous session when system prompt changes', async () => {
      const engine = new ChromeAIEngine({ provider: mockProvider });
      mockSession.prompt.mockResolvedValue('OK');

      await engine.prompt('Prompt 1', { systemPrompt: 'System A' });
      expect(mockProvider.create).toHaveBeenCalledTimes(1);

      await engine.prompt('Prompt 2', { systemPrompt: 'System B' });
      expect(mockSession.destroy).toHaveBeenCalled();
      expect(mockProvider.create).toHaveBeenCalledTimes(2);
    });

    it('should clean up session on destroySession()', async () => {
      const engine = new ChromeAIEngine({ provider: mockProvider });
      mockSession.prompt.mockResolvedValue('OK');

      await engine.prompt('Prompt 1');
      expect(engine.activeSession).not.toBeNull();

      await engine.destroySession();
      expect(mockSession.destroy).toHaveBeenCalled();
      expect(engine.activeSession).toBeNull();
    });
  });

  describe('JSON Parsing & Markdown Hygiene', () => {
    const engine = new ChromeAIEngine({ provider: mockProvider });

    it('should parse direct JSON string', () => {
      const parsed = engine.parseJSON('{"action": "click", "index": 3}');
      expect(parsed).toEqual({ action: 'click', index: 3 });
    });

    it('should strip markdown code blocks and parse JSON', () => {
      const markdown = '```json\n{\n  "thought": "Found buy button",\n  "action": "click"\n}\n```';
      const parsed = engine.parseJSON(markdown);
      expect(parsed.action).toBe('click');
      expect(parsed.thought).toBe('Found buy button');
    });

    it('should extract JSON from conversational surroundings', () => {
      const conversational = 'Here is the decision:\n{"action":"finish","answer":"$299"}\nHope this helps!';
      const parsed = engine.parseJSON(conversational);
      expect(parsed.action).toBe('finish');
      expect(parsed.answer).toBe('$299');
    });

    it('should parse JSON arrays', () => {
      const raw = '```json\n[{"id": 1, "is_sensitive": true}]\n```';
      const parsed = engine.parseJSON(raw);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].id).toBe(1);
      expect(parsed[0].is_sensitive).toBe(true);
    });
  });

  describe('Core Use Case 1: Semantic DOM Anchor Pruning', () => {
    it('should prune 50 anchors down to model selected indices', async () => {
      const engine = new ChromeAIEngine({ provider: mockProvider });

      const anchors = Array.from({ length: 15 }, (_, i) => ({
        index: i + 1,
        label: i === 4 ? 'Add to Shopping Cart' : (i === 1 ? 'Search Products' : `Link Item ${i + 1}`),
        tag: i === 1 ? 'input' : 'button',
        normX: 0.5,
        normY: 0.1 * i
      }));

      mockSession.prompt.mockResolvedValueOnce(JSON.stringify({
        selected_indices: [5, 2],
        primary_index: 5,
        reasoning: 'Index 5 directly matches buying intent'
      }));

      const result = await engine.pruneDOMAnchors('Buy headphones', anchors, 3);

      expect(result.selectedAnchors.length).toBe(2);
      expect(result.selectedAnchors[0].index).toBe(5);
      expect(result.selectedAnchors[0].label).toBe('Add to Shopping Cart');
      expect(result.primaryIndex).toBe(5);
      expect(result.reasoning).toContain('Index 5');
    });

    it('should return early without calling model if anchor list is already <= limit', async () => {
      const engine = new ChromeAIEngine({ provider: mockProvider });
      const smallAnchors = [
        { index: 1, label: 'Search', tag: 'input' },
        { index: 2, label: 'Cart', tag: 'button' }
      ];

      const result = await engine.pruneDOMAnchors('Search phone', smallAnchors, 5);
      expect(result.selectedAnchors.length).toBe(2);
      expect(mockSession.prompt).not.toHaveBeenCalled();
    });

    it('should fall back cleanly to keyword heuristic if model returns invalid output', async () => {
      const engine = new ChromeAIEngine({ provider: mockProvider });
      const anchors = [
        { index: 1, label: 'About Us', tag: 'a' },
        { index: 2, label: 'Add to Cart', tag: 'button' },
        { index: 3, label: 'Privacy Policy', tag: 'a' }
      ];

      // Model returns malformed response
      mockSession.prompt.mockResolvedValueOnce('Invalid non-json answer');

      const result = await engine.pruneDOMAnchors('cart checkout', anchors, 2);
      expect(result.selectedAnchors.length).toBe(2);
      expect(result.selectedAnchors[0].label).toBe('Add to Cart');
      expect(result.reasoning).toContain('Heuristic fallback');
    });
  });

  describe('Core Use Case 2: Contextual PII Classification', () => {
    it('should classify contextual health records and secrets', async () => {
      const engine = new ChromeAIEngine({ provider: mockProvider });

      const snippets = [
        { id: 1, text: 'Patient was diagnosed with Acute Stage-2 Hypertension and prescribed Lisinopril.' },
        { id: 2, text: 'Confidential trade secret: internal project Titan encryption key is stored in vault.' },
        { id: 3, text: 'The weather in San Francisco today is sunny and 68 degrees.' }
      ];

      mockSession.prompt.mockResolvedValueOnce(JSON.stringify([
        { id: 1, is_sensitive: true, category: 'HEALTH_RECORD', confidence: 0.98, reasoning: 'Medical diagnosis and prescription' },
        { id: 2, is_sensitive: true, category: 'CONFIDENTIAL_SECRET', confidence: 0.95, reasoning: 'Internal trade secret reference' },
        { id: 3, is_sensitive: false, category: 'NONE', confidence: 0.99, reasoning: 'Public weather forecast' }
      ]));

      const findings = await engine.classifyContextualPII(snippets);

      expect(findings.length).toBe(3);
      expect(findings[0].isSensitive).toBe(true);
      expect(findings[0].type).toBe('HEALTH_RECORD');
      expect(findings[1].isSensitive).toBe(true);
      expect(findings[1].type).toBe('CONFIDENTIAL_SECRET');
      expect(findings[2].isSensitive).toBe(false);
      expect(findings[2].type).toBe('NONE');
    });

    it('should return safe neutral items if classification model fails', async () => {
      const engine = new ChromeAIEngine({ provider: mockProvider });
      mockSession.prompt.mockRejectedValueOnce(new Error('Prompt API timeout'));

      const findings = await engine.classifyContextualPII(['Hello world']);
      expect(findings.length).toBe(1);
      expect(findings[0].isSensitive).toBe(false);
      expect(findings[0].reasoning).toContain('Classification error');
    });
  });

  describe('Core Use Case 3: Autonomous Local Decision', () => {
    it('should parse click action decision with target index and coordinates', async () => {
      const engine = new ChromeAIEngine({ provider: mockProvider });
      const anchors = [
        { index: 1, label: 'Search', tag: 'input', normX: 0.5, normY: 0.05 },
        { index: 2, label: 'Add to Cart', tag: 'button', normX: 0.82, normY: 0.65 }
      ];

      mockSession.prompt.mockResolvedValueOnce(JSON.stringify({
        thought: 'Clicking Add to Cart button to add MacBook to basket',
        action: 'click',
        target_index: 2,
        coordinates: [0.82, 0.65]
      }));

      const decision = await engine.decideLocalAction('Buy MacBook', anchors, 2, [
        { action: 'click', target: 1, thought: 'Searched for item' }
      ]);

      expect(decision.action).toBe('click');
      expect(decision.target_index).toBe(2);
      expect(decision.coordinates).toEqual([0.82, 0.65]);
      expect(decision.thought).toContain('Add to Cart');
    });

    it('should parse type action decision with input text', async () => {
      const engine = new ChromeAIEngine({ provider: mockProvider });
      const anchors = [
        { index: 1, label: 'Search input', tag: 'input', normX: 0.4, normY: 0.08 }
      ];

      mockSession.prompt.mockResolvedValueOnce(JSON.stringify({
        thought: 'Typing product name into search box',
        action: 'type',
        target_index: 1,
        text: 'MacBook Pro 16'
      }));

      const decision = await engine.decideLocalAction('Find MacBook', anchors, 1, []);
      expect(decision.action).toBe('type');
      expect(decision.target_index).toBe(1);
      expect(decision.text).toBe('MacBook Pro 16');
    });

    it('should parse finish action decision with answer', async () => {
      const engine = new ChromeAIEngine({ provider: mockProvider });

      mockSession.prompt.mockResolvedValueOnce(JSON.stringify({
        thought: 'Checkout successfully completed, order confirmation visible.',
        action: 'finish',
        answer: 'Order placed successfully. Total charged: $2,499.00.'
      }));

      const decision = await engine.decideLocalAction('Order MacBook', [], 4, []);
      expect(decision.action).toBe('finish');
      expect(decision.answer).toContain('Order placed successfully');
    });
  });

  describe('Core Use Case 4: Structured Data Extraction', () => {
    it('should extract structured JSON fields from raw page text', async () => {
      const engine = new ChromeAIEngine({ provider: mockProvider });
      const pageText = 'Apple MacBook Pro 16-inch M3 Max - Space Black. Price: $3,499.00. In Stock. Ships tomorrow.';

      mockSession.prompt.mockResolvedValueOnce(JSON.stringify({
        product_name: 'Apple MacBook Pro 16-inch M3 Max',
        price: 3499.00,
        currency: 'USD',
        availability: 'In Stock'
      }));

      const data = await engine.extractStructuredData('Extract product details and price', pageText);
      expect(data.product_name).toBe('Apple MacBook Pro 16-inch M3 Max');
      expect(data.price).toBe(3499.00);
      expect(data.availability).toBe('In Stock');
    });
  });
});
