import assert from 'node:assert/strict';
import test from 'node:test';
import { createChallengePhotoOwnedStore } from '../src/lib/challenge-photo-owned-store';

const fresh = 'file:///cache/ImagePicker/fresh.jpg';
const unrelated = 'file:///cache/ImagePicker/unrelated.jpg';
const userPhoto = 'file:///cache/user.jpg';

function fixture() {
  let manifest: string | null = null;
  const photos = new Set([fresh, unrelated, userPhoto]);
  const failing = new Set<string>();
  const adapter = {
    read: () => manifest,
    write: (value: string) => { manifest = value; },
    listOwned: () => [...photos].filter(uri => uri.startsWith('file:///cache/freed-challenge-photos-v1/')),
    copy: (source: string, destination: string) => {
      assert.ok(photos.has(source));
      photos.add(destination);
    },
    remove: (uri: string) => {
      if (failing.has(uri)) throw Error('locked');
      photos.delete(uri);
    }
  };
  const create = () => createChallengePhotoOwnedStore('file:///cache/', adapter);
  return { store: create(), restart: create, photos, failing, manifest: () => manifest };
}

test('only registered fresh originals and owned namespace orphans are swept', async () => {
  const state = fixture();
  const owned = await state.store.adopt(fresh);
  const orphan = 'file:///cache/freed-challenge-photos-v1/orphan.jpg';
  state.photos.add(orphan);

  state.store.cleanup();
  assert.ok(state.photos.has(owned), 'live capture protected');
  assert.ok(!state.photos.has(orphan));
  await state.store.release(owned);
  assert.deepEqual([...state.photos].sort(), [unrelated, userPhoto]);
});

test('failed deletion remains manifest-backed and retries on cleanup', async () => {
  const state = fixture();
  state.failing.add(fresh);
  const owned = await state.store.adopt(fresh);
  state.failing.add(owned);

  await assert.rejects(state.store.release(owned));
  assert.ok(state.manifest()?.includes(owned));
  assert.equal(state.store.cleanup().remaining, 2);
  state.failing.clear();
  assert.equal(state.store.cleanup().remaining, 0);
  assert.ok(!state.photos.has(owned));
  assert.ok(state.photos.has(unrelated));
});

test('adoption cannot register external, escaped or unowned paths', async () => {
  const state = fixture();
  const rejected = [userPhoto, 'content://camera/photo', 'file:///cache/ImagePicker/../user.jpg', 'file:///cache/ImagePicker/sub/a.jpg'];
  for (const uri of rejected) await assert.rejects(state.store.adopt(uri));
  assert.equal(state.manifest(), null);
});

test('restart recovers registered deletion failures without touching unrelated picker images', async () => {
  const state = fixture();
  state.failing.add(fresh);
  const owned = await state.store.adopt(fresh);
  state.failing.add(owned);
  await assert.rejects(state.store.release(owned));

  const restarted = state.restart();
  assert.equal(restarted.cleanup().remaining, 2);
  state.failing.clear();
  assert.equal(restarted.cleanup().remaining, 0);
  assert.deepEqual([...state.photos].sort(), [unrelated, userPhoto]);
});

test('manifest write failure still deletes the proven fresh original before adoption rejects', async () => {
  const photos = new Set([fresh, unrelated]);
  const store = createChallengePhotoOwnedStore('file:///cache/', {
    read: () => null,
    write: () => { throw Error('storage unavailable'); },
    listOwned: () => [],
    copy: () => { throw Error('copy must never begin without manifest'); },
    remove: uri => { photos.delete(uri); }
  });

  await assert.rejects(store.adopt(fresh));
  assert.deepEqual([...photos], [unrelated]);
});

test('oversized legacy ownership is retained and all unattempted backlog is counted', () => {
  const originals = Array.from({ length: 140 }, (_, index) => `file:///cache/ImagePicker/legacy-${index}.jpg`);
  let manifest = JSON.stringify(originals);
  const photos = new Set(originals);
  let denied = true;
  const store = createChallengePhotoOwnedStore('file:///cache/', {
    read: () => manifest,
    write: value => { manifest = value; },
    listOwned: () => [],
    copy: () => { throw Error('no new copy admitted'); },
    remove: uri => { if (denied) throw Error('locked'); photos.delete(uri); }
  });
  assert.equal(store.cleanup().attempted, 128);
  assert.equal(store.cleanup().remaining, 140, 'the twelve unattempted originals are still unresolved');
  assert.equal(JSON.parse(manifest).length, 140, 'legacy ownership is never truncated');
  assert.equal(store.prepareForCapture(), false);
  denied = false;
  assert.equal(store.cleanup().remaining, 12);
  assert.equal(store.prepareForCapture(), true, 'recovered storage with two free ownership slots permits capture');
  assert.equal(JSON.parse(manifest).length, 12);
});

test('full ownership rejects new registration without growing or dropping retained metadata', async () => {
  const originals = Array.from({ length: 128 }, (_, index) => `file:///cache/ImagePicker/full-${index}.jpg`);
  let manifest = JSON.stringify(originals);
  const fresh = 'file:///cache/ImagePicker/new.jpg';
  const store = createChallengePhotoOwnedStore('file:///cache/', {
    read: () => manifest,
    write: value => { manifest = value; },
    listOwned: () => [],
    copy: () => { throw Error('no copy at full capacity'); },
    remove: () => { throw Error('locked'); }
  });
  for (let index = 0; index < 20; index++) {
    await assert.rejects(store.adopt(fresh));
    assert.throws(() => store.trackFreshOriginalForCleanup(fresh));
  }
  assert.equal(store.prepareForCapture(), false);
  assert.equal(store.cleanup().remaining, 128);
  assert.deepEqual(JSON.parse(manifest), originals);
});

test('persistent write and deletion failure caps newly retained in-process ownership', async () => {
  const store = createChallengePhotoOwnedStore('file:///cache/', {
    read: () => null,
    write: () => { throw Error('storage unavailable'); },
    listOwned: () => [],
    copy: () => { throw Error('copy must not start without metadata'); },
    remove: () => { throw Error('locked'); }
  });
  for (let index = 0; index < 100; index++) {
    await assert.rejects(store.adopt(`file:///cache/ImagePicker/returned-${index}.jpg`));
  }
  assert.equal(store.cleanup().attempted, 128);
  assert.equal(store.cleanup().remaining, 128, 'the store retains at most 128 original/destination entries after failed writes');
  assert.equal(store.prepareForCapture(), false, 'actual admission cannot keep producing originals under this failure');
});
