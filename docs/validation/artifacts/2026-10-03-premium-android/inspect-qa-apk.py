"""Read-only APK provenance and defined-class evidence; does not install an app."""
from pathlib import Path
import datetime
import hashlib
import json
import struct
import sys
import zipfile

APK = Path(sys.argv[1])
OUT = Path(__file__).parent
EXPECTED_BUNDLE = Path('/tmp/freed-premium-android-qa-20261003/assets/index.android.bundle')
EXPECTED_CLASSES = [
    'Lapp/freed/recovery/MainApplication;',
    'Lapp/freed/protection/FreedVpnService;',
    'Lapp/freed/protection/FreedProtectionModule;',
    'Lapp/freed/protection/FreedEncryptedDnsConfig;',
    'Lapp/freed/protection/FreedEncryptedDnsPolicy;',
    'Lapp/freed/protection/FreedEncryptedDnsUpstream;',
    'Lapp/freed/protection/FreedDohPolicy;',
    'Lapp/freed/protection/FreedProtectedSocketFactory;',
    'Lexpo/modules/ui/ExpoUIModule;',
    'Lexpo/modules/localization/LocalizationModule;',
    'Lexpo/modules/kotlin/AppContext;',
    'Lokhttp3/OkHttpClient;',
]


def sha256_file(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def defined_classes(data):
    assert data[:4] == b'dex\n', 'Expected ordinary DEX file'
    word = lambda offset: struct.unpack_from('<I', data, offset)[0]
    assert word(0x28) == 0x12345678, 'Expected little-endian DEX'
    strings, types = word(0x3c), word(0x44)
    count, definitions = word(0x60), word(0x64)
    result = set()
    for index in range(count):
        class_index = word(definitions + index * 32)
        string_index = word(types + class_index * 4)
        offset = word(strings + string_index * 4)
        while data[offset] & 0x80:
            offset += 1
        offset += 1  # Skip the final ULEB128 string-length byte.
        end = data.index(b'\0', offset)
        result.add(data[offset:end].decode('utf-8'))
    return result


with zipfile.ZipFile(APK) as archive:
    names = archive.namelist()
    dex_names = [name for name in names if name.startswith('classes') and name.endswith('.dex')]
    classes = set()
    okhttp_versions = set()
    for name in dex_names:
        data = archive.read(name)
        classes.update(defined_classes(data))
        for version in ['4.9.2', '4.12.0']:
            if ('okhttp/' + version).encode() in data:
                okhttp_versions.add(version)
    bundle = archive.read('assets/index.android.bundle')
    bundle_hash = hashlib.sha256(bundle).hexdigest()
    expected_hash = sha256_file(EXPECTED_BUNDLE) if EXPECTED_BUNDLE.is_file() else None
    presence = {name: name in classes for name in EXPECTED_CLASSES}
    report = {
        'capturedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'apkPath': str(APK.resolve()).replace(str(Path.home()), '~'),
        'apkSha256': sha256_file(APK),
        'apkSizeBytes': APK.stat().st_size,
        'dexFiles': dex_names,
        'definedClassCount': len(classes),
        'definedClasses': presence,
        'nativeAbis': sorted({name.split('/')[1] for name in names if name.startswith('lib/') and name.endswith('.so')}),
        'okHttpVersionLiterals': sorted(okhttp_versions),
        'hasLocaleConfigResource': 'res/xml/locales_config.xml' in names,
        'embeddedBundleSha256': bundle_hash,
        'expectedQaBundleSha256': expected_hash,
        'embeddedBundleMatchesQaBundle': expected_hash is not None and bundle_hash == expected_hash,
        'boundary': 'APK bytes and defined DEX classes only; no runtime, UI, VPN, DNS, or backend execution.',
    }
    report['result'] = 'pass' if all(presence.values()) and report['nativeAbis'] == ['arm64-v8a'] and report['hasLocaleConfigResource'] and report['embeddedBundleMatchesQaBundle'] else 'fail'
    (OUT / 'apk-inspection.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))
    assert report['result'] == 'pass', 'APK inspection requirements were not satisfied'
