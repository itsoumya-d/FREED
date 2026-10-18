import { act, renderHook } from '@testing-library/react-native';
import { useRecoveryDraft } from '@/hooks/use-recovery-draft';
import { RECOVERY_DRAFT_STORAGE_KEYS, saveRecoveryDraft } from '@/lib/recovery-drafts';
jest.mock('expo-sqlite/localStorage/install',()=>({}));

function fixture(){
 const values=new Map<string,string>(),writes:string[]=[],reads:string[]=[],fail={read:false,write:false};
 let onRead:(()=>void)|undefined;
 const storage={getItem:(key:string)=>{reads.push(key);if(fail.read)throw Error('read unavailable');const callback=onRead;onRead=undefined;callback?.();return values.get(key)??null;},
  setItem:(key:string,value:string)=>{if(fail.write)throw Error('write unavailable');writes.push(value);values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};
 saveRecoveryDraft(storage,'coach',{text:'Retained disk words',ownerUid:'owner-a'});writes.length=0;
 return {storage,values,writes,reads,fail,whenReading:(callback:()=>void)=>{onRead=callback;}};
}

test('load retry restores the same owner draft with zero writes and keeps a repeated read failure recoverable',()=>{
 const f=fixture(),before=f.values.get(RECOVERY_DRAFT_STORAGE_KEYS.coach);f.fail.read=true;
 const screen=renderHook(()=>useRecoveryDraft('coach',{text:'',ownerUid:'owner-a'},{ownerId:'owner-a',storage:f.storage}));
 act(()=>{screen.result.current.retryStorage();});expect(screen.result.current.error).toMatch(/could not be loaded/);
 f.fail.read=false;act(()=>{screen.result.current.retryStorage();});
 expect(screen.result.current.value).toEqual({text:'Retained disk words',ownerUid:'owner-a'});expect(screen.result.current.restored).toBe(true);expect(screen.result.current.error).toBeNull();
 expect(f.writes).toEqual([]);expect(f.values.get(RECOVERY_DRAFT_STORAGE_KEYS.coach)).toBe(before);
});

test('a retained load-retry callback repairs the latest edited value after a write failure instead of applying initial defaults',()=>{
 const f=fixture();f.fail.read=true;
 const screen=renderHook(()=>useRecoveryDraft('coach',{text:'',ownerUid:'owner-a'},{ownerId:'owner-a',storage:f.storage}));
 const retry=screen.result.current.retryStorage;f.fail.write=true;
 act(()=>{screen.result.current.update({text:'Newer private input',ownerUid:'owner-a'});});
 f.fail.read=false;f.fail.write=false;act(()=>{retry();});
 expect(screen.result.current.value.text).toBe('Newer private input');expect(screen.result.current.error).toBeNull();
 expect(JSON.parse(f.values.get(RECOVERY_DRAFT_STORAGE_KEYS.coach)!).value.text).toBe('Newer private input');
});

test('a read retry cannot overwrite a newer edit occurring during the storage read',()=>{
 const f=fixture();f.fail.read=true;
 const screen=renderHook(()=>useRecoveryDraft('coach',{text:'',ownerUid:'owner-a'},{ownerId:'owner-a',storage:f.storage}));
 f.fail.read=false;f.fail.write=true;
 f.whenReading(()=>{screen.result.current.update({text:'Newer revision during retry',ownerUid:'owner-a'});});
 act(()=>{screen.result.current.retryStorage();});
 expect(screen.result.current.value.text).toBe('Newer revision during retry');expect(screen.result.current.error).toMatch(/could not be kept/);expect(f.writes).toEqual([]);
});

test('a retained load-retry callback becomes a no-op after a newer edit has already persisted',()=>{
 const f=fixture();f.fail.read=true;
 const screen=renderHook(()=>useRecoveryDraft('coach',{text:'',ownerUid:'owner-a'},{ownerId:'owner-a',storage:f.storage}));
 const retry=screen.result.current.retryStorage;f.fail.read=false;
 act(()=>{screen.result.current.update({text:'Newer already persisted words',ownerUid:'owner-a'});});
 const before=f.reads.length;act(()=>{retry();});
 expect(screen.result.current.value.text).toBe('Newer already persisted words');expect(screen.result.current.error).toBeNull();
 expect(f.reads).toHaveLength(before);expect(f.writes).toHaveLength(1);expect(JSON.parse(f.values.get(RECOVERY_DRAFT_STORAGE_KEYS.coach)!).value.text).toBe('Newer already persisted words');
});

test('owner and ABA session changes reject stale load retries, while a current same-owner retry can recover',()=>{
 const f=fixture();f.fail.read=true;
 const screen=renderHook(({owner})=>useRecoveryDraft('coach',{text:'',ownerUid:owner},{ownerId:owner,storage:f.storage}),{initialProps:{owner:'owner-a'}});
 const stale=screen.result.current.retryStorage;
 screen.rerender({owner:'owner-b'});screen.rerender({owner:'owner-a'});f.fail.read=false;
 const before=f.reads.length;act(()=>{stale();});expect(f.reads).toHaveLength(before);expect(screen.result.current.error).toMatch(/could not be loaded/);
 act(()=>{screen.result.current.retryStorage();});expect(screen.result.current.value.text).toBe('Retained disk words');
 expect(f.writes).toEqual([]);
});

test('unmount rejects a retained load retry before any storage operation',()=>{
 const f=fixture();f.fail.read=true;
 const screen=renderHook(()=>useRecoveryDraft('coach',{text:'',ownerUid:'owner-a'},{ownerId:'owner-a',storage:f.storage}));
 const stale=screen.result.current.retryStorage;screen.unmount();f.fail.read=false;
 const before=f.reads.length;act(()=>{stale();});expect(f.reads).toHaveLength(before);expect(f.writes).toEqual([]);
});
