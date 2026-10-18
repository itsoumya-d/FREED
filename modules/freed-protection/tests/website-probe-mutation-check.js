const {spawnSync}=require('node:child_process');
const {readFileSync,writeFileSync,mkdtempSync,rmSync}=require('node:fs');
const {join}=require('node:path');
const assert=require('node:assert/strict');
const tmp=mkdtempSync('/tmp/freed-website-probe-red-');
try{
 const source=readFileSync('modules/freed-protection/ios/FreedWebsiteRecoveryProbe.swift','utf8');
 const cases=[['production gate bypass',source.replace('flag && (channel ==','true || flag && (channel ==')],['native persistence rollback deleted',source.replace('if changesStore {\n        do { try store.write(old);','if false {\n        do { try store.write(old);')]];
 for(const [name,mutated] of cases){assert.notEqual(mutated,source);const file=join(tmp,'Probe.swift'),binary=join(tmp,'cases');writeFileSync(file,mutated);
 const built=spawnSync('xcrun',['swiftc','-parse-as-library','-swift-version','5',file,'modules/freed-protection/tests/WebsiteRecoveryProbeCases.swift','-o',binary],{encoding:'utf8'});assert.equal(built.status,0,built.stderr);
 const red=spawnSync(binary,[],{encoding:'utf8'});assert.notEqual(red.status,0,`${name} was not detected`);
 console.log(`RED detected seeded production regression: ${name}; ${red.stderr.split('\n')[0]}`);
 }
}finally{rmSync(tmp,{recursive:true,force:true});}
