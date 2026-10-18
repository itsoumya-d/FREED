"""Current host/export closure; installed SDKs/Expo and cached dependency artifacts only."""
from pathlib import Path
import subprocess,json,hashlib,sys,zipfile,tempfile,shutil,time,os
root=Path.cwd();out=Path(os.environ['FREED_TASK91_SDK_OUTPUT_DIR']).resolve() if 'FREED_TASK91_SDK_OUTPUT_DIR' in os.environ else Path(tempfile.mkdtemp(prefix='freed-task91-sdk-'));out.mkdir(parents=True,exist_ok=True)
records=json.loads((out/'commands.json').read_text()) if (out/'commands.json').exists() else []
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def run(command,tag):
 start=time.time();r=subprocess.run(command,cwd=root,capture_output=True,text=True,timeout=300)
 (out/(tag+'.log')).write_text(r.stdout+r.stderr)
 records.append(dict(command=command,exitCode=r.returncode,elapsedSeconds=time.time()-start,log=tag+'.log'))
 (out/'commands.json').write_text(json.dumps(records,indent=2))
 print(tag,r.returncode,flush=True)
 if r.returncode: print(r.stdout+r.stderr);sys.exit(r.returncode)
mode=sys.argv[1]
if mode=='ios':
 prior=json.loads((root/'.superpowers/sdd/2026-10-13-publishable-recovery/task-86/sdk-command-summary.json').read_text())
 cmd=prior['host']['command'];sources=[x for x in cmd if x.endswith('.swift')]
 (out/'ios-inputs.json').write_text(json.dumps({p:digest(root/p) for p in sources},indent=2))
 framework=Path(cmd[cmd.index('-F')+1])/'ExpoModulesCore.framework'
 binaries={str(p):digest(p) for p in framework.rglob('*') if p.is_file() and (p.suffix in ['.swiftmodule','.swiftinterface','.h'] or p.name=='ExpoModulesCore')}
 (out/'ios-installed-expo.json').write_text(json.dumps(binaries,indent=2))
 run(cmd,'ios-host')
elif mode=='android':
 work=Path(tempfile.mkdtemp(prefix='freed90-sdk-'))
 try:
  previous=root/'modules/freed-protection/android/build/tmp/kotlin-classes/release'
  cp=[Path.home()/'Library/Android/sdk/platforms/android-36/android.jar',previous,root/'.superpowers/android-candidate-20261005/workspace/modules/freed-protection/android/build/intermediates/compile_r_class_jar/release/generateReleaseRFile/R.jar']
  cache=root/'.superpowers/android-current4-20261006';origins=[]
  for i,p in enumerate(p for p in cache.rglob('*') if p.suffix in ('.aar','.jar') and 'verified-dependency-repository' not in str(p) and 'workspace' not in str(p)):
   origins.append(p)
   if p.suffix=='.jar':cp.append(p)
   else:
    with zipfile.ZipFile(p) as z:
     for n in z.namelist():
      if n=='classes.jar' or (n.startswith('libs/') and n.endswith('.jar')):
       dest=work/(str(i)+'-'+n.replace('/','-'));dest.write_bytes(z.read(n));cp.append(dest)
  cp.append(root/'node_modules/expo-modules-core/android/build/intermediates/runtime_library_classes_jar/release/bundleLibRuntimeToJarRelease/classes.jar')
  native=root/'modules/freed-protection/android/src/main/java/app/freed/protection'
  sources=[p for p in native.glob('*.kt') if p.name!='FreedEncryptedDnsUpstream.kt']
  (out/'android-inputs.json').write_text(json.dumps({str(p.relative_to(root)):digest(p) for p in sources},indent=2))
  classfiles=[p for p in previous.rglob('*.class')]
  (out/'android-cached-binaries.json').write_text(json.dumps({str(p):digest(p) for p in cp+origins+classfiles if p.is_file()},indent=2))
  run(['kotlinc',*map(str,sources),'-jvm-target','17','-classpath',':'.join(map(str,cp)),'-Xfriend-paths='+str(previous),'-d',str(out/'android-classes')],'android-sdk')
  (out/'android-output-binaries.json').write_text(json.dumps({str(p.relative_to(out)):digest(p) for p in (out/'android-classes').rglob('*') if p.is_file()},indent=2))
 finally:shutil.rmtree(work)
