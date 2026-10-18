const fs=require('node:fs');const path=require('node:path');
module.exports=function expoFixtures(root){
 const base=path.join(root,'node_modules/expo-modules-core/android/src/main/java/expo/modules/kotlin/sharedobjects');
 const converter=fs.readFileSync(path.join(base,'SharedObjectTypeConverter.kt'),'utf8');
 return {
 'Expo.kt':`package expo.modules.kotlin
import expo.modules.kotlin.runtime.Runtime
class AppContext {var reactContext:android.content.Context?=null;val runtime=Runtime();val registry=Registry()}
class Registry {val modules=mutableMapOf<String,Any>();fun getModule(name:String)=modules[name]}
fun <T:Any> T?.weak()=java.lang.ref.WeakReference(this)
fun AppContext?.toStrongReference()=requireNotNull(this)
`,
 'Shared.kt':`package expo.modules.kotlin.sharedobjects
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.weak
open class SharedObject(val context:AppContext){internal var sharedObjectId=SharedObjectId(0);var runtimeContextHolder=context.runtime.weak();open fun sharedObjectDidRelease(){};open fun getAdditionalMemoryPressure()=0}
open class SharedRef<T>(context:AppContext,val ref:T?):SharedObject(context){val nativeRefType="fixture"}
`,
 'ExpoRuntime.kt':`package expo.modules.kotlin.runtime
class Runtime {var installed=true;private val jni=expo.modules.kotlin.jni.JSIContext();val jsiContext:expo.modules.kotlin.jni.JSIContext get(){check(installed);return jni};val sharedObjectRegistry=expo.modules.kotlin.sharedobjects.SharedObjectRegistry(this)}
`,
 'ExpoJNI.kt':`package expo.modules.kotlin.jni
class JSIContext{fun setNativeStateForSharedObject(id:Int,js:JavaScriptObject){}}
class JavaScriptValue(val v:Any?){fun getInt()=v as Int}
class JavaScriptObject{val values=mutableMapOf<String,Any?>();fun defineProperty(k:String,v:Any?){values[k]=v};fun hasProperty(k:String)=values.containsKey(k);fun getProperty(k:String)=JavaScriptValue(values[k]);fun setExternalMemoryPressure(i:Int){};fun createWeak()=JavaScriptWeakObject(this)}
class JavaScriptWeakObject(val js:JavaScriptObject){fun lock()=js}
enum class CppType {SHARED_OBJECT_ID,INT};class ExpectedType(vararg types:CppType)
`,
 'ExpoExceptions.kt':`package expo.modules.kotlin.exception
object Exceptions {class AppContextLost:Exception()};class InvalidSharedObjectIdException:Exception();class UsingReleasedSharedObjectException:Exception()
`,
 'ExpoTypes.kt':`package expo.modules.kotlin.types
abstract class NonNullableTypeConverter<T>{abstract fun convertNonNullable(value:Any,context:expo.modules.kotlin.AppContext?,forceConversion:Boolean):T;abstract fun getCppRequiredTypes():expo.modules.kotlin.jni.ExpectedType;abstract fun isTrivial():Boolean}
`,
 'ExpoDynamic.kt':`package com.facebook.react.bridge
interface Dynamic{fun asInt():Int}
`,
 'ExpoRegistry.kt':fs.readFileSync(path.join(base,'SharedObjectRegistry.kt'),'utf8'),
 'ExpoConverter.kt':`package expo.modules.kotlin.sharedobjects
import com.facebook.react.bridge.Dynamic
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.jni.CppType
import expo.modules.kotlin.jni.ExpectedType
import expo.modules.kotlin.toStrongReference
import expo.modules.kotlin.types.NonNullableTypeConverter
import kotlin.reflect.KType
`+converter.slice(converter.indexOf('class SharedObjectTypeConverter'),converter.indexOf('\nclass SharedRefTypeConverter')),
 'ExpoCases.kt':`package app.freed.protection
import expo.modules.kotlin.*
import expo.modules.kotlin.sharedobjects.*
import expo.modules.kotlin.jni.JavaScriptObject
import kotlin.reflect.typeOf
internal fun expoConversionCases87(){
 val appA=AppContext();val a=Any();appA.registry.modules["FreedProtection"]=a
 val leaseA=FreedPrivateModuleLease{appA.registry.getModule("FreedProtection")===a};check(FreedPrivateAccountAdmission.create(leaseA))
 val first=FreedPrivateAccountAdmission.construct(appA,leaseA);val firstID=appA.runtime.sharedObjectRegistry.add(first,JavaScriptObject())
 val converter=SharedObjectTypeConverter<FreedAccountBindingSession>(typeOf<FreedAccountBindingSession>())
 // Actual converter is invoked after ID capture, as in installed asynchronous transport.
 val capturedID=firstID.value;appA.runtime.sharedObjectRegistry.delete(firstID)
 check(runCatching{converter.convertNonNullable(capturedID,appA,false)}.isFailure)
 val second=FreedPrivateAccountAdmission.construct(appA,leaseA);val secondID=appA.runtime.sharedObjectRegistry.add(second,JavaScriptObject())
 val converted=converter.convertNonNullable(secondID.value,appA,false)
 appA.runtime.sharedObjectRegistry.delete(secondID)
 val context=android.content.Context()
 check(FreedPrivateAccountAdmission.prepare(context,leaseA,converted,"[\\"A\\",1]",java.util.UUID.randomUUID().toString(),1)["accepted"]==false)
 val third=FreedPrivateAccountAdmission.construct(appA,leaseA);val thirdID=appA.runtime.sharedObjectRegistry.add(third,JavaScriptObject())
 val wrongID=appA.runtime.sharedObjectRegistry.add(SharedObject(appA),JavaScriptObject())
 check(runCatching{val wrong:FreedAccountBindingSession=converter.convertNonNullable(wrongID.value,appA,false);wrong.lease}.isFailure)
 check(runCatching{converter.convertNonNullable(99999,appA,false)}.isFailure)
 val appB=AppContext();val b=Any();appB.registry.modules["FreedProtection"]=b
 val leaseB=FreedPrivateModuleLease{appB.registry.getModule("FreedProtection")===b};check(FreedPrivateAccountAdmission.create(leaseB))
 val bs=FreedPrivateAccountAdmission.construct(appB,leaseB);val bID=appB.runtime.sharedObjectRegistry.add(bs,JavaScriptObject());check(bID.value==firstID.value)
 // Equal IDs stay in their original AppContext; a released A ID cannot resolve B.
 check(runCatching{converter.convertNonNullable(capturedID,appA,false)}.isFailure)
 val stillA=converter.convertNonNullable(thirdID.value,appA,false);check(stillA===third && stillA!==bs)
 check(FreedPrivateAccountAdmission.prepare(context,leaseB,stillA,"[\\"A\\",1]",java.util.UUID.randomUUID().toString(),1)["accepted"]==false)
 FreedPrivateAccountAdmission.destroy(leaseA);check(FreedPrivateAccountAdmission.live(leaseB))
 println("PASS actual installed Expo SharedObjectRegistry and converter bodies: pre/post-conversion release, wrong class/forged ID, equal cross-context IDs and retired Module rejection")
}
`
 };
};
