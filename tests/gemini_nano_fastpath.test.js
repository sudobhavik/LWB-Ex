import { describe, it, expect, vi } from 'vitest';
const { ChromeAIEngine } = require('../extension/engine/chrome_ai_engine.js');

describe('Chrome Built-in AI (Gemini Nano Prompt API) Fast-Path Tests', () => {
  it('should probe availability and return readily when model is loaded', async () => {
    const mockProvider = {
      capabilities: async () => ({ available: 'readily' }),
      create: async () => ({
        prompt: async () => '{"thought":"Click search","action":"click","target_index":1,"coordinates":[0.5,0.1]}'
      })
    };

    const engine = new ChromeAIEngine({ provider: mockProvider });
    const status = await engine.checkAvailability();
    expect(status.supported).toBe(true);
    expect(status.available).toBe('readily');
    expect(status.isReady).toBe(true);
  });

  it('should execute fast-path local action decision on-device without network calls', async () => {
    const mockPromptFn = vi.fn().mockResolvedValue(JSON.stringify({
      thought: 'Click the Add to Cart button to complete user intent',
      action: 'click',
      target_index: 4,
      coordinates: [0.75, 0.45]
    }));

    const mockProvider = {
      capabilities: async () => ({ available: 'readily' }),
      create: async () => ({
        prompt: mockPromptFn
      })
    };

    const engine = new ChromeAIEngine({ provider: mockProvider });
    const anchors = [
      { index: 1, label: 'Search products', tag: 'input', normX: 0.5, normY: 0.05 },
      { index: 4, label: 'Add to Cart', tag: 'button', normX: 0.75, normY: 0.45 }
    ];

    const decision = await engine.decideLocalAction('Buy the product', anchors, 1, []);
    expect(mockPromptFn).toHaveBeenCalled();
    expect(decision.action).toBe('click');
    expect(decision.target_index).toBe(4);
    expect(decision.thought).toContain('Add to Cart');
  });

  it('should prune 30 DOM anchors down to top 3 candidates via semantic matching', async () => {
    const mockProvider = {
      capabilities: async () => ({ available: 'readily' }),
      create: async () => ({
        prompt: async () => JSON.stringify({
          selected_indices: [5, 12, 18],
          primary_index: 5,
          reasoning: 'Direct cart button matches purchase goal'
        })
      })
    };

    const engine = new ChromeAIEngine({ provider: mockProvider });
    const anchors = Array.from({ length: 25 }, (_, i) => ({
      index: i + 1,
      label: i === 4 ? 'Add to Cart' : `Link ${i + 1}`,
      tag: i === 4 ? 'button' : 'a'
    }));

    const result = await engine.pruneDOMAnchors('Add items to cart', anchors, 3);
    expect(result.selectedAnchors.length).toBe(3);
    expect(result.selectedAnchors[0].index).toBe(5);
    expect(result.primaryIndex).toBe(5);
  });

  it('should classify unstructured medical/confidential text that regex cannot detect', async () => {
    const mockProvider = {
      capabilities: async () => ({ available: 'readily' }),
      create: async () => ({
        prompt: async () => JSON.stringify([
          { id: 1, is_sensitive: true, category: 'HEALTH_RECORD', confidence: 0.95, reasoning: 'Patient diagnosis' },
          { id: 2, is_sensitive: false, category: 'NONE', confidence: 0.99, reasoning: 'Normal navigation' }
        ])
      })
    };

    const engine = new ChromeAIEngine({ provider: mockProvider });
    const snippets = [
      { id: 1, text: 'Patient diagnosed with Stage 2 Hypertension taking 10mg Lisinopril' },
      { id: 2, text: 'Click here to read our return policy and shipping terms' }
    ];

    const classifications = await engine.classifyContextualPII(snippets);
    expect(classifications[0].isSensitive).toBe(true);
    expect(classifications[0].type).toBe('HEALTH_RECORD');
    expect(classifications[1].isSensitive).toBe(false);
  });

  it('should cleanly fall back to heuristic when local model is unavailable or throws', async () => {
    const mockProvider = {
      capabilities: async () => ({ available: 'no' }),
      create: async () => { throw new Error('Model not initialized'); }
    };

    const engine = new ChromeAIEngine({ provider: mockProvider });
    const anchors = [
      { index: 1, label: 'Footer link 1', tag: 'a' },
      { index: 2, label: 'Footer link 2', tag: 'a' },
      { index: 3, label: 'Footer link 3', tag: 'a' },
      { index: 4, label: 'Footer link 4', tag: 'a' },
      { index: 5, label: 'Add to Cart', tag: 'button' }
    ];

    const result = await engine.pruneDOMAnchors('Add to cart', anchors, 2);
    expect(result.selectedAnchors.length).toBe(2);
    expect(result.selectedAnchors[0].label).toContain('Cart');
  });
});
