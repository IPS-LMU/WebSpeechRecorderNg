/**
 * Single source of truth for the recorder's keyboard shortcuts.
 *
 * Key values are `KeyboardEvent.key` strings. The key handlers in
 * `audiorecorder.ts` and `sessionmanager.ts`, the transport-button
 * tooltips, and the in-app manual all read from here so the three
 * cannot drift apart.
 */

export const KEY = {
  START_STOP: ' ',
  PAUSE: 'p',
  STOP: 'Escape',
  PLAY: 'MediaPlayPause',
  PLAY_PROMPT: 'r',
  FORWARD: 'ArrowRight',
  BACKWARD: 'ArrowLeft',
  RESPONDENT: 'd',
} as const;

export interface KeyBinding {
  /** `KeyboardEvent.key` value. */
  key: string;
  /** Human-readable key name shown in tooltips and the manual (a key name, not prose). */
  label: string;
  /** One-line description of what the key does, in English. */
  description: string;
  /** Catalogue key for `description`; the manual translates through it, `description` is the fallback. */
  descriptionKey: string;
}

export const KEY_BINDINGS: KeyBinding[] = [
  {
    key: KEY.START_STOP, label: 'Space', description: 'Start or stop recording',
    descriptionKey: 'spr.keybinding.startStop',
  },
  {
    key: KEY.PAUSE, label: 'P', description: 'Pause recording',
    descriptionKey: 'spr.keybinding.pause',
  },
  {
    key: KEY.STOP, label: 'Esc', description: 'Stop recording and collapse the audio view',
    descriptionKey: 'spr.keybinding.stop',
  },
  {
    key: KEY.PLAY, label: 'Media Play/Pause', description: 'Play back the recording',
    descriptionKey: 'spr.keybinding.play',
  },
  {
    key: KEY.PLAY_PROMPT, label: 'R', description: 'Play the prompt sound again',
    descriptionKey: 'spr.keybinding.playPrompt',
  },
  {
    key: KEY.FORWARD, label: '→', description: 'Go to the next prompt',
    descriptionKey: 'spr.keybinding.forward',
  },
  {
    key: KEY.BACKWARD, label: '←', description: 'Go to the previous prompt',
    descriptionKey: 'spr.keybinding.backward',
  },
  {
    key: KEY.RESPONDENT, label: 'D', description: 'Open or focus the respondent display',
    descriptionKey: 'spr.keybinding.respondent',
  },
];

/** Human-readable label for a key value, falling back to the raw value. */
export function keyLabel(key: string): string {
  const binding = KEY_BINDINGS.find((b) => b.key === key);
  return binding ? binding.label : key;
}

/**
 * Whether the event targets a field the operator types into. The shortcuts must not fire there —
 * `d` would otherwise open the respondent window while a recording file is being renamed.
 */
export function isEditableTarget(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  if (!target) {
    return false;
  }
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable === true;
}

/**
 * A configured key that is already taken by another recorder shortcut. Both handlers listen on
 * the window, so the caller warns about the clash instead of silently overriding a shortcut.
 */
export function collidingBinding(key: string, except: string = KEY.RESPONDENT): KeyBinding | undefined {
  return KEY_BINDINGS.find((b) => b.key === key && b.key !== except);
}
