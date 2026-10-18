const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');const {spawnSync}=require('node:child_process');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'freed-step-adapter-'));
try{const source=path.join(directory,'Observer.swift');fs.writeFileSync(source,fs.readFileSync('modules/freed-protection/ios/FreedChallengeStepObserver.swift','utf8').replaceAll('#if canImport(CoreMotion) && os(iOS)','#if true').replace('import CoreMotion',''));
 const binary=path.join(directory,'cases');for(const [command,args] of [['xcrun',['swiftc','-parse-as-library','-swift-version','5',source,'modules/freed-protection/tests/ChallengeStepObserverCases.swift','-o',binary]],[binary,[]]]){const r=spawnSync(command,args,{encoding:'utf8',timeout:60000});process.stdout.write(r.stdout+r.stderr);assert.equal(r.status,0,command+' failed');}
}finally{fs.rmSync(directory,{recursive:true,force:true});}
