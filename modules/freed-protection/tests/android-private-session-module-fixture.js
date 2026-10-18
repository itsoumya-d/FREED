const fs=require('node:fs');const path=require('node:path');
module.exports=function moduleFixture(root){
 const source=fs.readFileSync(path.join(root,'modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt'),'utf8');
 function block(marker){const start=source.indexOf(marker);if(start<0)throw Error(marker);let depth=0,quote=false,escape=false;for(let i=source.indexOf('{',start);i<source.length;i++){const c=source[i];if(quote){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')quote=false;continue;}if(c==='"')quote=true;else if(c==='{')depth++;else if(c==='}'&&--depth===0)return source.slice(start,i+1);}throw Error(marker);}
 const selected=['Class(FreedAccountBindingSession::class)','Function("prepareAccountBindingV2")','Function("commitAccountBindingV2")','Function("prepareAccountProtectionCleanup")','AsyncFunction("executeAccountProtectionCleanup")','AsyncFunction("getAccountProtectionCleanup")','Function("suspendAppGroupOperations")','Function("setAppGroupActionScope")'];
 return `package app.freed.protection
import expo.modules.kotlin.AppContext
import kotlin.reflect.KClass
private class Constructor87 {var factory:(()->FreedAccountBindingSession)?=null;fun Constructor(body:()->FreedAccountBindingSession){factory=body}}
internal class ModuleFixture87(val appContext:AppContext,val context:android.content.Context){
 private val privateLease=FreedPrivateModuleLease {appContext.registry.getModule("FreedProtection")===this}
 private val callbacks=mutableMapOf<String,(List<Any?>)->Any?>();private var factory:(()->FreedAccountBindingSession)?=null
 init{appContext.reactContext=context
 ${selected.map(block).join('\n')}
 }
 fun create()=FreedPrivateAccountAdmission.create(privateLease)
 fun destroy(){FreedPrivateAccountAdmission.destroy(privateLease)}
 fun construct()=factory!!()
 fun call(name:String,vararg args:Any?)=callbacks.getValue(name)(args.toList()) as Map<String,Any?>
 private fun Class(type:KClass<FreedAccountBindingSession>,body:Constructor87.()->Unit){val builder=Constructor87();builder.body();factory=builder.factory}
 private fun <A,R> Function(name:String,body:(A)->R){callbacks[name]={body(it[0] as A)}}
 private fun <A,B,R> Function(name:String,body:(A,B)->R){callbacks[name]={body(it[0] as A,it[1] as B)}}
 private fun <A,B,C,D,R> Function(name:String,body:(A,B,C,D)->R){callbacks[name]={body(it[0] as A,it[1] as B,it[2] as C,it[3] as D)}}
 private fun <A,R> AsyncFunction(name:String,body:(A)->R){callbacks[name]={body(it[0] as A)}}
}
internal fun moduleExportCases87(){
 val context=android.content.Context();val app=AppContext();val a=ModuleFixture87(app,context);app.registry.modules["FreedProtection"]=a;check(a.create())
 val session=a.construct();val p=a.call("prepareAccountBindingV2",session,"[\\"A-module\\",1]",java.util.UUID.randomUUID().toString(),1L)
 val receipt=a.call("commitAccountBindingV2",session,p["ticket"]);check(receipt["accepted"]==true)
 check(a.call("setAppGroupActionScope","[\\"forged\\",1]")["accepted"]==false)
 val prepared=a.call("prepareAccountProtectionCleanup",receipt["actionScope"],receipt["bindingHandle"]);check(prepared["phase"]=="prepared")
 check(a.call("getAccountProtectionCleanup",prepared["operationId"])["phase"]=="prepared")
 val bApp=AppContext();val b=ModuleFixture87(bApp,context);bApp.registry.modules["FreedProtection"]=b;check(b.create())
 check(a.call("prepareAccountBindingV2",session,"[\\"A-module\\",1]",java.util.UUID.randomUUID().toString(),2L)["accepted"]==false)
 a.destroy();val bs=b.construct();val bp=b.call("prepareAccountBindingV2",bs,"[\\"B-module\\",2]",java.util.UUID.randomUUID().toString(),1L)
 val br=b.call("commitAccountBindingV2",bs,bp["ticket"]);check(br["accepted"]==true)
 check(a.call("prepareAccountProtectionCleanup",receipt["actionScope"],receipt["bindingHandle"])["accepted"]==false)
 val bBytes=context.storage.values.toMap();val superseded=b.call("executeAccountProtectionCleanup",prepared["operationId"])
 check(superseded["phase"]=="superseded" && superseded["privateCleanupAccepted"]==false && context.storage.values==bBytes)
 println("PASS exact extracted Module Class/Constructor/prepare/commit/cleanup/status/raw-deny closures, originating AppContext and replacement/destroy")
}
`;
};
