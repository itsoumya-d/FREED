'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto');
const out=path.resolve(process.env.FREED_TASK96A_NATIVE_OUTPUT_DIR||fs.mkdtempSync(path.join(os.tmpdir(),'freed96-')));fs.mkdirSync(out,{recursive:true});
const sources=['modules/freed-protection/ios/FreedProtectionConfigurationLock.swift','modules/freed-protection/ios/FreedRetainedAdultProtection.swift','modules/freed-protection/ios/FreedAccountProtectionCleanup.swift','modules/freed-protection/ios/FreedSafariRecoveryObservation.swift','ios/FREEDSafariFocusShield/SafariWebExtensionHandler.swift','modules/freed-protection/tests/SafariRecoveryObservationCases.swift'];
const records=[];function run(command,args){const r=cp.spawnSync(command,args,{encoding:'utf8',timeout:120000});records.push({command,args,status:r.status,stdout:r.stdout,stderr:r.stderr,error:r.error?.message});fs.writeFileSync(path.join(out,'commands.json'),JSON.stringify(records,null,2));if(r.status!==0){console.error(r.stdout+r.stderr);process.exit(1);}}
fs.writeFileSync(path.join(out,'inputs.json'),JSON.stringify(Object.fromEntries(sources.map(p=>[p,fs.existsSync(p)?crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'):null])),null,2));for(const p of sources){if(fs.existsSync(p)){const dest=path.join(out,'inputs',p);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(p,dest);}}
run('xcrun',['swiftc','-swift-version','5','-parse-as-library',...sources,'-o',path.join(out,'cases')]);const {configureSafariRecoveryProbe}=require('../../../scripts/configure-safari-recovery-probe');
for(const variant of ['default','probe','adult']) {
 const workspace=path.join(out,'packages',variant),folder=path.join(workspace,'ios/FREEDSafariFocusShield');fs.mkdirSync(workspace,{recursive:true});fs.cpSync(path.resolve('ios/FREEDSafariFocusShield'),folder,{recursive:true});
 if(variant==='probe')configureSafariRecoveryProbe(workspace,{EAS_BUILD_PROFILE:'internal',FREED_SAFARI_RECOVERY_PROBE:'1'});
 if(variant==='adult'){
  const feed=path.resolve('.superpowers/sdd/2026-10-13-publishable-recovery/task-94/execution-final2/pinned-feed.json');
  configureSafariRecoveryProbe(workspace,{EAS_BUILD_PROFILE:'internal',FREED_SAFARI_ADULT_RECOVERY:'1',FREED_SAFARI_ADULT_FEED_PATH:feed,FREED_SAFARI_ADULT_FEED_SHA256:crypto.createHash('sha256').update(fs.readFileSync(feed)).digest('hex')});
 }
 const runFolder=path.join(out,variant);fs.mkdirSync(runFolder,{recursive:true});run(path.join(out,'cases'),[path.join(runFolder,'container'),folder]);
}fs.writeFileSync(path.join(out,'binary.sha256'),crypto.createHash('sha256').update(fs.readFileSync(path.join(out,'cases'))).digest('hex'));console.log(records.at(-1).stdout);
