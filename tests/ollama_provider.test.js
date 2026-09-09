import { describe, it, expect, vi, beforeEach } from 'vitest';
const { VLMRouter } = require('../extension/engine/vlm_router');

describe('Ollama Local Offline Server (Qwen3-VL) Integration Tests', () => {
  let router;

  beforeEach(() => {
    vi.restoreAllMocks();
    router = new VLMRouter({
      ollamaEndpoint: 'http://localhost:11434',
      ollamaModel: 'qwen3-vl:2b',
      preferredProvider: 'ollama'
    });
  });

  describe('Configuration & Initialization', () => {
    it('should initialize with default Ollama settings', () => {
      const defaultRouter = new VLMRouter();
      expect(defaultRouter.ollamaEndpoint).toBe('http://localhost:11434');
      expect(defaultRouter.ollamaModel).toBe('qwen3-vl:2b');
    });

    it('should strip trailing slashes from Ollama endpoint', () => {
      router.setOllamaConfig('http://127.0.0.1:11434///', 'qwen3-vl:2b');
      expect(router.ollamaEndpoint).toBe('http://127.0.0.1:11434');
      expect(router.ollamaModel).toBe('qwen3-vl:2b');
    });
  });

  describe('Daemon Status Check (checkOllamaStatus)', () => {
    it('should detect running Ollama daemon and enumerate installed models', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [
            { name: 'qwen3-vl:2b', size: 1900000000 },
            { name: 'moondream:latest', size: 1700000000 }
          ]
        })
      });

      const status = await router.checkOllamaStatus();
      expect(status.online).toBe(true);
      expect(status.models).toEqual(['qwen3-vl:2b', 'moondream:latest']);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/tags',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should report offline status when Ollama daemon is unreachable', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      const status = await router.checkOllamaStatus();
      expect(status.online).toBe(false);
      expect(status.models).toEqual([]);
      expect(status.error).toContain('ECONNREFUSED');
    });
  });

  describe('Vision Request Querying (queryOllama)', () => {
    it('should dispatch valid OpenAI-compatible multimodal JSON to Ollama', async () => {
      const mockResponse = {
        thought: 'Identified checkout button on page',
        action: 'click',
        target_index: 3,
        coordinates: [0.55, 0.42],
        answer: 'Proceeding to checkout'
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify(mockResponse)
              }
            }
          ]
        })
      });

      const prompt = 'Find the buy button';
      const fakeDataUrl = 'data:image/jpeg;base64,QUJDREVGR0g=';

      const decision = await router.queryOllama(prompt, fakeDataUrl);

      expect(decision.action).toBe('click');
      expect(decision.target_index).toBe(3);
      expect(decision.coordinates).toEqual([0.55, 0.42]);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'http://localhost:11434/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"model":"qwen3-vl:2b"')
        })
      );
    });

    it('should handle markdown-wrapped JSON code fences from Ollama', async () => {
      const mockResponse = {
        thought: 'Navigating to cart',
        action: 'click',
        target_index: 1
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: `\`\`\`json\n${JSON.stringify(mockResponse)}\n\`\`\``
              }
            }
          ]
        })
      });

      const decision = await router.queryOllama('Go to cart', 'data:image/jpeg;base64,AAA');
      expect(decision.action).toBe('click');
      expect(decision.target_index).toBe(1);
    });

    it('should throw descriptive error when Ollama server returns HTTP error', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => 'model "qwen3-vl:2b" not found, try pulling it first'
      });

      await expect(router.queryOllama('test', 'data:image/jpeg;base64,AAA'))
        .rejects.toThrow(/Ollama Local VLM Error \(404\)/);
    });
  });

  describe('OmniParser-Style Visual Grounding Prompt Enhancement', () => {
    it('should format interactive anchors with visual icons and roles', () => {
      const anchors = [
        {
          index: 1,
          label: 'Shopping Cart',
          tag: 'button',
          role: 'button',
          iconType: 'shopping_cart',
          normX: 0.88,
          normY: 0.05
        },
        {
          index: 2,
          label: 'Search Products',
          tag: 'input',
          role: 'searchbox',
          iconType: 'search',
          normX: 0.45,
          normY: 0.05
        }
      ];

      const prompt = router.buildPrompt('Buy item', anchors, 1, []);
      expect(prompt).toContain('[Index 1] [ICON: shopping_cart] [ROLE: button] "Shopping Cart"');
      expect(prompt).toContain('[Index 2] [ICON: search] [ROLE: searchbox] "Search Products"');
    });
  });

  describe('Autonomous Offline Failover (decide)', () => {
    it('should use Ollama directly when preferredProvider is ollama', async () => {
      const mockResponse = { action: 'click', target_index: 2 };
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockResponse) } }]
        })
      });

      const res = await router.decide('Click cart', 'data:image/jpeg;base64,AAA');
      expect(res.decision.action).toBe('click');
      expect(res.providerUsed).toBe('Ollama (qwen3-vl:2b)');
    });

    it('should automatically fall back to Ollama in auto mode when cloud keys are missing', async () => {
      const autoRouter = new VLMRouter({
        preferredProvider: 'auto',
        openaiKey: '',
        geminiKey: ''
      });

      const mockResponse = { action: 'finish', answer: 'Done offline' };
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockResponse) } }]
        })
      });

      const res = await autoRouter.decide('Inspect page', 'data:image/jpeg;base64,AAA');
      expect(res.decision.action).toBe('finish');
      expect(res.providerUsed).toContain('Ollama (qwen3-vl:2b)');
    });
  });
});
