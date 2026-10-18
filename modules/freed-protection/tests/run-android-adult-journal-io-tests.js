// Actual production journal file/codec; Android AtomicFile and directory I/O are
// staged/recovery adapters. The adapter deliberately removes uncommitted .new
// bytes from openRead, so missing caller exclusion disturbs a real publication.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../..'),native=path.join(root,'modules/freed-protection/android/src/main/java/app/freed/protection');
const evidence=path.resolve(process.env.FREED85_EVIDENCE||path.join(root,'.superpowers/sdd/2026-10-13-publishable-recovery/task-85-android-enrolled-executor/fix1/journal-io'));
fs.mkdirSync(evidence,{recursive:true});const generated=path.join(evidence,'generated');fs.mkdirSync(generated,{recursive:true});const files=[];
function write(name,text){const file=path.join(generated,name);fs.writeFileSync(file,text);files.push(file);}
write('Context.kt',`package android.content
open class Context(val noBackupFilesDir:java.io.File=java.nio.file.Files.createTempDirectory("freed85-journal-io-").toFile())
`);
write('AtomicFile.kt',`package android.util
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.util.concurrent.CountDownLatch
import java.util.concurrent.atomic.AtomicInteger
object PublicationHooks {
 @Volatile var target="";@Volatile var paused=false;@Volatile var readerOverlapped=false;@Volatile var failFinish=false
 var entered=CountDownLatch(1);var release=CountDownLatch(1);val readerEntries=AtomicInteger()
 fun reset(stage:String){target=stage;paused=false;readerOverlapped=false;failFinish=false;entered=CountDownLatch(1);release=CountDownLatch(1);readerEntries.set(0)}
 fun at(stage:String){if(Thread.currentThread().name=="journal-writer" && stage==target){paused=true;entered.countDown();release.await();paused=false}}
}
class AtomicFile(val base:File) {
 private val pending=File(base.path+".new")
 fun startWrite():FileOutputStream {
  val stream=object:FileOutputStream(pending){override fun write(bytes:ByteArray){PublicationHooks.at("bytes-write");super.write(bytes)}}
  PublicationHooks.at("start-write");return stream
 }
 fun finishWrite(stream:FileOutputStream){PublicationHooks.at("finish-write");stream.close();if(PublicationHooks.failFinish)error("injected finish failure");check(pending.renameTo(base)){"Staged journal was removed by a concurrent reader"}}
 fun failWrite(stream:FileOutputStream){PublicationHooks.at("failure");stream.close();pending.delete()}
 fun openRead():FileInputStream {
  if(Thread.currentThread().name=="journal-reader") {PublicationHooks.readerEntries.incrementAndGet();if(PublicationHooks.paused)PublicationHooks.readerOverlapped=true}
  PublicationHooks.at("readback")
  if(pending.exists())pending.delete()
  return FileInputStream(base)
 }
}
`);
write('Os.kt',`package android.system
object OsConstants{const val O_RDONLY=0}
object Os {fun open(p:String,f:Int,m:Int)=java.io.FileDescriptor();fun fsync(d:java.io.FileDescriptor){android.util.PublicationHooks.at("directory-sync")};fun close(d:java.io.FileDescriptor){}}
`);
files.push(...['FreedAdultExecutionJournal.kt','FreedFriendLockCore.kt','FreedFriendLockRecordStore.kt'].map(f=>path.join(native,f)),path.join(__dirname,'AndroidAdultJournalIOCases.kt'));
fs.writeFileSync(path.join(evidence,'inputs.json'),JSON.stringify(files.map(file=>({path:file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')})),null,2)+'\n');
const jar=path.join(evidence,'journal-io.jar');
for(const [command,args] of [['kotlinc',[...files,'-include-runtime','-d',jar]],['java',['-jar',jar]]]){const result=cp.spawnSync(command,args,{cwd:root,encoding:'utf8',timeout:120000});process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');if(result.status!==0)process.exit(result.status||1);}
