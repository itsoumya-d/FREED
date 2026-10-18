const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const folder = path.resolve('.superpowers/sdd/2026-10-05-daily-usability-release-completion/task-8g-fix1-native-test');
function fixture(name, source) { const file=path.join(folder,name);fs.writeFileSync(file,source);return file; }
test('actual Android pipeline destroys idle B while A drains without leaking B or admitting another physical task',()=>{
 fs.mkdirSync(folder,{recursive:true});
 const sources=[
 fixture('Context.kt','package android.content\nopen class Context\n'),
 fixture('Uri.kt','package android.net\nclass Uri private constructor(val scheme:String?) {companion object {fun parse(value:String)=Uri(value.substringBefore(\":\"))}}\n'),
 fixture('Build.kt','package android.os\nobject Build {object VERSION {const val SDK_INT=36}}\n'),
 fixture('Promise.kt','package expo.modules.kotlin\ninterface Promise {fun resolve(value:Any?)}\n'),
 fixture('InputImage.kt','package com.google.mlkit.vision.common\nimport android.content.Context\nimport android.net.Uri\nclass InputImage {companion object {fun fromFilePath(context:Context,uri:Uri)=InputImage()}}\n'),
 fixture('Options.kt','package com.google.mlkit.vision.label.defaults\nclass ImageLabelerOptions {class Builder {fun setConfidenceThreshold(value:Float)=this;fun build()=ImageLabelerOptions()}}\n'),
 fixture('Labeler.kt',`package com.google.mlkit.vision.label
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.label.defaults.ImageLabelerOptions
import java.util.concurrent.Executor
import java.util.concurrent.LinkedBlockingQueue
class ImageLabel(val text:String,val confidence:Float)
class FakeTask {
 var isSuccessful=true;var result=listOf<ImageLabel>();private var executor:Executor?=null;private var listener:((FakeTask)->Unit)?=null
 @Synchronized fun addOnCompleteListener(executor:Executor,listener:(FakeTask)->Unit):FakeTask {this.executor=executor;this.listener=listener;return this}
 @Synchronized fun complete(){executor!!.execute {listener!!(this)}}
 @Synchronized fun hasListener()=listener!=null
}
interface ImageLabeler {fun process(image:InputImage):FakeTask;fun close()}
object ImageLabeling {
 val tasks=LinkedBlockingQueue<FakeTask>()
 fun getClient(options:ImageLabelerOptions):ImageLabeler=object:ImageLabeler {
 override fun process(image:InputImage):FakeTask {val task=FakeTask();tasks.put(task);return task}
 override fun close(){}
 }
}
`),
 fixture('Teardown.kt',`package app.freed.protection
import android.content.Context
import expo.modules.kotlin.Promise
import com.google.mlkit.vision.label.ImageLabeling
import java.util.concurrent.CountDownLatch
import java.util.concurrent.ExecutorService
import java.util.concurrent.TimeUnit
class Reply:Promise {val done=CountDownLatch(1);var payload:Any?=null;override fun resolve(value:Any?){payload=value;done.countDown()}}
private fun executor(pipeline:FreedChallengePhotoPipeline):ExecutorService {val field=pipeline.javaClass.getDeclaredField("executor");field.isAccessible=true;return field.get(pipeline) as ExecutorService}
fun awaitCondition(condition:()->Boolean){val deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(4);while(!condition()){check(System.nanoTime()<deadline){"condition did not complete"};Thread.sleep(5)}}
fun main(){try {
 val a=FreedChallengePhotoPipeline();val b=FreedChallengePhotoPipeline();val replyA=Reply()
 a.classify(Context(),"file:///camera/a.jpg",listOf("flower"),"a",replyA)
 val taskA=ImageLabeling.tasks.poll(4,TimeUnit.SECONDS)!!;awaitCondition {taskA.hasListener()}
 b.destroy();check(executor(b).awaitTermination(4,TimeUnit.SECONDS)){"idle replacement B executor leaked while A occupied shared gate"}
 check(replyA.done.count==1L){"B teardown cancelled A publication"}
 a.destroy();check(replyA.done.await(4,TimeUnit.SECONDS));check((replyA.payload as Map<*,*>)["outcome"]=="cancelled")
 check(!executor(a).isShutdown){"A lost the executor required for physical completion"}
 val c=FreedChallengePhotoPipeline();val replyC=Reply();c.classify(Context(),"file:///camera/c.jpg",listOf("flower"),"c",replyC)
 check(replyC.done.await(4,TimeUnit.SECONDS));check((replyC.payload as Map<*,*>)["outcome"]=="unavailable");check(ImageLabeling.tasks.isEmpty()){ "A teardown prematurely admitted another physical inference" }
 c.destroy();check(executor(c).awaitTermination(4,TimeUnit.SECONDS))
 taskA.complete();check(executor(a).awaitTermination(4,TimeUnit.SECONDS))
 val d=FreedChallengePhotoPipeline();val replyD=Reply();d.classify(Context(),"file:///camera/d.jpg",listOf("flower"),"d",replyD)
 val taskD=ImageLabeling.tasks.poll(4,TimeUnit.SECONDS)!!;awaitCondition {taskD.hasListener()};taskD.complete();check(replyD.done.await(4,TimeUnit.SECONDS));d.destroy();check(executor(d).awaitTermination(4,TimeUnit.SECONDS))
 println("actual pipeline owner teardown passed")
} catch(error:Throwable){error.printStackTrace();kotlin.system.exitProcess(1)}}
`),
 'modules/freed-protection/android/src/main/java/app/freed/protection/FreedChallengePhotoPipeline.kt',
 'modules/freed-protection/android/src/main/java/app/freed/protection/FreedPhotoOperationGate.kt',
 'modules/freed-protection/android/src/main/java/app/freed/protection/FreedPhotoTargetMatching.kt'
 ];
 const jar=path.join(folder,'teardown.jar');execFileSync('kotlinc',[...sources,'-include-runtime','-d',jar],{timeout:90000,stdio:'pipe'});
 assert.ok(execFileSync('java',['-jar',jar],{timeout:15000,encoding:'utf8'}).includes('actual pipeline owner teardown passed'));
});
