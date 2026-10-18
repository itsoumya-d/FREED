import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getStoredProtectionIntent, storeProtectionIntent, PROTECTION_INTENT_STORAGE_KEY } from '../src/lib/protection-intent-storage';
const disk=()=>{const data=new Map<string,string>();return{getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>data.set(key,value),removeItem:(key:string)=>data.delete(key)}};
test('a settings return after process death restores only the chosen protection feature',()=>{
 const storage=disk();storeProtectionIntent(storage,'websites');assert.equal(getStoredProtectionIntent(storage),'websites');storeProtectionIntent(storage,'apps');assert.equal(getStoredProtectionIntent(storage),'apps');
});
test('legacy, corrupt and unavailable storage retain the legacy both route without granting protection',()=>{
 const storage=disk();assert.equal(getStoredProtectionIntent(storage),'both');storage.setItem(PROTECTION_INTENT_STORAGE_KEY,'on');assert.equal(getStoredProtectionIntent(storage),'both');assert.equal(getStoredProtectionIntent({getItem:()=>{throw Error('disk')}}),'both');
});
