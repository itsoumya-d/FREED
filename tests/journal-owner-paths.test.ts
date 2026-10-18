import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as Journal from '../src/lib/journal-repository';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import type { JournalMediaStore } from '../src/lib/journal-media';
import { canonicalJournalFilePath, isJournalUriInside } from '../src/lib/journal-file-paths';

test('owner namespaces reject dot segments, separators, encoded/double-encoded separators and controls', () => {
  for (const owner of ['.', '..', 'alice/../bob', 'alice\\bob', '%2e%2e', 'alice%2F..%2Fbob', 'alice%252Fbob', 'alice\0bob', ' alice', 'alice ']) assert.throws(() => Journal.assertJournalOwner(owner), /owner/, owner);
});
test('canonical containment rejects decoded traversal/separator aliases and sibling cache prefixes', () => {
  const root = 'file:///Documents/freed-journal/';
  for (const uri of ['file:///Documents/freed-journal/../other.jpg', 'file:///Documents/freed-journal/%2e%2e/other.jpg', 'file:///Documents/freed-journal/alice%2f../bob/photo-p1.jpg', 'file:///Documents/freed-journal/%252e%252e/other.jpg', 'file:///Documents/freed-journal/alice%5c..%5cbob/other.jpg', 'file:///Documents/freed-journal//owner_alice/photo-p1.jpg']) { assert.equal(canonicalJournalFilePath(uri), null); assert.equal(isJournalUriInside(uri, root), false); }
  assert.equal(isJournalUriInside('file:///Cache-other/other.jpg', 'file:///Cache/'), false);
  assert.equal(isJournalUriInside('file:///Cache/photo%20one.jpg', 'file:///Cache/'), true);
  for (const owner of ['a', 'alice', 'guest:local', 'Z'.repeat(128)]) assert.equal(Journal.journalOwnerComponent(owner), `owner_${Buffer.from(owner).toString('base64url')}`);
});
function nativeSandbox() {
  const esbuild = createRequire(resolve('package.json'))('esbuild') as typeof import('esbuild');
  const built = esbuild.buildSync({ entryPoints: [resolve('src/lib/journal-media-runtime.native.ts')], bundle: true, external: ['expo', 'expo-*'], platform: 'node', format: 'cjs', write: false, logLevel: 'silent' });
  const files = new Map<string, number>(); const removed: string[] = []; let picked = 'file:///Cache/picked.jpg', serial = 0;
  const fs = {
    documentDirectory: 'file:///Documents/', cacheDirectory: 'file:///Cache/', EncodingType: { Base64: 'base64' },
    getInfoAsync: async (uri: string) => ({ exists: files.has(uri), isDirectory: false, size: files.get(uri) ?? 0 }),
    copyAsync: async ({ from, to }: { from: string; to: string }) => { files.set(to, files.get(from)!); },
    makeDirectoryAsync: async () => {}, deleteAsync: async (uri: string) => { removed.push(uri); files.delete(uri); },
    readDirectoryAsync: async (directory: string) => [...files.keys()].filter(uri => uri.startsWith(directory)).map(uri => uri.slice(directory.length)),
    readAsStringAsync: async () => 'AA==', writeAsStringAsync: async () => {}
  };
  const sandbox = { module: { exports: {} }, require(name: string) {
    if (name === 'expo') return { requireOptionalNativeModule: () => ({}) };
    if (name === 'expo-file-system/legacy') return fs;
    if (name === 'expo-crypto') return { randomUUID: () => `p_${++serial}` };
    if (name === 'expo-image-picker') return { requestCameraPermissionsAsync: async () => ({ granted: true }), getMediaLibraryPermissionsAsync: async () => ({ accessPrivileges: 'all' }), launchImageLibraryAsync: async () => ({ canceled: false, assets: [{ uri: picked, width: 400, height: 300 }] }) };
    if (name === 'expo-image-manipulator') return { SaveFormat: { JPEG: 'jpeg' }, manipulateAsync: async () => { const uri = `file:///Cache/encoded-${++serial}.jpg`; files.set(uri, 1024); return { uri, width: 320, height: 240 }; } };
    throw new Error(`unexpected native boundary ${name}`);
  } };
  runInNewContext(built.outputFiles[0].text, sandbox);
  const module = sandbox.module.exports as { createJournalMediaRuntime(): JournalMediaStore };
  return { media: module.createJournalMediaRuntime(), files, removed, pick: (uri: string) => { picked = uri; } };
}
test('native owner paths stay canonical and distinct, and source cleanup cannot erase another owner', async () => {
  const f = nativeSandbox();
  for (const owner of ['..', 'alice/../bob', 'alice%2f..%2fbob']) assert.throws(() => f.media.uri(owner, 'photo-p1.jpg'), /owner/);
  const owners = ['alice', 'bob', 'guest:local-v1', 'firebase:User_123', 'alice.bob', 'alice@bob'];
  const paths = owners.map(owner => f.media.uri(owner, 'photo-p1.jpg')); assert.equal(new Set(paths).size, owners.length);
  for (const path of paths) { assert.match(path, /^file:\/\/\/Documents\/freed-journal\/owner_[A-Za-z0-9_-]+\/photo-p1\.jpg$/); assert.equal(new URL(path).pathname.split('/').length, 5); }
  assert.equal(f.media.uri('alice', 'photo-p1.jpg'), paths[0]);
  const bob = f.media.uri('bob', 'photo-p1.jpg'); f.files.set(bob, 77); f.pick(bob);
  await f.media.pickAndImport('alice', 'library', 0, () => true); assert.equal(f.files.get(bob), 77); assert.ok(!f.removed.includes(bob));
});
