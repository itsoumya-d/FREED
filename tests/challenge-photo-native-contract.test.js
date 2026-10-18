const assert=require('node:assert/strict');const test=require('node:test');const fs=require('node:fs');
for(const [platform,file] of [['Swift','modules/freed-protection/ios/FreedProtectionModule.swift'],['Kotlin','modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt']])test(platform+' native bridge routes classification and cancellation through dedicated photo owner',()=>{
 const s=fs.readFileSync(file,'utf8');assert.ok(/cancelChallengePhoto/.test(s));assert.ok(/photoPipeline\.classify/.test(s));assert.ok(/photoPipeline\.(destroy|cancel)/.test(s));assert.ok(!/Tasks\.await/.test(s));
});
