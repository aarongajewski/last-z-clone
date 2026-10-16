import { describe, expect, it } from 'vitest';
import {
  TUTORIAL_STEPS,
  TUTORIAL_TEXT,
  createTutorial,
  dismissStep,
  isTutorialComplete,
  isTutorialPaused,
  skipTutorial,
  triggerStep,
} from '../src/game/tutorial';

describe('tutorial state', () => {
  it('shows each step once, in whatever order the stage triggers them', () => {
    let state = createTutorial(true);
    let r = triggerStep(state, 'gates');
    expect(r.show).toBe(true);
    expect(isTutorialPaused(r.state)).toBe(true);
    state = dismissStep(r.state);
    expect(isTutorialPaused(state)).toBe(false);

    r = triggerStep(state, 'gates');
    expect(r.show).toBe(false);
    expect(r.state).toBe(state);
  });

  it('does not open a second card while one is showing', () => {
    const open = triggerStep(createTutorial(true), 'steer').state;
    const r = triggerStep(open, 'gates');
    expect(r.show).toBe(false);
    expect(r.state.active).toBe('steer');
    // The blocked step is not marked as shown, so it can come back later.
    const later = triggerStep(dismissStep(open), 'gates');
    expect(later.show).toBe(true);
  });

  it('disables itself after the last step is dismissed', () => {
    let state = createTutorial(true);
    for (const step of TUTORIAL_STEPS) {
      const r = triggerStep(state, step);
      expect(r.show).toBe(true);
      state = dismissStep(r.state);
    }
    expect(isTutorialComplete(state)).toBe(true);
    expect(state.enabled).toBe(false);
    expect(triggerStep(state, 'steer').show).toBe(false);
  });

  it('never shows when disabled, and skip closes the open card for good', () => {
    expect(triggerStep(createTutorial(false), 'steer').show).toBe(false);
    const open = triggerStep(createTutorial(true), 'barriers').state;
    const skipped = skipTutorial(open);
    expect(skipped.enabled).toBe(false);
    expect(isTutorialPaused(skipped)).toBe(false);
    expect(triggerStep(skipped, 'boss').show).toBe(false);
  });

  it('dismissing with nothing open is a no-op', () => {
    const state = createTutorial(true);
    expect(dismissStep(state)).toBe(state);
  });

  it('has copy for every step', () => {
    for (const step of TUTORIAL_STEPS) {
      expect(TUTORIAL_TEXT[step].title.length).toBeGreaterThan(0);
      expect(TUTORIAL_TEXT[step].body.length).toBeGreaterThan(20);
    }
  });
});
