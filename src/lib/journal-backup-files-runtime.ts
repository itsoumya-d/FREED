export function getJournalBackupFiles() { return { read: async (_current: () => boolean): Promise<string | null> => { throw new Error('Backup files are available in the iPhone and Android app.'); },
  share: async (_serialized: string, _current: () => boolean): Promise<void> => { throw new Error('Backup files are available in the iPhone and Android app.'); } }; }
