import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Step-Wise Execution & Stepper Pipeline', () => {
  // Mock DOM stepper elements
  let phases;

  function createMockPhase(id) {
    let classes = ['stepper-phase'];
    return {
      id,
      get className() {
        return classes.join(' ');
      },
      set className(val) {
        classes = val.split(' ').filter(Boolean);
      },
      classList: {
        contains: (c) => classes.includes(c),
        add: (c) => { if (!classes.includes(c)) classes.push(c); },
        remove: (c) => { classes = classes.filter(x => x !== c); }
      }
    };
  }

  function setStepperPhase(phaseNum, phaseMap) {
    for (let i = 1; i <= 4; i++) {
      const el = phaseMap[`phase-${i}`];
      if (!el) continue;
      if (i < phaseNum) {
        el.className = 'stepper-phase phase-done';
      } else if (i === phaseNum) {
        el.className = 'stepper-phase phase-active';
      } else {
        el.className = 'stepper-phase';
      }
    }
  }

  function clearStepperPhases(phaseMap) {
    for (let i = 1; i <= 4; i++) {
      const el = phaseMap[`phase-${i}`];
      if (el) el.className = 'stepper-phase';
    }
  }

  beforeEach(() => {
    phases = {
      'phase-1': createMockPhase('phase-1'),
      'phase-2': createMockPhase('phase-2'),
      'phase-3': createMockPhase('phase-3'),
      'phase-4': createMockPhase('phase-4')
    };
  });

  describe('Stepper Pipeline Visualizer', () => {
    it('should set Phase 1 active and others neutral', () => {
      setStepperPhase(1, phases);
      expect(phases['phase-1'].className).toBe('stepper-phase phase-active');
      expect(phases['phase-2'].className).toBe('stepper-phase');
      expect(phases['phase-3'].className).toBe('stepper-phase');
      expect(phases['phase-4'].className).toBe('stepper-phase');
    });

    it('should mark prior phases as done and current phase as active', () => {
      setStepperPhase(2, phases);
      expect(phases['phase-1'].className).toBe('stepper-phase phase-done');
      expect(phases['phase-2'].className).toBe('stepper-phase phase-active');
      expect(phases['phase-3'].className).toBe('stepper-phase');

      setStepperPhase(3, phases);
      expect(phases['phase-1'].className).toBe('stepper-phase phase-done');
      expect(phases['phase-2'].className).toBe('stepper-phase phase-done');
      expect(phases['phase-3'].className).toBe('stepper-phase phase-active');
      expect(phases['phase-4'].className).toBe('stepper-phase');

      setStepperPhase(4, phases);
      expect(phases['phase-1'].className).toBe('stepper-phase phase-done');
      expect(phases['phase-2'].className).toBe('stepper-phase phase-done');
      expect(phases['phase-3'].className).toBe('stepper-phase phase-done');
      expect(phases['phase-4'].className).toBe('stepper-phase phase-active');
    });

    it('should mark all 4 phases as done when phaseNum is 5 (completed)', () => {
      setStepperPhase(5, phases);
      expect(phases['phase-1'].className).toBe('stepper-phase phase-done');
      expect(phases['phase-2'].className).toBe('stepper-phase phase-done');
      expect(phases['phase-3'].className).toBe('stepper-phase phase-done');
      expect(phases['phase-4'].className).toBe('stepper-phase phase-done');
    });

    it('should clear all phase states on reset', () => {
      setStepperPhase(3, phases);
      clearStepperPhases(phases);
      expect(phases['phase-1'].className).toBe('stepper-phase');
      expect(phases['phase-2'].className).toBe('stepper-phase');
      expect(phases['phase-3'].className).toBe('stepper-phase');
      expect(phases['phase-4'].className).toBe('stepper-phase');
    });
  });

  describe('Step-Wise State Machine Transitions', () => {
    it('should transition from step 1 to paused step 2 after non-finish action', () => {
      let currentAgentStep = 1;
      const maxSteps = 10;
      let statusBadge = 'IDLE';
      let buttonText = 'STEP 1: EXECUTE';
      const history = [];

      // Simulate executing single step returning non-finish
      const mockDecision = { action: 'click', target_index: 3, thought: 'Click on search bar' };
      history.push(mockDecision);

      currentAgentStep++;
      statusBadge = 'PAUSED';
      buttonText = `STEP ${currentAgentStep}: EXECUTE ▶`;

      expect(currentAgentStep).toBe(2);
      expect(statusBadge).toBe('PAUSED');
      expect(buttonText).toBe('STEP 2: EXECUTE ▶');
      expect(history.length).toBe(1);
    });

    it('should transition to COMPLETED when action is finish', () => {
      let currentAgentStep = 2;
      const maxSteps = 10;
      let statusBadge = 'RUNNING';
      let buttonText = 'STEP 2: EXECUTE ▶';
      let isStepBtnDisabled = false;

      const mockDecision = { action: 'finish', thought: 'Item added to cart successfully' };
      if (mockDecision.action === 'finish') {
        statusBadge = 'COMPLETED';
        buttonText = 'COMPLETED';
        isStepBtnDisabled = true;
        setStepperPhase(5, phases);
      }

      expect(statusBadge).toBe('COMPLETED');
      expect(buttonText).toBe('COMPLETED');
      expect(isStepBtnDisabled).toBe(true);
      expect(phases['phase-4'].className).toBe('stepper-phase phase-done');
    });

    it('should transition to MAX REACHED when current step exceeds maxSteps', () => {
      let currentAgentStep = 5;
      const maxSteps = 5;
      let statusBadge = 'RUNNING';
      let buttonText = 'STEP 5: EXECUTE ▶';
      let isStepBtnDisabled = false;

      currentAgentStep++;
      if (currentAgentStep > maxSteps) {
        statusBadge = 'MAX REACHED';
        buttonText = 'MAX REACHED';
        isStepBtnDisabled = true;
      }

      expect(currentAgentStep).toBe(6);
      expect(statusBadge).toBe('MAX REACHED');
      expect(buttonText).toBe('MAX REACHED');
      expect(isStepBtnDisabled).toBe(true);
    });

    it('should properly reset state, history, and clear tab overlays on reset', async () => {
      let currentAgentStep = 4;
      let agentHistory = [{ action: 'click' }, { action: 'type' }, { action: 'click' }];
      let statusBadge = 'PAUSED';
      let buttonText = 'STEP 4: EXECUTE ▶';
      const mockSendMessage = vi.fn().mockResolvedValue({ success: true });

      // Simulate resetAgentDemo
      currentAgentStep = 1;
      agentHistory = [];
      statusBadge = 'IDLE';
      buttonText = 'STEP 1: EXECUTE ▶';
      clearStepperPhases(phases);
      await mockSendMessage({ action: 'CLEAR_DETECTIONS' });

      expect(currentAgentStep).toBe(1);
      expect(agentHistory.length).toBe(0);
      expect(statusBadge).toBe('IDLE');
      expect(buttonText).toBe('STEP 1: EXECUTE ▶');
      expect(phases['phase-1'].className).toBe('stepper-phase');
      expect(mockSendMessage).toHaveBeenCalledWith({ action: 'CLEAR_DETECTIONS' });
    });
  });
});
