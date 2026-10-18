// Existing routing/Handoff fixtures execute the actual adult observation members and
// actual durable codec. Only the composition's OS/file I/O is substituted here;
// authorization/claim/permits are exercised by the separate actual-root lower suite.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
module.exports=function install(write,files,native){
 const source=fs.readFileSync(path.join(native,'FreedAdultProtectionState.kt'),'utf8');
 const observation=source.slice(0,source.indexOf('  fun configuration('))+'}\n';
 files.push(write('AdultObservation.kt',observation));
 files.push(write('AdultObservationIO.kt',`package app.freed.protection
import android.content.Context
internal object FreedAdultAuthorizationExecutor {
 val guard=Any()
 private val bytes=object:FreedAdultJournalIO{var value:ByteArray?=null;override fun read()=value?.clone();override fun write(v:ByteArray){value=v.clone()}}
 val journal=FreedAdultExecutionJournal(bytes).also{it.initialize();it.save(it.read().copy(adultAccessibility=true))}
 fun get(context:Context)=this
 fun advance(){journal.save(journal.read().let{it.copy(generation=it.generation+1)})}
}
`));
 files.push(write('AdultAtomic.kt',`package android.util
class AtomicFile(val file:java.io.File){fun openRead()=java.io.FileInputStream(file);fun startWrite()=java.io.FileOutputStream(file);fun finishWrite(s:java.io.FileOutputStream){s.close()};fun failWrite(s:java.io.FileOutputStream){s.close()}}
`));
 files.push(write('AdultOs.kt',`package android.system
object OsConstants{const val O_RDONLY=0};object Os{fun open(p:String,f:Int,m:Int)=java.io.FileDescriptor();fun fsync(d:java.io.FileDescriptor){};fun close(d:java.io.FileDescriptor){}}
`));
 files.push(...['FreedAdultExecutionJournal.kt','FreedFriendLockCore.kt','FreedFriendLockRecordStore.kt'].map(f=>path.join(native,f)));
 return {sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),extractedSha256:crypto.createHash('sha256').update(observation).digest('hex')};
};
