import { describe, it, expect } from 'vitest';
const { VLMRouter } = require('../extension/engine/vlm_router.js');

describe('Dual VLM Router Tests', () => {
  const router = new VLMRouter({
    openaiKey: 'test-openai-key',
    geminiKey: 'test-gemini-key',
    preferredProvider: 'auto'
  });

  describe('buildPrompt', () => {
    it('should format goal, steps, and interactive anchor list into prompt', () => {
      const anchors = [
        { index: 1, label: 'Search', tag: 'input', normX: 0.5, normY: 0.05 },
        { index: 2, label: 'Buy Now', tag: 'button', normX: 0.8, normY: 0.6 }
      ];
      const prompt = router.buildPrompt('Buy the MacBook Pro', anchors, 2, [
        { action: 'click', thought: 'Clicked product page' }
      ]);

      expect(prompt).toContain('Buy the MacBook Pro');
      expect(prompt).toContain('[Index 1] "Search" (input) at [0.50, 0.05]');
      expect(prompt).toContain('[Index 2] "Buy Now" (button) at [0.80, 0.60]');
      expect(prompt).toContain('STEP: #2');
      expect(prompt).toContain('REDACTED_*');
    });
  });

  describe('parseDecision', () => {
    it('should parse clean JSON formatted decision', () => {
      const jsonStr = JSON.stringify({
        thought: 'Clicking the checkout button',
        action: 'click',
        target_index: 2,
        coordinates: [0.8, 0.6]
      });

      const decision = router.parseDecision(jsonStr);
      expect(decision.thought).toBe('Clicking the checkout button');
      expect(decision.action).toBe('click');
      expect(decision.target_index).toBe(2);
      expect(decision.coordinates).toEqual([0.8, 0.6]);
    });

    it('should clean and extract JSON wrapped in markdown code blocks', () => {
      const mdStr = '```json\n{\n  "thought": "Type credit card number",\n  "action": "type",\n  "target_index": 5,\n  "text": "4532 8812 9044 1928"\n}\n```';
      const decision = router.parseDecision(mdStr);
      expect(decision.action).toBe('type');
      expect(decision.target_index).toBe(5);
      expect(decision.text).toBe('4532 8812 9044 1928');
    });

    it('should extract JSON even with arbitrary preceding conversational text', () => {
      const conversational = 'Here is the next step to execute:\n{"thought":"Finish purchase","action":"finish"}\nHope this helps!';
      const decision = router.parseDecision(conversational);
      expect(decision.thought).toBe('Finish purchase');
      expect(decision.action).toBe('finish');
    });

    it('should extract target index and click action from raw reasoning stream when JSON is missing', () => {
      const rawReasoning = `o, let's see. The user's goal is to buy headphones. Looking at the current screen, there's a Sony WH-1000XM5 Noise Canceling Headphones listed with a "Buy Now" button. The visible interactive anchors include the Sony headphones with a "Buy Now" button. The target index for this should be [Index 5] since it's the third product in the list.`;
      const decision = router.parseDecision(rawReasoning);
      expect(decision.action).toBe('click');
      expect(decision.target_index).toBe(5);
    });

    it('should strip chain-of-thought monologue prefixes from natural answers', () => {
      const reasoningWithAnswer = `Okay, let's see. The user is asking for the price of headphones. Therefore, the price is ₹29,990.00`;
      const decision = router.parseDecision(reasoningWithAnswer);
      expect(decision.action).toBe('finish');
      expect(decision.answer).toContain('₹29,990.00');
      expect(decision.answer).not.toContain("Okay, let's see");
    });
  });

  describe('error handling', () => {
    it('should throw clear error when no API keys are provided', async () => {
      const emptyRouter = new VLMRouter();
      await expect(emptyRouter.decide('Buy item', 'data:image/jpeg;base64,...')).rejects.toThrow(
        'No API Keys configured'
      );
    });
  });
});
