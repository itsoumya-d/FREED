import { requireOptionalNativeModule } from 'expo';
import type * as ImagePickerTypes from 'expo-image-picker';
import { createJournalMediaStore, createJournalFileOwnership, type JournalPhotoIO } from './journal-media';
import { assertJournalOwner, isJournalFileName, journalOwnerComponent } from './journal-repository';
import { canonicalJournalFilePath, isJournalUriInside } from './journal-file-paths';
const nativeFileOwnership = createJournalFileOwnership();

export function createJournalMediaRuntime() {
  // These modules are needed only for file/photo operations, never for opening a text journal.
  const fileSystem = () => require('expo-file-system/legacy') as typeof import('expo-file-system/legacy');
  const rootPath = () => { const directory = fileSystem().documentDirectory; return directory ? `${directory}freed-journal/` : null; };
  const ownerDirectory = (ownerId: string) => { assertJournalOwner(ownerId); const root = rootPath(); if (!root || !canonicalJournalFilePath(root)) throw new Error('journal-photo-storage'); return `${root}${journalOwnerComponent(ownerId)}/`; };
  const isManaged = (uri: string) => {
    const root = rootPath(); if (!root || !isJournalUriInside(uri, root)) return false;
    const path = canonicalJournalFilePath(uri)!, prefix = canonicalJournalFilePath(root)!;
    return /^owner_[A-Za-z0-9_-]{1,171}\/(?:photo|thumb)-[A-Za-z0-9_-]{1,128}\.jpg$/.test(path.slice(prefix.length));
  };
  const io: JournalPhotoIO = {
    async pick(source) {
      const ImagePicker = await import('expo-image-picker');
      if (source === 'camera') { const permission = await ImagePicker.requestCameraPermissionsAsync(); if (!permission.granted) return { status: 'denied' }; }
      // The OS photo picker can supply selected items without broad library access.
      const permission = source === 'library' ? await ImagePicker.getMediaLibraryPermissionsAsync() : null;
      const options: ImagePickerTypes.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: false, base64: false, exif: false, quality: 1, allowsMultipleSelection: false };
      const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled || !result.assets?.length) return { status: 'cancelled' };
      const asset = result.assets[0]; return { status: 'selected', asset: { uri: asset.uri, width: asset.width, height: asset.height }, limited: permission?.accessPrivileges === 'limited' };
    },
    async reencode(asset, edge, quality) {
      if (asset.uri.startsWith('file:') && !canonicalJournalFilePath(asset.uri)) throw new Error('journal-photo-invalid-source');
      // A picker source is a selected library item or cache file, never another owner's private journal file.
      if (isJournalUriInside(asset.uri, rootPath())) throw new Error('journal-photo-private-source');
      if (!requireOptionalNativeModule('ExpoImageManipulator')) throw new Error('journal-photo-optimization-unavailable');
      const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');
      const longest = Math.max(asset.width, asset.height); const scale = Math.min(1, edge / longest);
      const result = await manipulateAsync(asset.uri, [{ resize: { width: Math.max(1, Math.round(asset.width * scale)), height: Math.max(1, Math.round(asset.height * scale)) } }], { compress: quality, format: SaveFormat.JPEG, base64: false });
      // Expo encodes the decoded bitmap/UIImage into a fresh JPEG; it does not copy EXIF.
      return { uri: result.uri, width: result.width, height: result.height, metadataStripped: true };
    },
    async size(uri) { const fs = fileSystem(); if (!isManaged(uri) && !isJournalUriInside(uri, fs.cacheDirectory)) throw new Error('journal-photo-invalid'); const value = await fs.getInfoAsync(uri); if (!value.exists || value.isDirectory || !Number.isFinite(value.size)) throw new Error('journal-photo-unavailable'); return value.size; },
    managedUri(ownerId, name) { if (!isJournalFileName(name)) throw new Error('journal-photo-invalid'); return `${ownerDirectory(ownerId)}${name}`; },
    async exists(uri) { if (!isManaged(uri)) throw new Error('journal-photo-invalid'); return (await fileSystem().getInfoAsync(uri)).exists; },
    async copy(from, to) { const FileSystem = fileSystem(); if (!isManaged(to) || !isJournalUriInside(from, FileSystem.cacheDirectory)) throw new Error('journal-photo-invalid'); const parent = to.slice(0, to.lastIndexOf('/') + 1); await FileSystem.makeDirectoryAsync(parent, { intermediates: true }); const existing = await FileSystem.getInfoAsync(to); if (existing.exists) throw new Error('journal-photo-file-conflict'); await FileSystem.copyAsync({ from, to }); },
    async remove(uri) {
      const FileSystem = fileSystem(); if (!isManaged(uri)) throw new Error('journal-photo-invalid');
      await FileSystem.deleteAsync(uri, { idempotent: true });
    },
    async removeTemporary(uri) { const FileSystem = fileSystem(); if (isJournalUriInside(uri, FileSystem.cacheDirectory)) await FileSystem.deleteAsync(uri, { idempotent: true }); },
    async list(ownerId) { const FileSystem = fileSystem(); const directory = ownerDirectory(ownerId); if (!(await FileSystem.getInfoAsync(directory)).exists) return []; return FileSystem.readDirectoryAsync(directory); },
    readBase64: uri => { const FileSystem = fileSystem(); if (!isManaged(uri)) throw new Error('journal-photo-invalid'); return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 }); },
    async writeTemporaryBase64(base64) { const FileSystem = fileSystem(), Crypto = await import('expo-crypto'); if (!FileSystem.cacheDirectory) throw new Error('journal-photo-storage'); const uri = `${FileSystem.cacheDirectory}freed-journal-restore-${Crypto.randomUUID()}.jpg`; try { await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 }); return uri; } catch (error) { await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {}); throw error; } }
  };
  return createJournalMediaStore({ io, ownership: nativeFileOwnership, newId: () => (require('expo-crypto') as typeof import('expo-crypto')).randomUUID() });
}
