const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');const {spawnSync}=require('node:child_process');
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'freed-photo-evaluator-'));
try {
 const binary=path.join(scratch,'evaluate'),sources=['modules/freed-protection/ios/FreedAppGroupsPolicy.swift','modules/freed-protection/ios/FreedEarnedAppTimePolicy.swift','modules/freed-protection/ios/FreedEarnedAppTimeTrustedClock.swift','modules/freed-protection/ios/FreedChallengeEvidencePolicy.swift','modules/freed-protection/ios/FreedPhotoTargetMatching.swift','modules/freed-protection/tests/ChallengePhotoHeldOutEvaluator.swift'];
 const commands=[['xcrun',['swiftc','-parse-as-library','-swift-version','5',...sources,'-o',binary]]];
 if(process.argv.length===4) commands.push([binary,process.argv.slice(2)]);
 else if(process.argv.length!==2) throw Error('Supply local manifest and output report path, or no arguments for compiler check only.');
 for(const [command,args] of commands){const r=spawnSync(command,args,{encoding:'utf8',timeout:60000});process.stdout.write(r.stdout+r.stderr);assert.equal(r.status,0,command+' failed');}
 if(process.argv.length===2)console.log('Local Apple Vision evaluator compiled. Evaluation unexecuted: no labeled calibration/held-out dataset supplied.');
}finally{fs.rmSync(scratch,{recursive:true,force:true});}
