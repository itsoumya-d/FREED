import type { JournalMediaStore } from './journal-media';

/** Native private filesystem is required. Browser sessions keep text journals. */
export function createJournalMediaRuntime(): JournalMediaStore | null { return null; }
