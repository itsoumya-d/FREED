import {createRequire} from 'node:module';
const requireReal=createRequire(process.cwd()+'/package.json');
export function actualAdapter(platform='ios') {
 const events:string[]=[];let next=0,lastRaw='["A",1]';
 const native:any={setAppGroupActionScope:()=>{events.push('RAW-BIND');return {version:1,operationId:'11111111-1111-4111-8111-111111111111',supported:true,accepted:true,bindingCurrent:true,ownerVerified:true,stage:'complete',reason:null,generation:7,scopeEpoch:3,errorCode:null,errorDomain:null};},
 FreedAccountBindingSession:class { id=++next; release(){events.push('release:'+this.id);}},
 prepareAccountBindingV2:(_session:any,raw:string,transition:string,sequence:number)=>{events.push('prepare:'+raw);lastRaw=raw;return {ticket:'11111111-1111-4111-8111-111111111111',admissionRevision:0};},
 commitAccountBindingV2:()=>{events.push('commit');return {version:2,accepted:true,bindingHandle:'22222222-2222-4222-8222-222222222222',actionScope:JSON.stringify([...JSON.parse(lastRaw),'22222222-2222-4222-8222-222222222222']),generation:7,scopeEpoch:3,admissionRevision:0};},
 getAppGroups:()=>{events.push('read');return null;},getPendingIntervention:(scope:any)=>{events.push('pending:'+scope);return null;},clearPendingIntervention:()=>{events.push('clear');return true;}};
 const code=requireReal('esbuild').buildSync({...(process.env.TASK86_INDEX_SOURCE?{stdin:{contents:requireReal('node:fs').readFileSync(process.env.TASK86_INDEX_SOURCE,'utf8'),loader:'ts',resolveDir:process.cwd()+'/modules/freed-protection/src'}}:{entryPoints:['modules/freed-protection/src/index.ts']}),bundle:true,external:['expo-modules-core','react-native'],platform:'node',format:'cjs',write:false}).outputFiles[0].text;
 const m={exports:{} as any};new Function('require','module','exports',code)((name:string)=>name==='expo-modules-core'?{requireNativeModule:()=>native}:name==='react-native'?{Platform:{OS:platform}}:requireReal(name),m,m.exports);
 return {api:m.exports,native,events};
}
