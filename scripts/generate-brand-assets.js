#!/usr/bin/env node
// Derive platform resource sizes from the approved generated artwork.
// No prebuild is run: the existing native extensions and signing settings stay intact.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { generateImageAsync } = require('@expo/image-utils');
const root = path.resolve(__dirname, '..');
const outputs = [];
async function image(source, target, size, opaque = false, padding = 0) {
  const result = await generateImageAsync({ projectRoot: root, cacheType: 'freed-brand-v2' }, {
    src: path.join(root, source), width: size, height: size, resizeMode: 'contain',
    name: path.basename(target), backgroundColor: opaque ? '#101319' : 'transparent',
    removeTransparency: opaque, padding
  });
  const destination = path.join(root, target);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, result.source);
  outputs.push({ path: target, width: size, height: size, sha256: crypto.createHash('sha256').update(result.source).digest('hex') });
}
async function main() {
  const originalAssets = ['assets/icon.png', 'assets/adaptive-icon.png', 'assets/splash-icon.png'];
  for (const asset of originalAssets) {
    const backup = path.join(root, 'assets/brand/previous', path.basename(asset));
    if (!fs.existsSync(backup)) { fs.mkdirSync(path.dirname(backup), { recursive: true }); fs.copyFileSync(path.join(root, asset), backup); }
  }
  const icon = 'assets/brand/freed-app-icon-source.png', symbol = 'assets/brand/freed-symbol.png';
  await image(icon, 'assets/icon.png', 1024, true);
  await image(symbol, 'assets/adaptive-icon.png', 1024, false, 64);
  await image(symbol, 'assets/splash-icon.png', 1024);
  await image(icon, 'ios/FREED/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png', 1024, true);
  for (const [density, launcher, splash, foreground] of [['mdpi', 48, 288, 108], ['hdpi', 72, 432, 162], ['xhdpi', 96, 576, 216], ['xxhdpi', 144, 864, 324], ['xxxhdpi', 192, 1152, 432]]) {
    for (const name of ['ic_launcher', 'ic_launcher_round']) {
      const base = `android/app/src/main/res/mipmap-${density}/${name}`;
      await image(icon, `${base}.png`, launcher, true);
      const old = path.join(root, `${base}.webp`);
      if (fs.existsSync(old)) {
        const backup = path.join(root, `assets/brand/previous/android-${density}-${name}.webp`);
        if (!fs.existsSync(backup)) fs.copyFileSync(old, backup);
        fs.unlinkSync(old); // Replacement uses the same Android resource name.
      }
    }
    await image(symbol, `android/app/src/main/res/drawable-${density}/splashscreen_logo.png`, splash);
    await image(symbol, `android/app/src/main/res/drawable-${density}/ic_launcher_foreground.png`, foreground, false, Math.round(foreground * .07));
  }
  for (const [scale, size] of [[1, 112], [2, 224], [3, 336]]) await image(symbol, `ios/FREED/Images.xcassets/SplashScreenLogo.imageset/logo@${scale}x.png`, size);
  const receipt = { generatedAt: new Date().toISOString(), source: { icon, symbol }, outputs };
  const receiptPath = path.join(root, 'assets/brand/platform-assets.json');
  fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
  console.log(`Generated ${outputs.length} native brand resources; receipt assets/brand/platform-assets.json`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
