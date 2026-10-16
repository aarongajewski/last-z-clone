import { settleBuild } from './economy';
import { SAVE_KEY, defaultSave, parseSave, serializeSave, type MigrateOutcome, type SaveData } from './save';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** localStorage when usable (it throws in some private modes), else an in-memory stand-in. */
function pickStorage(): StorageLike {
  try {
    const probe = '__lastz_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    const memory = new Map<string, string>();
    return {
      getItem: (k) => memory.get(k) ?? null,
      setItem: (k, v) => void memory.set(k, v),
      removeItem: (k) => void memory.delete(k),
    };
  }
}

/** Single owner of the player's save. Everything reads through `get()` and writes through `update()`. */
export class SaveStore {
  private save: SaveData;
  readonly loadOutcome: MigrateOutcome;

  constructor(
    private readonly storage: StorageLike,
    now: number,
  ) {
    const loaded = parseSave(storage.getItem(SAVE_KEY), now);
    this.loadOutcome = loaded.outcome;
    // Finish anything that completed while the app was closed.
    this.save = settleBuild(loaded.save, now);
    if (loaded.outcome !== 'loaded' || this.save !== loaded.save) this.persist();
  }

  get(): SaveData {
    return this.save;
  }

  update(mutate: (save: SaveData) => SaveData): SaveData {
    const next = mutate(this.save);
    if (next !== this.save) {
      this.save = next;
      this.persist();
    }
    return this.save;
  }

  reset(now = Date.now()): SaveData {
    this.save = defaultSave(now);
    this.persist();
    return this.save;
  }

  private persist(): void {
    try {
      this.storage.setItem(SAVE_KEY, serializeSave(this.save));
    } catch {
      // Storage full or unavailable; keep playing with the in-memory copy.
    }
  }
}

export const saveStore = new SaveStore(pickStorage(), Date.now());
