import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readConfirmedAccountCleanupReceipt } from '../src/lib/account-cleanup-metadata';
import { saveAccountDeletionReceipt, type AccountDeletionReceipt } from '../src/lib/account-deletion-receipt';
const a='metadata-a',b='metadata-b',time='2026-10-07T12:00:00.000Z';
const receipt:AccountDeletionReceipt={version:1,ownerUid:a,eventId:'confirmed',requestedAt:time,cloud:'completed',local:'failed'};
const auth=(owner:string|null)=>({status:'ready' as const,signedIn:!!owner,anonymous:false,ownerUid:owner,email:null});
test('confirmed cleanup metadata reads only receipt/pointer keys and never supplies private owner data or another owner receipt',()=>{
 const values=new Map<string,string>(),reads:string[]=[],storage={getItem:(k:string)=>{reads.push(k);assert.ok(!k.startsWith('freed.recovery.')&&!k.startsWith('freed.journal.'),k);return values.get(k)??null;},setItem:(k:string,v:string)=>{values.set(k,v);}};saveAccountDeletionReceipt(storage,receipt);values.set('freed.account.deletion.latest.v1',a);
 assert.deepEqual(readConfirmedAccountCleanupReceipt(storage,auth(a),a),receipt);assert.deepEqual(readConfirmedAccountCleanupReceipt(storage,auth(null),null),receipt);
 assert.equal(readConfirmedAccountCleanupReceipt(storage,auth(b),b,receipt),null);assert.equal(readConfirmedAccountCleanupReceipt(storage,auth(a),b,receipt),null);assert.equal(readConfirmedAccountCleanupReceipt(storage,{...auth(null),status:'hydrating'},null,receipt),null);
 assert.ok(reads.every(k=>k==='freed.account.deletion.latest.v1'||k.startsWith('freed.account.deletion.receipt.v1.')));
});
test('cached confirmed metadata survives read failure only for an eligible same owner or generic Auth-null state',()=>{
 const storage={getItem:(_k:string):string|null=>{throw new Error('read failed');},setItem:()=>{throw new Error('must not write metadata');}};
 assert.deepEqual(readConfirmedAccountCleanupReceipt(storage,auth(a),a,receipt),receipt);assert.deepEqual(readConfirmedAccountCleanupReceipt(storage,auth(null),null,receipt),receipt);
 assert.equal(readConfirmedAccountCleanupReceipt(storage,auth(b),b,receipt),null);assert.equal(readConfirmedAccountCleanupReceipt(storage,{...auth(a),ownerUid:b},a,receipt),null);
});
test('processing receipt never becomes confirmed cleanup metadata even when a stale completed cache exists',()=>{
 const values=new Map<string,string>(),storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);}};saveAccountDeletionReceipt(storage,{...receipt,cloud:'processing',local:'pending'});
 assert.equal(readConfirmedAccountCleanupReceipt(storage,auth(a),a,receipt),null);
});
