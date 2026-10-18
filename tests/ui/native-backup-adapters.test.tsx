import { getJournalBackupFiles } from '@/lib/journal-backup-files-runtime.native';
import { getAutomaticBackupRuntime } from '@/lib/automatic-backup-runtime.native';
import { createDefaultRecoveryState } from '@/lib/recovery-state';
let mockUid:string|null='adapter-a';
const mockFiles=new Map<string,string>(),mockEvents:string[]=[];
let mockPick:any={canceled:false,assets:[{uri:'file://chosen',size:18}]},mockShareAvailable=true;
const mockSecrets=new Map<string,string>();
const mockUpload=jest.fn(async()=>({ok:true,provider:'custom',status:'ok',action:'upload',syncedAt:'2026-10-07T12:00:00.000Z'}));
const mockEncrypt=jest.fn(async()=> 'encrypted-native-payload');
jest.mock('@react-native-firebase/app',()=>({getApp:()=>({})}));
jest.mock('@react-native-firebase/auth',()=>({getAuth:()=>({currentUser:mockUid?{uid:mockUid,isAnonymous:false}:null})}));
jest.mock('@/lib/firebase-native',()=>({getFirebaseNativeAuthAdapter:()=>({getCurrentIdToken:async()=> 'test-auth-boundary'})}));
jest.mock('@/lib/recovery-backup-client-sync',()=>({uploadSerializedEncryptedRecoveryBackup:(...args:any[])=>mockUpload(...args)}));
jest.mock('@/lib/recovery-backup',()=>({...jest.requireActual('@/lib/recovery-backup'),createEncryptedRecoveryBackup:(...args:any[])=>mockEncrypt(...args)}));
jest.mock('expo-crypto',()=>({randomUUID:()=> 'unique-file',CryptoDigestAlgorithm:{SHA256:'sha256'},CryptoEncoding:{HEX:'hex'},digestStringAsync:async(_algorithm:any,text:string)=>text}));
jest.mock('expo-document-picker',()=>({getDocumentAsync:jest.fn(async()=>mockPick)}));
jest.mock('expo-sharing',()=>({isAvailableAsync:async()=>mockShareAvailable,shareAsync:async()=>{mockEvents.push('native-share');}}));
jest.mock('expo-file-system',()=>({Paths:{cache:'file://cache'},File:class {
 uri:string;constructor(...parts:any[]){this.uri=parts.join('/');}get exists(){return mockFiles.has(this.uri);}get size(){mockEvents.push('native-stat');return mockFiles.get(this.uri)?.length??0;}
 text=async()=>{mockEvents.push('native-read');return mockFiles.get(this.uri)!;};create=()=>{mockFiles.set(this.uri,'');};write=(text:string)=>{mockEvents.push('native-write');mockFiles.set(this.uri,text);};delete=()=>{mockEvents.push('native-delete');mockFiles.delete(this.uri);};
}}));
jest.mock('expo-secure-store',()=>({WHEN_UNLOCKED_THIS_DEVICE_ONLY:7,isAvailableAsync:async()=>true,getItemAsync:async(k:string)=>mockSecrets.get(k)??null,setItemAsync:async(k:string,v:string)=>{mockSecrets.set(k,v);},deleteItemAsync:async(k:string)=>{mockSecrets.delete(k);}}));
beforeEach(()=>{mockUid='adapter-a';mockFiles.clear();mockEvents.length=0;mockPick={canceled:false,assets:[{uri:'file://chosen',size:18}]};mockFiles.set('file://chosen','{"encrypted":true}');mockShareAvailable=true;});
test('actual installed native adapter uses copied picker file/stat then shares and removes encrypted temporary export',async()=>{
 const files=getJournalBackupFiles();expect(await files.read(()=>true)).toBe('{"encrypted":true}');expect(mockEvents).toEqual(['native-stat','native-read']);mockEvents.length=0;
 await files.share('ciphertext',()=>true);expect(mockEvents).toEqual(['native-write','native-share','native-delete']);expect([...mockFiles.keys()]).toEqual(['file://chosen']);
 mockPick={canceled:true,assets:null};mockEvents.length=0;expect(await files.read(()=>true)).toBeNull();expect(mockEvents).toEqual([]);
});
test('actual native unavailable sharing removes the temporary file and rejects without a success',async()=>{mockShareAvailable=false;await expect(getJournalBackupFiles().share('ciphertext',()=>true)).rejects.toThrow('unavailable');expect(mockEvents).toEqual(['native-write','native-delete']);});
test('actual native automatic runtime refuses captured owner mismatch after async loading and never transfers a secure key',async()=>{
 const runtime=getAutomaticBackupRuntime();await runtime.enable('owner-a passphrase','adapter-a');const aKeys=[...mockSecrets.keys()];
 mockUid='adapter-b';await expect(runtime.enable('wrong owner secret','adapter-a')).rejects.toThrow('original account');
 const result=await runtime.sync({...createDefaultRecoveryState(),automaticBackupEnabled:true},undefined,'adapter-a');expect(result.status).toBe('cancelled');expect(mockUpload).not.toHaveBeenCalled();expect(mockEncrypt).not.toHaveBeenCalled();
 await runtime.enable('owner-b passphrase','adapter-b');expect(mockSecrets.size).toBe(2);await runtime.disable('adapter-a');expect(mockSecrets.has(aKeys[0])).toBe(false);expect([...mockSecrets.values()]).toEqual(['owner-b passphrase']);
});
