import { JOURNAL_ARCHIVE_MAX_BYTES, journalUtf8Bytes } from './journal-archive';
export type JournalBackupFileIO = {
  pick(): Promise<{ canceled: true } | { canceled: false; uri: string; size?: number }>;
  size(uri: string): Promise<number>; read(uri: string): Promise<string>;
  write(serialized: string): Promise<string>; share(uri: string): Promise<void>; remove(uri: string): Promise<void>;
};
const bound = (bytes: number) => { if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > JOURNAL_ARCHIVE_MAX_BYTES) throw new Error('Backup file must be readable and no larger than 64 MiB.'); };
export function createJournalBackupFileAdapter(io: JournalBackupFileIO) {
  return {
    async read(isCurrent: () => boolean): Promise<string | null> {
      const picked = await io.pick(); if (picked.canceled) return null;
      if (!isCurrent()) throw new Error('The backup owner changed. File import was stopped.');
      // Treat picker metadata as a hint only. Stat the copied file before allocating its text.
      if (picked.size !== undefined) bound(picked.size);
      bound(await io.size(picked.uri));
      if (!isCurrent()) throw new Error('The backup owner changed. File import was stopped.');
      const text = await io.read(picked.uri); bound(journalUtf8Bytes(text));
      if (!isCurrent()) throw new Error('The backup owner changed. File import was stopped.');
      return text;
    },
    async share(serialized: string, isCurrent: () => boolean): Promise<void> {
      bound(journalUtf8Bytes(serialized)); if (!isCurrent()) throw new Error('The backup owner changed. Export was stopped.');
      let uri: string | null = null;
      try { uri = await io.write(serialized); if (!isCurrent()) throw new Error('The backup owner changed. Export was stopped.');
        await io.share(uri);
      } finally { if (uri) await io.remove(uri); }
    }
  };
}
