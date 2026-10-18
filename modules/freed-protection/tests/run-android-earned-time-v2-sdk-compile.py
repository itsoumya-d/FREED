"""Compile current native source against Android SDK 36 and already cached dependencies; no Gradle/network/device work."""
from pathlib import Path
import shutil
import re
import sys
import subprocess
import tempfile
import zipfile

root = Path(__file__).resolve().parents[3]
run_tag = sys.argv[1] if len(sys.argv) > 1 else ""
if run_tag and not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", run_tag):
    raise SystemExit("Invalid evidence run tag")
run_suffix = "-" + run_tag if run_tag else ""
workspace = Path(tempfile.mkdtemp(prefix="freed-task2-sdk-"))
try:
    previous = root / "modules/freed-protection/android/build/tmp/kotlin-classes/release"
    classpath = [Path.home() / "Library/Android/sdk/platforms/android-36/android.jar", previous,
                 root / ".superpowers/android-candidate-20261005/workspace/modules/freed-protection/android/build/intermediates/compile_r_class_jar/release/generateReleaseRFile/R.jar"]
    cache = root / ".superpowers/android-current4-20261006"
    paths = [p for p in cache.rglob("*") if p.suffix in (".aar", ".jar")
             and "verified-dependency-repository" not in str(p) and "workspace" not in str(p)]
    for index, path in enumerate(paths):
        if path.suffix == ".jar":
            classpath.append(path)
        else:
            with zipfile.ZipFile(path) as archive:
                for name in archive.namelist():
                    if name == "classes.jar" or (name.startswith("libs/") and name.endswith(".jar")):
                        extracted = workspace / (str(index) + "-" + name.replace("/", "-"))
                        extracted.write_bytes(archive.read(name))
                        classpath.append(extracted)
    classpath.append(root / "node_modules/expo-modules-core/android/build/intermediates/runtime_library_classes_jar/release/bundleLibRuntimeToJarRelease/classes.jar")
    # This unchanged helper is already compiled locally and requires unavailable OkHttp compile artifacts.
    files = [p for p in (root / "modules/freed-protection/android/src/main/java/app/freed/protection").glob("*.kt")
             if p.name != "FreedEncryptedDnsUpstream.kt"]
    output = root / (".superpowers/sdd/2026-10-08-challenge-earned-time-v2/android-native-evidence/sdk-classes" + run_suffix)
    result = subprocess.run(["kotlinc", *map(str, files), "-jvm-target", "17", "-classpath",
                             ":".join(map(str, classpath)), "-Xfriend-paths=" + str(previous), "-d", str(output)],
                            cwd=root, capture_output=True, text=True)
    log = output.parent / ("sdk-compile" + run_suffix + ".log")
    log.write_text(result.stdout + result.stderr)
    print(f"sources={len(files)} realSDK=36 cachedClasspathEntries={len(classpath)} unchangedBinaryDependency=FreedEncryptedDnsUpstream")
    print(result.stdout + result.stderr)
    raise SystemExit(result.returncode)
finally:
    shutil.rmtree(workspace)
