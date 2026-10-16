// Stage-1 tutorial state: which step overlays have been shown. Phaser-free for tests.

export type TutorialStep = 'steer' | 'gates' | 'barriers' | 'skill' | 'boss';

export const TUTORIAL_STEPS: readonly TutorialStep[] = ['steer', 'gates', 'barriers', 'skill', 'boss'];

export interface TutorialCard {
  title: string;
  body: string;
}

export const TUTORIAL_TEXT: Record<TutorialStep, TutorialCard> = {
  steer: {
    title: 'DRAG TO STEER',
    body: 'Slide a finger left or right anywhere on the road. Your squad follows and fires on its own.',
  },
  gates: {
    title: 'GATES',
    body: 'Green gates help: more troops or faster fire. Red gates hurt. Steer through the half you want.',
  },
  barriers: {
    title: 'BARRIERS',
    body: 'Walls show their HP. Shoot them down before they reach you, or they take soldiers with them.',
  },
  skill: {
    title: 'HERO SKILL',
    body: 'Tap the round button in the corner to fire your hero skill. It recharges after a short cooldown.',
  },
  boss: {
    title: 'BOSS',
    body: 'Dodge the acid, keep shooting, and watch its health bar at the top. Kill it to clear the stage.',
  },
};

export interface TutorialState {
  /** False once the player skipped it or it has been completed. */
  enabled: boolean;
  shown: readonly TutorialStep[];
  /** The step whose overlay is open right now, if any. */
  active: TutorialStep | null;
}

export function createTutorial(enabled: boolean): TutorialState {
  return { enabled, shown: [], active: null };
}

/** Asks to show `step`. Returns the new state and whether an overlay should open. */
export function triggerStep(state: TutorialState, step: TutorialStep): { state: TutorialState; show: boolean } {
  if (!state.enabled || state.active !== null || state.shown.includes(step)) return { state, show: false };
  return { state: { ...state, active: step, shown: [...state.shown, step] }, show: true };
}

/** Closes the open overlay. Completing the last step disables the tutorial. */
export function dismissStep(state: TutorialState): TutorialState {
  if (state.active === null) return state;
  const complete = TUTORIAL_STEPS.every((s) => state.shown.includes(s));
  return { ...state, active: null, enabled: state.enabled && !complete };
}

export function skipTutorial(state: TutorialState): TutorialState {
  return { ...state, enabled: false, active: null };
}

export function isTutorialComplete(state: TutorialState): boolean {
  return TUTORIAL_STEPS.every((s) => state.shown.includes(s));
}

/** The stage is frozen while a card is open. */
export function isTutorialPaused(state: TutorialState): boolean {
  return state.active !== null;
}
