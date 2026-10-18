const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');const {spawnSync}=require('node:child_process');
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'freed-native-camera-'));
try{
 const selected=process.argv.find(v=>v.startsWith('--case='))?.split('=')[1],scenarios=selected?[selected]:['permission-cancel','permission-owner-change','permission-task-cancel','permission-newer'];
 const nativeSource=process.argv.find(v=>v.startsWith('--source='))?.slice('--source='.length)||'modules/freed-protection/ios/FreedChallengeNativeCamera.swift';
 const native=path.join(scratch,'NativeCamera.swift');fs.writeFileSync(native,fs.readFileSync(nativeSource,'utf8').replace('#if canImport(UIKit) && os(iOS)','#if true').replace('import UIKit','').replace('import AVFoundation',''));
 const binary=path.join(scratch,'cases'),results=[];
 for(const [command,args] of [['xcrun',['swiftc','-parse-as-library','-swift-version','5',native,'modules/freed-protection/tests/ChallengeNativeCameraCases.swift','-o',binary]],...scenarios.map(c=>[binary,[c]])]){
  const r=spawnSync(command,args,{encoding:'utf8',timeout:60000});results.push({command:[command,...args],exitCode:r.status,signal:r.signal,stdout:r.stdout,stderr:r.stderr});process.stdout.write(r.stdout+r.stderr);
  if(r.status!==0){const out=process.argv.indexOf('--receipt');if(out>=0){fs.mkdirSync(path.dirname(process.argv[out+1]),{recursive:true});fs.writeFileSync(process.argv[out+1],JSON.stringify({physicalProof:false,results},null,2)+'\n');}assert.equal(r.status,0,command+' failed');}
 }
 const out=process.argv.indexOf('--receipt');if(out>=0){const dir=path.dirname(process.argv[out+1]);fs.mkdirSync(dir,{recursive:true});const savedBinary=path.join(dir,'native-camera-cases'),savedNative=path.join(dir,'NativeCamera.snapshot.swift');fs.copyFileSync(binary,savedBinary);fs.copyFileSync(native,savedNative);const hash=p=>({path:p,sha256:crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')});fs.writeFileSync(process.argv[out+1],JSON.stringify({physicalProof:false,environment:{platform:process.platform,osRelease:os.release(),architecture:process.arch},scope:'Actual native camera actor with local UIKit/AV permission boundary; no real camera, iOS signed binary or physical UI',binary:hash(savedBinary),sources:[nativeSource,'modules/freed-protection/tests/ChallengeNativeCameraCases.swift',__filename,savedNative].map(hash),results},null,2)+'\n');}
}finally{fs.rmSync(scratch,{recursive:true,force:true});}
