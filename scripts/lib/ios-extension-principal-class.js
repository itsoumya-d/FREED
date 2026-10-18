const fs=require('node:fs');const {spawnSync}=require('node:child_process');

// Read class_ro.name through actual dyld rebases/Objective-C registration data.
// An arbitrary reflected class-name string is insufficient. Swift ABI metadata:
// https://github.com/swiftlang/swift/blob/main/docs/ABI/TypeMetadata.rst
// Resilient superclass stubs: https://github.com/swiftlang/swift/blob/main/docs/ObjCInterop.md
function parseSections(bytes){
 if(bytes.length<32||bytes.readUInt32LE(0)!==0xfeedfacf)throw Error('principal-macho-64-little-endian-required');
 const count=bytes.readUInt32LE(16);if(count>4096)throw Error('principal-macho-load-command-bound');
 const sections=[];let cursor=32;
 const string=(offset)=>bytes.subarray(offset,offset+16).toString('utf8').replace(/\0.*$/s,'');
 for(let i=0;i<count;i++){
  if(cursor+8>bytes.length)throw Error('principal-macho-command-truncated');const cmd=bytes.readUInt32LE(cursor),size=bytes.readUInt32LE(cursor+4);if(size<8||cursor+size>bytes.length)throw Error('principal-macho-command-invalid');
  if(cmd===0x19){const n=bytes.readUInt32LE(cursor+64);if(72+n*80>size)throw Error('principal-macho-sections-invalid');for(let j=0;j<n;j++){const p=cursor+72+j*80;sections.push({name:string(p),segment:string(p+16),address:bytes.readBigUInt64LE(p+32),size:bytes.readBigUInt64LE(p+40),offset:bytes.readUInt32LE(p+48)});}}
  cursor+=size;
 }
 return sections;
}
function swiftObjCName(raw){
 if(!raw.startsWith('_TtC'))return raw;
 let at=4;function part(){const match=/^([1-9][0-9]*)/.exec(raw.slice(at));if(!match)return null;at+=match[1].length;const length=Number(match[1]);if(length>1024||at+length>raw.length)return null;const value=raw.slice(at,at+length);at+=length;return value;}
 const module=part(),name=part();return module&&name&&at===raw.length?`${module}.${name}`:null;
}
function inspectObjectiveCMetadata(bytes,fixupText,principal){
 const sections=parseSections(bytes),fixups=new Map();
 for(const line of fixupText.split('\n')){const m=/^\s*(\S+)\s+(\S+)\s+(0x[0-9a-f]+)\s+rebase\s+(0x[0-9a-f]+)/i.exec(line);if(m)fixups.set(BigInt(m[3]),BigInt(m[4]));}
 const sectionAt=(address)=>sections.find(s=>address>=s.address&&address<s.address+s.size);
 function offset(address,length=8){const s=sectionAt(address);if(!s)throw Error('principal-metadata-address-unmapped');const p=s.offset+Number(address-s.address);if(p<0||p+length>bytes.length)throw Error('principal-metadata-data-truncated');return p;}
 const pointer=(address)=>fixups.get(address) ?? bytes.readBigUInt64LE(offset(address));
 function nameAt(address){const s=sectionAt(address);if(s?.name!=='__objc_classname')return null;const p=offset(address,1),max=Math.min(bytes.length,p+1024,s.offset+Number(s.size)),end=bytes.indexOf(0,p);if(end<p||end>=max)return null;return bytes.subarray(p,end).toString('utf8');}
 function roName(address){try{const p=offset(address,32),flags=bytes.readUInt32LE(p),start=bytes.readUInt32LE(p+4),size=bytes.readUInt32LE(p+8),rawName=nameAt(pointer(address+24n));if(!rawName||start>size||size<8||size>1024*1024)return null;return {address:'0x'+address.toString(16),flags,rawName,runtimeName:swiftObjCName(rawName)};}catch{return null;}}
 const registrations=[],names=[];
 for(const section of sections.filter(s=>['__objc_classlist','__objc_nlclslist','__objc_stublist'].includes(s.name))){
  if(section.size%8n!==0n||section.size>8192n*8n)throw Error('principal-registration-size-invalid');
  for(let delta=0n;delta<section.size;delta+=8n){const address=pointer(section.address+delta);
   if(section.name==='__objc_stublist'){
    // Official Swift stub isa sentinel + metadata initializer in executable text.
    try{if(pointer(address)===1n&&sectionAt(pointer(address+8n))?.name==='__text')registrations.push({kind:'swift-resilient-stub',address:'0x'+address.toString(16),initializer:'0x'+pointer(address+8n).toString(16)});}catch{}
   }else{
    try{const ro=roName(pointer(address+32n)&~7n);if(ro){registrations.push({kind:'objc-classlist',address:'0x'+address.toString(16),runtimeName:ro.runtimeName});names.push({...ro,registration:'objc-classlist'});}}catch{}
   }
  }
 }
 // Non-generic resilient ABI chain: type record -> own descriptor -> own
 // stub info and singleton pattern -> own RO data. An unrelated stub cannot
 // promote another class's orphan pattern. Unsupported ABI forms fail closed.
 // https://github.com/swiftlang/swift/blob/main/include/swift/ABI/Metadata.h
 const registeredStubs=new Map(registrations.filter(r=>r.kind==='swift-resilient-stub').map(r=>[BigInt(r.address),r]));
 const u32=(address)=>bytes.readUInt32LE(offset(address,4));
 const relative=(address)=>{const value=bytes.readInt32LE(offset(address,4));if(value===0)throw Error('principal-null-relative-reference');return address+BigInt(value);};
 function initializerBinds(stub,accessor,descriptor){
  // Known arm64 Swift update thunk: zero request then tail-call its accessor.
  // Also require the accessor's literal descriptor reference, not only a name.
  if(bytes.readUInt32LE(4)!==0x0100000c)return false;
  const pc=BigInt(stub.initializer),move=u32(pc),branch=u32(pc+4n);
  if(![0xd2800000,0x52800000].includes(move)||(branch>>>26)!==5)return false;
  let immediate=branch&0x03ffffff;if(immediate&0x02000000)immediate-=0x04000000;
  if(pc+4n+BigInt(immediate)*4n!==accessor)return false;
  for(let i=0;i<24;i++){
   const at=accessor+BigInt(i)*4n,page=u32(at),add=u32(at+4n);
   if((page&0x9f000000)>>>0!==0x90000000||(add&0xff000000)>>>0!==0x91000000)continue;
   const register=page&31;if((add&31)!==register||((add>>>5)&31)!==register)continue;
   let pages=((page>>>5)&0x7ffff)*4+((page>>>29)&3);if(pages&0x100000)pages-=0x200000;
   const target=(at&~0xfffn)+BigInt(pages)*4096n+BigInt((add>>>10)&0xfff)*((add&0x00400000)?4096n:1n);
   if(target===descriptor)return true;
  }
  return false;
 }
 for(const section of sections.filter(s=>s.name==='__swift5_types')){
  if(section.size%4n!==0n||section.size>8192n*4n)continue;
  for(let delta=0n;delta<section.size;delta+=4n){try{
   const record=section.address+delta;if((u32(record)&3)!==0)continue;const descriptor=relative(record),flags=u32(descriptor),typeFlags=flags>>>16;
   // Class kind16, known non-generic context version0, resilient superclass,
   // singleton metadata initialization and own resilient-stub extra flag.
   if((flags&31)!==16||(flags&0xff80)!==0||(typeFlags&0x2000)===0||(typeFlags&3)!==1||(u32(descriptor+28n)&1)===0)continue;
   let trailing=descriptor+44n+4n;const pattern=relative(trailing+4n);trailing+=12n;
   if(typeFlags&0x8000){const count=u32(trailing+4n);if(count>1024)continue;trailing+=8n+BigInt(count)*8n;}
   if(typeFlags&0x4000){const count=u32(trailing);if(count>1024)continue;trailing+=4n+BigInt(count)*12n;}
   const stubAddress=relative(trailing),stub=registeredStubs.get(stubAddress),accessor=relative(descriptor+12n);
   if(!stub||!initializerBinds(stub,accessor,descriptor))continue;
   const roAddress=relative(pattern+16n),ro=roName(roAddress);
   if(!ro||(ro.flags&0x80)===0||(ro.flags&1)!==0)continue;
   names.push({...ro,registration:'swift-resilient-descriptor',binding:{descriptor:'0x'+descriptor.toString(16),stubInfo:'0x'+trailing.toString(16),stub:stub.address,initializer:stub.initializer,accessor:'0x'+accessor.toString(16),pattern:'0x'+pattern.toString(16)}});
  }catch{/* Unknown/truncated/unbound resilient data cannot authorize a class. */}}
 }
 const unique=Array.from(new Map(names.map(n=>[n.registration+':'+n.address,n])).values()),match=unique.find(n=>n.runtimeName===principal);
 return {available:true,compatible:!!match,reason:match?null:'principal-runtime-class-name-unresolved',principalClass:principal,registrations,registeredClassNames:unique,matchingRegistration:match ?? null};
}
function inspectExtensionPrincipalClass(executablePath,principal){
 try{if(!executablePath||!principal)return {available:false,compatible:false,reason:'principal-runtime-input-missing'};const bytes=fs.readFileSync(executablePath);if(bytes.length>64*1024*1024)throw Error('principal-macho-size-bound');const r=spawnSync('xcrun',['dyld_info','-fixups',executablePath],{encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024});if(r.status!==0)throw Error('principal-dyld-fixups-unavailable');return inspectObjectiveCMetadata(bytes,r.stdout,principal);}catch(error){return {available:false,compatible:false,reason:/^principal-[a-z0-9-]+$/.test(error.message)?error.message:'principal-runtime-inspection-failed',principalClass:principal};}
}
module.exports={inspectExtensionPrincipalClass,inspectObjectiveCMetadata,parseSections,swiftObjCName};
