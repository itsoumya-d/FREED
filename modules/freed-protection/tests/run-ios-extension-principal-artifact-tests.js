const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');const {spawnSync}=require('node:child_process');
const {inspectExtensionPrincipalClass}=require('../../../scripts/lib/ios-extension-principal-class');
const app=process.argv[2];assert.ok(app,'Supply an actual FREED.app payload/archive path');
const results=[];for(const bundle of fs.readdirSync(path.join(app,'PlugIns')).filter(n=>n.endsWith('.appex')).sort()){
 const dir=path.join(app,'PlugIns',bundle),plistPath=path.join(dir,'Info.plist'),r=spawnSync('plutil',['-convert','json','-o','-',plistPath],{encoding:'utf8'});assert.equal(r.status,0);const info=JSON.parse(r.stdout),binary=path.join(dir,info.CFBundleExecutable),principal=info.NSExtension?.NSExtensionPrincipalClass;
 const inspected=inspectExtensionPrincipalClass(binary,principal),hash=p=>({path:p,sha256:crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')});results.push({bundle,principalClass:principal,binary:hash(binary),plist:hash(plistPath),inspection:inspected});console.log(JSON.stringify({bundle,principal,compatible:inspected.compatible,reason:inspected.reason,classes:inspected.registeredClassNames}));
}
const out=process.argv.indexOf('--receipt');if(out>=0){fs.mkdirSync(path.dirname(process.argv[out+1]),{recursive:true});fs.writeFileSync(process.argv[out+1],JSON.stringify({physicalProof:false,scope:'Actual packed Mach-O class registration/RO-name compatibility, no extension loading/phone enforcement/handoff execution',results},null,2)+'\n');}
assert.ok(results.every(r=>r.inspection.compatible),'Packed extension principal must match actual Objective-C class runtime registration metadata');
