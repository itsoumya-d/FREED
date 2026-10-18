// Production execution machine, journal/codec and protected Core/store. OS/file/key seams only.
const fs=require('node:fs'), path=require('node:path'), cp=require('node:child_process'), crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../..');
const native=path.join(root,'modules/freed-protection/android/src/main/java/app/freed/protection');
const evidence=path.join(root,'.superpowers/sdd/2026-10-13-publishable-recovery/task-85-android-enrolled-executor');
const generated=path.join(evidence,'generated-executor');fs.mkdirSync(generated,{recursive:true});
const files=[];function write(n,t){const p=path.join(generated,n);fs.writeFileSync(p,t);files.push(p);}
const source=fs.readFileSync(path.join(native,'FreedAdultAuthorizationExecutor.kt'),'utf8');
const machine=source.slice(0,source.indexOf('/** One process authority.'));
write('Machine.kt',machine);
write('Context.kt',`package android.content
open class Context(val noBackupFilesDir:java.io.File=java.nio.file.Files.createTempDirectory("freed85-").toFile())
`);
write('AtomicFile.kt',`package android.util
class AtomicFile(val file:java.io.File){fun openRead()=java.io.FileInputStream(file);fun startWrite()=java.io.FileOutputStream(file);fun finishWrite(s:java.io.FileOutputStream){s.close()};fun failWrite(s:java.io.FileOutputStream){s.close()}}
`);
write('Os.kt',`package android.system
object OsConstants{const val O_RDONLY=0;const val O_DIRECTORY=0}
object Os {fun open(p:String,f:Int,m:Int)=java.io.FileDescriptor();fun fsync(d:java.io.FileDescriptor){};fun close(d:java.io.FileDescriptor){}}
`);
write('Gate.kt',`package app.freed.protection
internal class FreedAdultMutationFailure(val action:FriendLockAction,val code:String):Exception(code)
internal class FreedAdultMutationGate(val record:()->FriendLockRecord?){fun requireUnenrolled(action:FriendLockAction){check(record()==null)}}
`);
files.push(...['FreedFriendLockCore.kt','FreedFriendLockRecordStore.kt','FreedAdultExecutionJournal.kt'].map(n=>path.join(native,n)),path.join(__dirname,'AndroidAdultExecutorCases.kt'));
const jar=path.join(evidence,'executor-fixture.jar');
function run(c,args){const r=cp.spawnSync(c,args,{cwd:root,encoding:'utf8',timeout:300000});process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');if(r.status!==0)process.exit(r.status||1);}
fs.writeFileSync(path.join(evidence,'executor-inputs.json'),JSON.stringify(files.map(p=>({path:p,sha256:crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')})),null,2));
run('kotlinc',[...files,'-include-runtime','-d',jar]);run('java',['-jar',jar]);
