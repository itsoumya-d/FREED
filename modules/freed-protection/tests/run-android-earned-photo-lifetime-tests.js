// Actual production camera pipeline + relay + real private files. Android/MLKit failure I/O are explicit adapters.
// The catalog seam below is TEST ONLY and never a real evaluation/target enablement or photo proof.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { join, resolve } = require('node:path');
const { tmpdir } = require('node:os');
const root = resolve(__dirname, '../../..');
const workspace = fs.mkdtempSync(join(tmpdir(), 'freed-photo-lifetime-'));
const source = 'modules/freed-protection/android/src/main/java/app/freed/protection/';
const before = '.superpowers/sdd/2026-10-11-android-recovery-friend-lock/challenge-native-android/fix-round1/before-';
const fixture = (name, body) => { const path = join(workspace, name); fs.writeFileSync(path, body); return path; };
const run = (cmd, args) => { const result = spawnSync(cmd, args, { cwd: root, encoding: 'utf8', timeout: 180000 }); if (result.stdout) process.stdout.write(result.stdout); if (result.stderr) process.stderr.write(result.stderr); assert.equal(result.status, 0, result.error?.message || `${cmd} failed`); };
try {
const context = fixture('Context.kt', `package android.content
import android.net.Uri
import java.io.File
object Environment {var cache=File(java.lang.System.getProperty("freed.photo.test.cache"));val external=mutableListOf<Intent>();val relay=mutableListOf<Intent>();val revoked=mutableListOf<Uri>();var launchThrows=false;var relayThrows=false;var classifierCalls=0;var classifierCloses=0;fun reset(){external.clear();relay.clear();revoked.clear();launchThrows=false;relayThrows=false;classifierCalls=0;classifierCloses=0}}
open class Context {val packageName="app.freed";val cacheDir get()=Environment.cache;fun revokeUriPermission(uri:Uri,flags:Int){Environment.revoked.add(uri)}}
class Intent {val extras=mutableMapOf<String,Any?>();var flags=0;constructor(action:String);constructor(context:Context,target:Class<*>);fun putExtra(key:String,value:Any?)=apply{extras[key]=value};fun getStringExtra(key:String)=extras[key] as? String;fun addFlags(value:Int)=apply{flags=flags or value};companion object{const val FLAG_GRANT_READ_URI_PERMISSION=1;const val FLAG_GRANT_WRITE_URI_PERMISSION=2}}
`);
const uri = fixture('Uri.kt', `package android.net
class Uri(val path:String)
`);
const bundle = fixture('Bundle.kt', `package android.os
class Bundle
`);
const activity = fixture('Activity.kt', `package android.app
import android.content.*
import android.os.Bundle
open class Activity:Context(){val RESULT_OK:Int get()=-1;var intent:Intent?=null;var isFinishing=false;var isDestroyed=false;var isChangingConfigurations=false;fun hasWindowFocus()=true;fun runOnUiThread(action:()->Unit)=action();fun startActivity(intent:Intent){if(Environment.relayThrows)error("Relay launch denied");Environment.relay.add(intent)};fun startActivityForResult(intent:Intent,request:Int){if(Environment.launchThrows)error("Camera launch denied");Environment.external.add(intent)};fun finish(){isFinishing=true};open fun onCreate(bundle:Bundle?){};open fun onDestroy(){isDestroyed=true};open fun onActivityResult(request:Int,result:Int,data:Intent?){};companion object{const val RESULT_OK=-1}}
`);
const provider = fixture('Provider.kt', `package androidx.core.content
import android.content.Context
import android.net.Uri
import java.io.File
object FileProvider {fun getUriForFile(context:Context,authority:String,file:File)=Uri(file.absolutePath)}
`);
const image = fixture('Image.kt', `package com.google.mlkit.vision.common
import android.content.Context
import android.net.Uri
class InputImage {companion object{fun fromFilePath(context:Context,uri:Uri)=InputImage()}}
`);
const options = fixture('Options.kt', `package com.google.mlkit.vision.label.defaults
class ImageLabelerOptions{class Builder{fun setConfidenceThreshold(value:Float)=this;fun build()=ImageLabelerOptions()}}
`);
const classifier = fixture('Classifier.kt', `package com.google.mlkit.vision.label
import android.content.Environment
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.label.defaults.ImageLabelerOptions
import java.util.concurrent.Executor
class ImageLabel(val text:String,val confidence:Float)
class Task {val isSuccessful=false;val result=emptyList<ImageLabel>();fun addOnCompleteListener(executor:Executor,complete:(Task)->Unit){executor.execute{complete(this)}}}
class ImageLabeler{fun process(image:InputImage):Task{Environment.classifierCalls++;error("Local native classifier process launch failed")};fun close(){Environment.classifierCloses++}}
object ImageLabeling{fun getClient(options:ImageLabelerOptions)=ImageLabeler()}
`);
const runtime = fixture('Runtime.kt', `package app.freed.protection
import android.content.Context
internal object FreedEarnedChallengePhotoEvaluation {val reviewedTargetIds=listOf("chair") /* TEST ONLY gate seam; no measured evaluation or proof */}
internal object FreedEarnedChallengeProofStore {fun rows(context:Context):List<Map<String,Any?>>?=emptyList()}
internal object FreedEarnedChallengeProofPolicy {fun validId(value:Any?)=(value as? String)?.let{runCatching{java.util.UUID.fromString(it).toString()==it}.getOrDefault(false)}==true}
`);
const cases = fixture('PhotoCases.kt', fs.readFileSync(join(__dirname, 'AndroidEarnedChallengePhotoLifetimeCases.kt'), 'utf8'));
const jar = join(workspace, 'photo.jar');
const production = ['FreedEarnedChallengePhotoPipeline','FreedEarnedChallengeCaptureActivity'].map(name => process.argv.includes('--before') ? before + name + '.kt' : source + name + '.kt');
run('kotlinc', [context,uri,bundle,activity,provider,image,options,classifier,runtime,cases,...production,source+'FreedPhotoTargetMatching.kt','-include-runtime','-d',jar]);
run('java', ['-Dfreed.photo.test.cache='+join(workspace,'cache'),'-classpath',jar,'app.freed.protection.PhotoCasesKt']);
} finally { fs.rmSync(workspace,{recursive:true,force:true}); }
