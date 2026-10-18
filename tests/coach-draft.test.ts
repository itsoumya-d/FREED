import assert from 'node:assert/strict';
import test from 'node:test';
import { saveRecoveryDraft, loadRecoveryDraft, purgeRecoveryDrafts } from '../src/lib/recovery-drafts';
function store(){const values=new Map<string,string>();return{values,getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);},removeItem:(k:string)=>{values.delete(k);}};}
test('private coach draft retains exact text and its owning account through restart',()=>{
 const storage=store(),words='  My unfinished thought\n私の言葉  ';
 (saveRecoveryDraft as any)(storage,'coach',{text:words,ownerUid:'owner-a'});
 assert.deepEqual((loadRecoveryDraft as any)(storage,'coach'),{text:words,ownerUid:'owner-a'});
});
test('invalid or oversized coach draft cannot enter a future send and explicit deletion removes it',()=>{
 const storage=store();
 assert.throws(()=>(saveRecoveryDraft as any)(storage,'coach',{text:'x'.repeat(4001),ownerUid:'owner-a'}));
 (saveRecoveryDraft as any)(storage,'coach',{text:'Private words',ownerUid:'owner-a'});
 purgeRecoveryDrafts(storage);assert.equal(storage.values.size,0);
});
