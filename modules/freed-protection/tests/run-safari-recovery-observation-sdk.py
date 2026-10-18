"""Task96A current host and Safari extension SDK closures; no link, archive or install."""
from pathlib import Path
import os,json,hashlib,subprocess,tempfile,shutil
root=Path.cwd();out=Path(os.environ.get('FREED_TASK96A_SDK_OUTPUT_DIR') or tempfile.mkdtemp(prefix='freed96-sdk-')).resolve();out.mkdir(parents=True,exist_ok=True)
prior=json.loads((root/'.superpowers/sdd/2026-10-13-publishable-recovery/task-86/sdk-command-summary.json').read_text())
host=prior['host']['command']+['modules/freed-protection/ios/FreedSafariRecoveryObservation.swift']
sdk=host[host.index('-sdk')+1]
ext=['xcrun','swiftc','-typecheck','-swift-version','5','-module-name','FREEDSafariFocusShield','-sdk',sdk,'-target','arm64-apple-ios15.4','ios/FREEDSafariFocusShield/SafariWebExtensionHandler.swift','modules/freed-protection/ios/FreedSafariRecoveryObservation.swift','modules/freed-protection/ios/FreedProtectionConfigurationLock.swift','modules/freed-protection/ios/FreedRetainedAdultProtection.swift']
inputs=sorted(set(x for x in host+ext if x.endswith('.swift')))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
(out/'inputs.json').write_text(json.dumps({p:sha(root/p) for p in inputs},indent=2))
for p in inputs:
 dest=out/'inputs'/p;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(root/p,dest)
framework=Path(host[host.index('-F')+1])/'ExpoModulesCore.framework'
(out/'expo-inputs.json').write_text(json.dumps({str(p):sha(p) for p in framework.rglob('*') if p.is_file() and (p.suffix in ('.swiftmodule','.swiftinterface','.h') or p.name=='ExpoModulesCore')},indent=2))
commands=[]
for name,cmd in [('host',host),('safari-extension',ext)]:
 r=subprocess.run(cmd,capture_output=True,text=True,timeout=300);(out/(name+'.log')).write_text(r.stdout+r.stderr);commands.append({'name':name,'command':cmd,'exitCode':r.returncode});(out/'commands.json').write_text(json.dumps(commands,indent=2));print(name,r.returncode,flush=True)
 if r.returncode:print(r.stdout+r.stderr);raise SystemExit(r.returncode)
