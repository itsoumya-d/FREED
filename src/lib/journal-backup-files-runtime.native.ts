import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { createJournalBackupFileAdapter } from './journal-backup-files';
import { translateSource } from '@/i18n/runtime';
const adapter = createJournalBackupFileAdapter({
  pick: async () => { const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'application/octet-stream', 'text/plain'], copyToCacheDirectory: true, multiple: false });
    return result.canceled ? { canceled: true } : { canceled: false, uri: result.assets[0].uri, size: result.assets[0].size }; },
  size: async uri => { const file = new File(uri); if (!file.exists) throw new Error('The selected backup file could not be read.'); return file.size; },
  read: uri => new File(uri).text(),
  write: async serialized => { const file = new File(Paths.cache, `FREED-backup-${Crypto.randomUUID()}.json`); file.create({ overwrite: false });
    try { file.write(serialized); return file.uri; } catch (error) { try { file.delete(); } catch { /* Failed write is reported, never a share success. */ } throw error; } },
  share: async uri => { if (!await Sharing.isAvailableAsync()) throw new Error('File sharing is unavailable. Try again.');
    await Sharing.shareAsync(uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: translateSource('Save encrypted FREED backup') }); },
  remove: async uri => { const file = new File(uri); if (file.exists) file.delete(); }
});
export function getJournalBackupFiles() { return adapter; }
