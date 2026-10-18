// Exact production original-process/publication identity helpers and property setters; no OS adapter.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../..'),file=path.join(root,'modules/freed-protection/android/src/main/java/app/freed/protection/FreedVpnService.kt');
const source=fs.readFileSync(file,'utf8');const out=path.join(root,'.superpowers/sdd/2026-10-13-publishable-recovery/task-87/history');fs.mkdirSync(out,{recursive:true});
const selected=[];function range(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);if(a<0||b<0)throw Error(start);const value=source.slice(a,b);selected.push({start,sha256:crypto.createHash('sha256').update(value).digest('hex')});return value;}
const fields=range('    private val privateHistoryLock','    @Volatile\n    var lastForwardResolver:')+range('    @Volatile\n    var lastForwardFailure:','    @Volatile private var encryptedDnsHealth:')+range('    @Volatile\n    private var lastBlockedKey:', '    private const val VPN_ADDRESS');
const methods=range('    /** Conditional original-process diagnostics only;', '    @Volatile var lastAdultStopReceipt');
const fixture=`package app.freed.protection
object History87 {
${fields}
${methods}
 fun publish(host:String,failed:String,key:String,elapsed:Long){lastBlockedHost=host;lastForwardFailure=failed;lastBlockedKey=key;lastBlockedElapsedMs=elapsed}
 fun snapshot()=listOf(lastBlockedHost,lastForwardFailure,lastBlockedKey,lastBlockedElapsedMs,privateHistoryRevision)
}
fun main(){
 History87.publish("A-host","A-failure","A-key",1L);val a=History87.capturePrivateRuntimeHistoryIdentity()
 History87.publish("B-host","B-failure","B-key",2L);val b=History87.snapshot()
 check(!History87.clearPrivateRuntimeHistoryRetainingAdult(a) && History87.snapshot()==b)
 val gone=java.util.UUID.randomUUID().toString()+":0";check(History87.clearPrivateRuntimeHistoryRetainingAdult(gone) && History87.snapshot()==b)
 val original=History87.capturePrivateRuntimeHistoryIdentity();check(History87.clearPrivateRuntimeHistoryRetainingAdult(original));check(History87.snapshot().take(4)==listOf(null,null,"",0L))
 val cleared=History87.snapshot();check(History87.clearPrivateRuntimeHistoryRetainingAdult(original) && History87.snapshot()==cleared)
 println("PASS exact VPN private-history identity/setters: stale publication preserves new fields, old process is no-op, original resource clears once, exact settled original identity acknowledges without clearing again")
}
`;
const kt=path.join(out,'History87.kt'),jar=path.join(out,'history.jar');fs.writeFileSync(kt,fixture);fs.writeFileSync(path.join(out,'input.json'),JSON.stringify({source:file,sourceSHA256:crypto.createHash('sha256').update(source).digest('hex'),selected},null,2));
for(const [cmd,args]of [['kotlinc',[kt,'-include-runtime','-d',jar]],['java',['-jar',jar]]]){const r=cp.spawnSync(cmd,args,{cwd:root,encoding:'utf8',timeout:300000});process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');if(r.status)process.exit(r.status||1);}
