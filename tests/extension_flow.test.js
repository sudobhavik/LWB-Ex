import { describe, it, expect, vi } from 'vitest';

describe('Extension Flow & Message Handling', () => {
  it('should simulate tab message dispatch and response', async () => {
    // Mock chrome / browser runtime messaging
    const mockListeners = [];
    const mockRuntime = {
      onMessage: {
        addListener: (fn) => mockListeners.push(fn)
      },
      sendMessage: vi.fn(async (message) => {
        for (const listener of mockListeners) {
          const res = await new Promise(resolve => {
            const returned = listener(message, {}, resolve);
            if (!returned) resolve(null);
          });
          if (res) return res;
        }
        return null;
      })
    };

    // Register a mock handler simulating content.js
    mockRuntime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.action === 'APPLY_DETECTIONS') {
        sendResponse({ success: true, count: msg.detections.length });
        return true;
      }
      if (msg.action === 'CLEAR_DETECTIONS') {
        sendResponse({ success: true });
        return true;
      }
      return false;
    });

    // Test APPLY_DETECTIONS dispatch
    const applyRes = await mockRuntime.sendMessage({
      action: 'APPLY_DETECTIONS',
      detections: [
        { classId: 0, className: 'face', score: 0.95, x: 10, y: 10, width: 50, height: 50 }
      ],
      mode: 'outline'
    });
    expect(applyRes).toEqual({ success: true, count: 1 });

    // Test CLEAR_DETECTIONS dispatch
    const clearRes = await mockRuntime.sendMessage({
      action: 'CLEAR_DETECTIONS'
    });
    expect(clearRes).toEqual({ success: true });
  });
});
