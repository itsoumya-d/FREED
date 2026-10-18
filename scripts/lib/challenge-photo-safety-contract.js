const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const ts = require('typescript');

// These are source invariants, not a calibration or device-performance receipt.
const PHOTO_SOURCE_PATHS = {
  app: 'src/features/freed-app.tsx', hook: 'src/hooks/useChallengeVerification.ts',
  runtime: 'src/lib/challenge-verification-runtime.ts', files: 'src/lib/challenge-photo-files.ts',
  store: 'src/lib/challenge-photo-owned-store.ts', contract: 'src/lib/challenge-photo-contract.ts',
  rules: 'src/lib/challenge-rules.ts', verification: 'src/lib/challenge-verification.ts',
  capability: 'src/lib/challenge-capability.ts', bridge: 'modules/freed-protection/src/index.ts',
  iosBridge: 'modules/freed-protection/ios/FreedProtectionModule.swift',
  androidBridge: 'modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt',
  iosPipeline: 'modules/freed-protection/ios/FreedChallengePhotoPipeline.swift',
  androidPipeline: 'modules/freed-protection/android/src/main/java/app/freed/protection/FreedChallengePhotoPipeline.kt',
  iosGate: 'modules/freed-protection/ios/FreedPhotoOperationGate.swift',
  androidGate: 'modules/freed-protection/android/src/main/java/app/freed/protection/FreedPhotoOperationGate.kt',
  iosMatching: 'modules/freed-protection/ios/FreedPhotoTargetMatching.swift',
  androidMatching: 'modules/freed-protection/android/src/main/java/app/freed/protection/FreedPhotoTargetMatching.kt',
  accessibility: 'modules/freed-protection/android/src/main/java/app/freed/protection/FreedAccessibilityService.kt',
  vpn: 'modules/freed-protection/android/src/main/java/app/freed/protection/FreedVpnService.kt',
  deviceActivity: 'ios/FREEDDeviceActivityMonitor/DeviceActivityMonitorExtension.swift',
  safari: 'ios/FREEDSafariContentBlocker/ContentBlockerRequestHandler.swift',
  safariBackground: 'ios/FREEDSafariFocusShield/background.js', safariContent: 'ios/FREEDSafariFocusShield/content.js',
  earnedHook: 'src/hooks/useEarnedChallengeEvidence.ts', earnedController: 'src/lib/earned-challenge-controller.ts',
  earnedTemplates: 'src/lib/earned-reset-templates.ts',
  iosEarnedCamera: 'modules/freed-protection/ios/FreedChallengeNativeCamera.swift',
  iosEarnedPolicy: 'modules/freed-protection/ios/FreedChallengeEvidencePolicy.swift',
  androidEarnedController: 'modules/freed-protection/android/src/main/java/app/freed/protection/FreedEarnedChallengeEvidenceController.kt',
  androidEarnedPipeline: 'modules/freed-protection/android/src/main/java/app/freed/protection/FreedEarnedChallengePhotoPipeline.kt',
  androidEarnedCamera: 'modules/freed-protection/android/src/main/java/app/freed/protection/FreedEarnedChallengeCaptureActivity.kt',
  androidEarnedEvaluation: 'modules/freed-protection/android/src/main/java/app/freed/protection/FreedEarnedChallengePhotoEvaluation.kt',
};
function readChallengePhotoSafetySources(root = process.cwd()) {
  return Object.fromEntries(Object.entries(PHOTO_SOURCE_PATHS).map(([key, path]) => [key, readFileSync(join(root, path), 'utf8')]));
}
const parse = (source,file='contract.tsx') => ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
function nodes(root, predicate) {
  const result = []; const visit = n => { if (predicate(n)) result.push(n); ts.forEachChild(n, visit); }; visit(root); return result;
}
const compact = source => source.replace(/\s+/g, '');
const print = node => node ? ts.createPrinter({ removeComments: true }).printNode(ts.EmitHint.Unspecified, node, node.getSourceFile()) : '';
const has = (source, pieces) => pieces.every(piece => compact(source).includes(compact(piece)));
function fn(ast, name) {
  const found = nodes(ast, n => ts.isFunctionDeclaration(n) && n.name?.text === name && n.body);
  return found.length === 1 ? found[0] : null;
}
function imported(ast, name, path) {
  return ast.statements.some(n => ts.isImportDeclaration(n) && n.moduleSpecifier.text === path && !n.importClause?.isTypeOnly &&
    n.importClause?.namedBindings && ts.isNamedImports(n.importClause.namedBindings) && n.importClause.namedBindings.elements.some(e => !e.isTypeOnly && e.name.text === name && (e.propertyName?.text ?? e.name.text) === name)) &&
    !nodes(ast, n => (ts.isParameter(n) || ts.isVariableDeclaration(n) || ts.isFunctionDeclaration(n)) && n.name?.getText() === name).length;
}
function hookReturnsCapture(ast, declaration) {
  const hook = fn(ast, 'useChallengeVerification');
  if (!hook || !ast.statements.includes(hook) || !hook.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) || !declaration) return false;
  const statement = declaration.parent?.parent;
  if (!statement || !ts.isVariableStatement(statement) || statement.parent !== hook.body || !(statement.declarationList.flags & ts.NodeFlags.Const)) return false;
  if (hook.parameters.some(p => nodes(p, n => ts.isIdentifier(n) && n.text === 'capturePhoto').length)) return false;
  const returns = nodes(hook, ts.isReturnStatement).filter(node => {
    let owner = node.parent; while (owner && !ts.isFunctionLike(owner)) owner = owner.parent;
    return owner === hook;
  });
  if (returns.length !== 1 || returns[0] !== hook.body.statements.at(-1) || !returns[0].expression || !ts.isObjectLiteralExpression(returns[0].expression)) return false;
  const properties = returns[0].expression.properties;
  if (properties.some(p => ts.isSpreadAssignment(p) || !p.name || !(ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)))) return false;
  const names = properties.map(p => p.name.text);
  if (new Set(names).size !== names.length) return false;
  const property = properties.find(p => p.name.text === 'capturePhoto');
  return Boolean(property && ((ts.isShorthandPropertyAssignment(property) && !property.objectAssignmentInitializer) ||
    (ts.isPropertyAssignment(property) && ts.isIdentifier(property.initializer) && property.initializer.text === 'capturePhoto')));
}
function directConst(owner, name) {
  const bindings=nodes(owner,n=>ts.isVariableDeclaration(n)&&n.name.getText()===name);
  if(bindings.length!==1)return null;
  const binding=bindings[0],statement=binding.parent?.parent;
  return statement&&ts.isVariableStatement(statement)&&statement.parent===owner.body&&(statement.declarationList.flags&ts.NodeFlags.Const)?binding:null;
}
function namedHookBinding(owner,name,hook) {
  const binding=directConst(owner,name),call=binding?.initializer;
  return call&&ts.isCallExpression(call)&&call.expression.getText()===hook?binding:null;
}
/** Inspect the selected adapter instead of accepting an arbitrary object with a capture property. */
function reviewedCaptureSelection(owner,binding,appAst) {
  const expression=binding.initializer;
  if(ts.isCallExpression(expression)&&expression.expression.getText()==='useChallengeVerification')return true;
  if(!ts.isConditionalExpression(expression)||expression.condition.getText()!=='nativeVerification.enabled'||!ts.isIdentifier(expression.whenFalse)||expression.whenFalse.text!=='basicVerification'||!ts.isObjectLiteralExpression(expression.whenTrue))return false;
  const basic=namedHookBinding(owner,'basicVerification','useChallengeVerification');
  const native=namedHookBinding(owner,'nativeVerification','useEarnedChallengeEvidence');
  if(!basic||!native||!imported(appAst,'useEarnedChallengeEvidence','@/hooks/useEarnedChallengeEvidence')||!has(print(basic.initializer),['!nativeVerification.enabled']))return false;
  const properties=expression.whenTrue.properties;
  if(properties.length!==6||!ts.isSpreadAssignment(properties[0])||properties[0].expression.getText()!=='basicVerification')return false;
  const expected={status:'nativeVerification.status',progress:'nativeVerification.progress',satisfied:'nativeVerification.satisfied',photoBusy:'nativeVerification.busy',capturePhoto:'nativeVerification.capturePhoto'};
  const fields=properties.slice(1);
  return new Set(fields.map(property=>property.name?.getText())).size===fields.length&&fields.every(property=>ts.isPropertyAssignment(property)&&Object.hasOwn(expected,property.name.getText())&&property.initializer.getText()===expected[property.name.getText()]);
}
function nativeBlock(source,pattern) {
  const match=source.match(pattern);if(!match)return '';
  const start=source.indexOf('{',match.index);if(start<0)return '';
  let depth=0,quoted=false,escaped=false;
  for(let index=start;index<source.length;index++){
    const char=source[index];
    if(quoted){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')quoted=false;continue;}
    if(char==='"')quoted=true;else if(char==='{')depth++;else if(char==='}'&&--depth===0)return source.slice(match.index,index+1);
  }
  return '';
}
// Preserve quoted URLs while dropping native/JS comments: comments never prove wiring.
function uncomment(source) {
  return source.replace(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (whole, quoted) => quoted || '');
}
function nativePhotoBlocks(source) {
  const blocks = [];
  for (const match of source.matchAll(/AsyncFunction\("(?:getChallengePhotoCapabilities|classifyChallengePhoto|cancelChallengePhoto)"\)/g)) {
    let insideString = false, escape = false;
    for (let index = 0; index < match.index; index++) {
      const char = source[index];
      if (insideString) { if (escape) escape = false; else if (char === '\\') escape = true; else if (char === '"') insideString = false; }
      else if (char === '"') insideString = true;
    }
    if (insideString) continue;
    const start = source.indexOf('{', match.index); if (start < 0) continue;
    let depth = 0, quoted = false, escaped = false;
    for (let index = start; index < source.length; index++) {
      const char = source[index];
      if (quoted) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === '"') quoted = false; continue; }
      if (char === '"') quoted = true;
      else if (char === '{') depth++;
      else if (char === '}' && --depth === 0) { blocks.push(source.slice(match.index,index+1)); break; }
    }
  }
  return blocks.join('\n');
}
function reviewedNativePhotoDelegation(source, platform) {
  // The bridges have no photo-private helper call graph: only these reviewed SDK
  // availability probes and direct delegation are admitted. Any added helper,
  // alias, closure or side-effect statement needs review before source approval.
  // Unrelated DNS/network methods elsewhere in the module are outside this check.
  const expected = platform === 'ios' ? `
    AsyncFunction("getChallengePhotoCapabilities") { () -> [String: Any] in
      #if canImport(UIKit)
      return self.photoPipeline.capabilities(cameraAvailable: UIImagePickerController.isSourceTypeAvailable(.camera))
      #else
      return self.photoPipeline.capabilities(cameraAvailable: false)
      #endif
    }
    AsyncFunction("classifyChallengePhoto") { (uri: String, expectedLabels: [String], operationId: String, promise: Promise) in
      self.photoPipeline.classify(uri: uri, expectedLabels: expectedLabels, operationId: operationId, promise: promise)
    }
    AsyncFunction("cancelChallengePhoto") { (operationId: String) -> Bool in
      self.photoPipeline.cancel(operationId)
    }` : `
    AsyncFunction("getChallengePhotoCapabilities") {
      val context = appContext.reactContext
      photoPipeline.capabilities(context?.packageManager?.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY) == true)
    }
    AsyncFunction("classifyChallengePhoto") { uri: String, expectedLabels: List<String>, operationId: String, promise: Promise ->
      photoPipeline.classify(appContext.reactContext, uri, expectedLabels, operationId, promise)
    }
    AsyncFunction("cancelChallengePhoto") { operationId: String -> photoPipeline.cancel(operationId) }`;
  return compact(nativePhotoBlocks(source)) === compact(expected);
}
const SCREEN_APIS = /MediaProjection|ScreenshotResult|takeScreenshot|PixelCopy|ScreenCapture(?:Kit)?|VNRecognizeTextRequest|TextRecognition|TextRecognizer|ImageAnalysis|UIGraphicsImageRenderer|captureRef|takeSnapshotAsync/;
const CLASSIFIER_APIS = /VNClassifyImageRequest|ImageLabeling|getClient\(ImageLabeler|InputImage|classifyChallengePhoto|photoPipeline|FreedChallengePhotoPipeline/;
const PHOTO_EXTERNAL_APIS = /launchImageLibraryAsync|requestMediaLibraryPermissions|base64\s*:\s*true|exif\s*:\s*true|base64EncodedString|Base64|\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|https?:\/\/|URLSession|HttpURLConnection|OkHttp|Firebase|uploadBytes|uploadFile|FormData|AsyncStorage|SecureStore|WorkManager|BGTask|setInterval\s*\(/;

function earnedPhotoSourceChecks(ast,text,native) {
  const hook=fn(ast.earnedHook,'useEarnedChallengeEvidence');
  const capture=hook&&directConst(hook,'capturePhoto');
  const factory=hook?nodes(hook,node=>ts.isCallExpression(node)&&node.expression.getText()==='createEarnedChallengeEvidenceController'):[];
  const options=factory.length===1&&factory[0].arguments[0];
  const hookReturns=hook?nodes(hook,ts.isReturnStatement).filter(node=>{let owner=node.parent;while(owner&&!ts.isFunctionLike(owner))owner=owner.parent;return owner===hook}):[];
  const returned=hookReturns.length===1&&hookReturns[0].expression;
  const properties=returned&&ts.isObjectLiteralExpression(returned)?returned.properties:[];
  const captureIndex=properties.findIndex(property=>ts.isShorthandPropertyAssignment(property)&&property.name.text==='capturePhoto');
  const noOverride=captureIndex>=0&&!properties.slice(captureIndex+1).some(property=>ts.isSpreadAssignment(property)||property.name?.getText()==='capturePhoto');
  const callback=capture?.initializer;
  const captureBody=callback&&ts.isCallExpression(callback)&&callback.expression.getText()==='React.useCallback'&&ts.isArrowFunction(callback.arguments[0])?print(callback.arguments[0].body):'';
  const controller=fn(ast.earnedController,'createEarnedChallengeEvidenceController');
  const factoryBody=print(controller);
  const publish=controller&&directConst(controller,'publish');
  const publishBody=publish?.initializer&&ts.isArrowFunction(publish.initializer)?print(publish.initializer.body):'';
  const methods=['beginEarnedChallengeEvidence','setEarnedChallengeEvidencePhase','getEarnedChallengeEvidence','finishEarnedChallengeEvidence','captureEarnedChallengePhoto','isEarnedChallengeEvidenceAvailable'];
  const cleanOptions=options&&ts.isObjectLiteralExpression(options)&&!options.properties.some(ts.isSpreadAssignment)&&new Set(options.properties.map(property=>property.name?.getText())).size===options.properties.length;
  const forward=nodes(ast.bridge,node=>ts.isVariableDeclaration(node)&&node.name.getText()==='captureEarnedChallengePhoto');
  const bridge=print(fn(ast.bridge,'readOrChangeEarnedEvidence'))+'\n'+(forward.length===1?print(forward[0]):'')+'\n'+print(fn(ast.bridge,'verifyEarnedChallengePhoto'));
  const iosCapture=nativeBlock(native.iosBridge,/\bfunc captureEarnedChallengePhoto\([^\n]+/);
  const iosCancel=nativeBlock(native.iosBridge,/\bfunc cancelEarnedChallengeCapture\([^\n]+/);
  // A single reviewed read-only interval refreshes native evidence. It never
  // calls a camera or classifier; all other intervals remain denied below.
  const poll='const timer = setInterval(refresh, 1000);';
  const hookBoundary=text.earnedHook.replace(poll,'');
  const boundary=[hookBoundary,text.earnedController,text.earnedTemplates,bridge,iosCapture,iosCancel,native.iosEarnedCamera,native.iosEarnedPolicy,native.androidEarnedController,native.androidEarnedPipeline,native.androidEarnedCamera,native.androidEarnedEvaluation].join('\n');
  const nativeImports={
    iosEarnedCamera:['Foundation','UIKit','AVFoundation'],iosEarnedPolicy:['Foundation','CryptoKit','Vision'],
    androidEarnedPipeline:['android.app.Activity','android.content.Context','android.content.Intent','android.net.Uri','androidx.core.content.FileProvider','com.google.mlkit.vision.common.InputImage','com.google.mlkit.vision.label.ImageLabeling','com.google.mlkit.vision.label.defaults.ImageLabelerOptions','java.io.File','java.security.MessageDigest','java.util.concurrent.Executors','java.util.concurrent.TimeUnit'],
    androidEarnedCamera:['android.app.Activity','android.content.Intent','android.os.Bundle'],
  };
  const reviewedImports=Object.entries(nativeImports).every(([key,allowed])=>[...native[key].matchAll(/^import\s+([\w.]+)/gm)].every(match=>allowed.includes(match[1])));
  const calls=source=>[...source.replace(/"(?:\\.|[^"\\])*"/g,'').matchAll(/([A-Za-z_][\w.]*)\s*\(/g)].map(match=>match[1]);
  const allowedIosCapture=new Set(['captureEarnedChallengePhoto','available','FreedChallengeEvidenceReceipt.photo','FreedAppGroupsRuntime.shared.prepareEarnedChallengePhotoCapture','challengeCamera.capture','FreedChallengeOwnedCaptureFiles.remove','withCheckedContinuation','photoPipeline.classifyNativeCapture','continuation.resume','FreedAppGroupsRuntime.shared.completeEarnedChallengePhoto']);
  const allowedIosCancel=new Set(['cancelEarnedChallengeCapture','challengeCamera.cancel','photoPipeline.cancel']);
  return {
    earnedCaptureWiring:Boolean(hook&&noOverride&&captureBody&&cleanOptions&&
      imported(ast.earnedHook,'createEarnedChallengeEvidenceController','../lib/earned-challenge-controller')&&imported(ast.earnedHook,'randomUUID','expo-crypto')&&
      methods.every(method=>imported(ast.earnedHook,method,'freed-protection'))&&
      has(print(options),['isCurrent:current','begin:beginEarnedChallengeEvidence','read:getEarnedChallengeEvidence','phase:setEarnedChallengeEvidencePhase','finish:finishEarnedChallengeEvidence','capture:captureEarnedChallengePhoto','createCaptureId:randomUUID'])&&
      has(captureBody,['if (!current || !next || photoBusy.current) return;','photoBusy.current = true;','await current.capture(next)','finally { photoBusy.current = false; void current.refresh(); }'])&&
      nodes(ast.earnedHook,node=>ts.isCallExpression(node)&&/\.capture$/.test(node.expression.getText())).length===1),
    earnedNativeScopeAndReceipts:has(text.earnedHook,['latest.current.isCurrent?.() === true','latest.current.session?.id === input.session!.id','latest.current.session.challenge.id === input.session!.challenge.id','latest.current.offer?.offerId === input.offer!.offerId','latest.current.ownerScope === input.ownerScope','if (!photoBusy.current) void next.refresh();','next.dispose();','clearInterval(timer);'])&&
      imported(ast.earnedController,'nativeEarnedEvidenceMatches','./challenge-session')&&has(publishBody,['if (!current()) return false;','nativeEarnedEvidenceMatches(receipt, options.offer, options.session, false)'])&&
      has(factoryBody,['native.phase !== \'active\'','requirement?.method !== \'photo\'','!requirement.targetIds.includes(targetId as never)','native.matchedTargetIds.includes(targetId)','captureOperationId: options.createCaptureId()','options.ownerScope, native, options.offer','return publish(receipt) ? receipt : null;'])&&
      has(bridge,['isEarnedChallengeEvidenceSession(session, offer, begin)','request.evidenceSessionId !== session.evidenceSessionId','isEarnedChallengePhotoCaptureRequest(request)','validateEarnedChallengeEvidenceReceipt(raw, offer, begin, session)',"unavailableEarnedChallengeEvidence('earned-photo-native-capture-required'"] ),
    earnedNativeOwnershipAndCleanup:has(native.iosEarnedCamera,['continuation == nil','UIApplication.shared.applicationState == .active','FreedChallengeOwnedCaptureFiles.cleanupAbandoned()','picker.sourceType = .camera','picker.allowsEditing = false','image.jpegData(compressionQuality: 0.9)','FreedChallengeOwnedCaptureFiles.save(bytes, operationId: operationId','UIApplication.didEnterBackgroundNotification','self?.cancel()'])&&
      has(native.iosEarnedPolicy,['files.count <= 128','bytes.count <= 20*1024*1024','options: [.atomic, .completeFileProtection]','capture.url.deletingLastPathComponent() == nativeDirectory','FileManager.default.removeItem(at: capture.url)'])&&
      has(iosCapture,['prepareEarnedChallengePhotoCapture(request, scope)','earnedPhotoOperationId == nil','earnedPhotoOperationId == operation','!Task.isCancelled','guard FreedChallengeOwnedCaptureFiles.remove(capture) else','classifyNativeCapture(capture, targetId: target','completeEarnedChallengePhoto(request, scope, capture: capture, classification: classification)'])&&
      has(native.androidEarnedPipeline,['operation != null','usedIds.size >= 128','!usedIds.add(id)','!cleanup(context)','context.cacheDir','file.createNewFile()','FileProvider.getUriForFile','!activity.hasWindowFocus()','active.cameraDeadline = deadlines.schedule','120, TimeUnit.SECONDS','8, TimeUnit.SECONDS','active.file.delete() || !active.file.exists()','if (deleted && revoked) outcome else "unavailable"','if (deleted && revoked) digest else null','active.cancelled || !active.current()','classifier.close()'])&&
      [nativeBlock(native.androidEarnedPipeline,/\bfun complete\(/),nativeBlock(native.androidEarnedPipeline,/\bfun cancelOperation\(/)].every(body=>has(body,['val revoked = revoke(active)','val deleted = active.file.delete() || !active.file.exists()','if (deleted && revoked) outcome else "unavailable"']))&&
      has(native.androidEarnedCamera,['FreedEarnedChallengeProofPolicy.validId(id)','FreedEarnedChallengePhotoPipeline.cameraIntent(id!!)','resultCode == RESULT_OK','FreedEarnedChallengePhotoPipeline.cameraResult(it, accepted)','FreedEarnedChallengePhotoPipeline::abandonCamera']),
    earnedTargetsRemainUnvalidated:has(native.iosEarnedPolicy,['static let reviewedEvaluations:[FreedChallengePhotoEvaluation]=[]'])&&has(native.androidEarnedEvaluation,['val reviewedTargetIds: List<String> = emptyList()'])&&
      has(text.earnedTemplates,['offer.supportedPhotoTargetIds?.includes(id)','offer.requiredDistinctPhotoTargets'])&&
      has(native.androidEarnedController,['target !in FreedEarnedChallengePhotoEvaluation.reviewedTargetIds']),
    earnedExactTargetProof:has(native.iosPipeline,['expectedLabels:FreedChallengePhotoCatalog.labels[targetId] ?? []'])&&
      has(native.androidEarnedPipeline,['label.confidence >= 0.65f','FreedPhotoTargetMatching.matches(label.text, it)']),
    earnedNoPhotoExternalFallback:Boolean(iosCapture&&iosCancel&&reviewedImports&&calls(iosCapture).every(call=>allowedIosCapture.has(call))&&calls(iosCancel).every(call=>allowedIosCancel.has(call))&&!PHOTO_EXTERNAL_APIS.test(boundary)),
    earnedPhotoBoundary:boundary,
  };
}

function inspectChallengePhotoSafety(sources) {
  const ast = Object.fromEntries(['app','hook','runtime','files','store','contract','rules','verification','capability','bridge','earnedHook','earnedController','earnedTemplates'].map(key => [key, parse(sources[key] || '',PHOTO_SOURCE_PATHS[key])]));
  const text = Object.fromEntries(Object.entries(ast).map(([key, value]) => [key, print(value)]));
  const native = Object.fromEntries(['iosBridge','androidBridge','iosPipeline','androidPipeline','iosGate','androidGate','iosMatching','androidMatching','iosEarnedCamera','iosEarnedPolicy','androidEarnedController','androidEarnedPipeline','androidEarnedCamera','androidEarnedEvaluation'].map(key => [key, uncomment(sources[key] || '')]));
  const captureDeclarations = nodes(ast.hook, n => ts.isVariableDeclaration(n) && n.name.getText() === 'capturePhoto');
  const callback = captureDeclarations.length === 1 && captureDeclarations[0].initializer;
  const capture = callback && ts.isCallExpression(callback) && callback.expression.getText() === 'React.useCallback' && callback.arguments[0];
  const captureText = capture && ts.isArrowFunction(capture) ? print(capture.body) : '';
  const calls = nodes(ast.app, n => ts.isCallExpression(n) && n.expression.getText() === 'verification.capturePhoto');
  const button = calls.length === 1 && (() => {
    let n = calls[0]; while (n && !ts.isJsxAttribute(n)) n = n.parent;
    if (!n || n.name.getText() !== 'onPress' || !ts.isJsxOpeningElement(n.parent.parent)) return false;
    if (nodes(n, child => (ts.isVariableDeclaration(child) || ts.isParameter(child) || ts.isBindingElement(child)) && child.name?.getText() === 'verification').length) return false;
    let parent = n.parent.parent.parent; let returned = false;
    while (parent && !ts.isFunctionDeclaration(parent)) {
      if (ts.isVariableDeclaration(parent) || ts.isArrowFunction(parent)) return false;
      if (ts.isReturnStatement(parent)) returned = true;
      parent = parent.parent;
    }
    if (!returned || !parent?.body || parent.parameters.some(p => nodes(p,n => ts.isIdentifier(n) && n.text === 'verification').length)) return false;
    const declarations = nodes(parent, n => ts.isVariableDeclaration(n) && n.name.getText() === 'verification');
    if (declarations.length !== 1) return false;
    if (nodes(parent, n => ts.isBinaryExpression(n) && n.left.getText() === 'verification.capturePhoto' &&
      n.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && n.operatorToken.kind <= ts.SyntaxKind.LastAssignment).length) return false;
    const binding = declarations[0], statement = binding.parent?.parent;
    return Boolean(statement && ts.isVariableStatement(statement) && statement.parent === parent.body && (statement.declarationList.flags & ts.NodeFlags.Const) &&
      binding.initializer && reviewedCaptureSelection(parent,binding,ast.app));
  })();
  const run = print(fn(ast.runtime, 'runChallengePhotoCapture'));
  const prepare = print(fn(ast.files, 'prepareTemporaryChallengePhotoCapture'));
  const adopt = print(fn(ast.files, 'adoptTemporaryChallengePhoto'));
  const owned = print(fn(ast.files, 'ownedStore'));
  const store = print(fn(ast.store, 'createChallengePhotoOwnedStore'));
  const runtimeImport = imported(ast.hook, 'runChallengePhotoCapture', '../lib/challenge-verification-runtime');
  const optionsCalls = capture ? nodes(capture, n => ts.isCallExpression(n) && n.expression.getText() === 'runChallengePhotoCapture') : [];
  const options = optionsCalls.length === 1 && optionsCalls[0].arguments[0];
  const bindings = options && ts.isObjectLiteralExpression(options) && !options.properties.some(ts.isSpreadAssignment) &&
    new Set(options.properties.map(p => p.name?.getText())).size === options.properties.length && ['getCapabilities:getChallengePhotoCapabilities','preparePhotoCapture:prepareTemporaryChallengePhotoCapture',
    'adoptPhoto:adoptTemporaryChallengePhoto','classifyPhoto:classifyChallengePhoto','cancelPhoto:cancelChallengePhoto','deletePhoto:deleteTemporaryChallengePhoto','signal:operation.abort.signal','isCurrent:fence.isCurrent'].every(piece => has(print(options), [piece]));
  const nativeBridgePhoto = Object.values(native).join('\n');
  const bridgePhoto = ['getChallengePhotoCapabilities','classifyChallengePhoto','cancelChallengePhoto'].map(name => print(fn(ast.bridge, name))).join('\n');
  const photoBoundary = [text.hook,text.runtime,text.files,text.store,text.contract,text.rules,text.verification,text.capability,bridgePhoto,
    nativePhotoBlocks(native.iosBridge),nativePhotoBlocks(native.androidBridge),native.iosPipeline,native.androidPipeline,native.iosGate,native.androidGate,native.iosMatching,native.androidMatching].join('\n');
  const protection = ['accessibility','vpn','deviceActivity','safari','safariBackground','safariContent'].map(key => uncomment(sources[key] || '')).join('\n');
  const earned=earnedPhotoSourceChecks(ast,text,native);
  return {
    ...Object.fromEntries(Object.entries(earned).filter(([key])=>key!=='earnedPhotoBoundary')),
    parsed: Object.values(ast).every(tree => tree.parseDiagnostics.length === 0),
    knownPhotoImports: Object.entries({
      hook: ['react','react-native','../lib/challenge-photo-files','expo-image-picker','expo-location','expo-sensors','freed-protection','../lib/challenge-verification','../lib/challenge-verification-runtime'],
      runtime: ['./challenge-photo-contract','./challenge-verification'], files: ['expo-file-system','./challenge-photo-owned-store'],
      store: [], contract: ['./challenge-rules'], rules: [], verification: ['./challenge-rules'],
      earnedHook:['react','react-native','expo-crypto','expo-sensors','expo-image-picker','freed-protection','../lib/earned-challenge-controller','../lib/earned-reset-templates','../i18n/runtime'],
      earnedController:['./challenge-session','./earned-reset-templates','../../modules/freed-protection/src/earned-challenge-evidence'],
      earnedTemplates:['../data/momentum-resets','./challenge-rules','../../modules/freed-protection/src/earned-app-time'],
    }).every(([key, allowed]) => ast[key].statements.filter(n => ts.isImportDeclaration(n) && !n.importClause?.isTypeOnly).every(n => allowed.includes(n.moduleSpecifier.text))),
    userCaptureWiring: Boolean(button && hookReturnsCapture(ast.hook, captureDeclarations[0]) && imported(ast.app,'useChallengeVerification','@/hooks/useChallengeVerification') && runtimeImport && bindings &&
      ['adoptTemporaryChallengePhoto','deleteTemporaryChallengePhoto','prepareTemporaryChallengePhotoCapture'].every(name => imported(ast.hook,name,'../lib/challenge-photo-files')) &&
      ['classifyChallengePhoto','cancelChallengePhoto','getChallengePhotoCapabilities'].every(name => imported(ast.hook,name,'freed-protection')) &&
      ast.hook.statements.some(n => ts.isImportDeclaration(n) && n.moduleSpecifier.text === 'expo-image-picker' && n.importClause?.namedBindings?.name?.text === 'ImagePicker') &&
      has(captureText,['if (!effectiveActive || completed || requirement?.kind !== "photo" || photoOperationRef.current) return;',
        'if (!fence.isCurrent()) return;','if (expectedLabels.length === 0)', 'photoOperationRef.current = operation;',
        'ImagePicker.requestCameraPermissionsAsync()', 'launchCamera: () => ImagePicker.launchCameraAsync({allowsEditing:false,base64:false,exif:false,mediaTypes:["images"],quality:0.72})',
        'if (photoOperationRef.current === operation)', 'photoMatched: classification.available && classification.matched', 'photoLabels: [...classification.matchedLabels]']) &&
      nodes(ast.hook,n => ts.isCallExpression(n) && n.expression.getText() === 'ImagePicker.launchCameraAsync').length === 1 &&
      has(text.hook,['photoOperationRef.current?.abort.abort()','photoOperationRef.current.abort.abort()'])),
    runtimeReturnsActualWork: (() => {
      const runner = fn(ast.runtime,'runChallengePhotoCapture');
      if (!runner || runner.body.statements.length !== 11 || !ts.isIfStatement(runner.body.statements[0]) || !ts.isIfStatement(runner.body.statements[1])) return false;
      const work = runner.body.statements[8];
      const initializer = ts.isVariableStatement(work) && work.declarationList.declarations.length === 1 && work.declarationList.declarations[0].name.getText() === 'work' && work.declarationList.declarations[0].initializer;
      if (!initializer || !ts.isCallExpression(initializer) || !ts.isParenthesizedExpression(initializer.expression) || !ts.isArrowFunction(initializer.expression.expression) || !ts.isBlock(initializer.expression.expression.body)) return false;
      const last = runner.body.statements[10];
      return ts.isTryStatement(last) && last.tryBlock.statements.length === 1 && ts.isReturnStatement(last.tryBlock.statements[0]) && compact(last.tryBlock.statements[0].getText()) === 'returnawaitPromise.race([work,cancelled]);';
    })(),
    admissionBeforeCamera: has(run,['if (captureAuthority)', 'const authority = {}; captureAuthority = authority;',
      'if (!capabilities.cameraAvailable || !capabilities.classifierAvailable)', 'storageReady = typeof options.preparePhotoCapture === \'function\' && await options.preparePhotoCapture();',
      'if (!storageReady)', 'const permission = await options.requestPermission();','const result = await options.launchCamera();']) &&
      run.indexOf('await options.preparePhotoCapture()') < run.indexOf('await options.requestPermission()') &&
      run.indexOf('await options.requestPermission()') < run.indexOf('await options.launchCamera()') &&
      has(prepare,['cleanupAbandonedChallengePhotos()', 'if (retryCapacityExceeded || initializationRetries.size || cleanup.metadataUnavailable) return false;', 'return ownedStore().prepareForCapture();']),
    freshCaptureOwnership: has(print(fn(ast.store,'isFreshChallengeCameraUri')),["return isDirectPhotoChild(uri, cacheUri.replace(/\\/$/, '') + '/ImagePicker/');"]) &&
      has(print(fn(ast.store,'isDirectPhotoChild')),['uri.startsWith(prefix)', '/^[A-Za-z0-9_-]+\\.(?:jpg|jpeg|png|heic)$/i.test(uri.slice(prefix.length))']) &&
      has(store,["const root = cacheUri.replace(/\\/$/, '') + '/freed-challenge-photos-v1/';",'const valid = (uri: string) => isDirectPhotoChild(uri, root) || isFreshChallengeCameraUri(cacheUri, uri);',
        'if (retained.length > maxRetained && retained.some(uri => !previous.includes(uri)))', 'if (retained.length <= maxRetained)',
        "if (!isFreshChallengeCameraUri(cacheUri, uri)) throw Error('Camera returned a file outside the app-owned camera cache.')"]) &&
      has(print(fn(ast.files,'removeProvenFreshOriginal')),['if (!isFreshChallengeCameraUri(Paths.cache.uri, uri)) return false;',
        'initializationRetries.has(uri) || initializationRetries.size < MAX_INITIALIZATION_RETRIES', 'else retryCapacityExceeded = true;']) &&
      has(owned,["new Directory(Paths.cache, 'freed-challenge-photos-v1')"]),
    ownedCleanup: imported(ast.files,'createChallengePhotoOwnedStore','./challenge-photo-owned-store') && imported(ast.files,'isFreshChallengeCameraUri','./challenge-photo-owned-store') &&
      has(adopt,['if (!isFreshChallengeCameraUri(Paths.cache.uri, uri)) throw', 'retryInitializationCleanup(currentStore, uri);', 'return await currentStore.adopt(uri);','if (!removeProvenFreshOriginal(uri))']) &&
      has(owned,['createChallengePhotoOwnedStore(Paths.cache.uri,', 'listOwned: () => dir.list()', 'new File(source).copy(new File(destination))']) &&
      compact(text.files).split(compact('remaining: Math.max(1, fallbackRemaining)')).length === 3 && has(text.files,['return currentStore.release(uri);','retryInitializationCleanup(currentStore);','metadataUnavailable: true','remaining: Math.max(1, fallbackRemaining)','MAX_INITIALIZATION_RETRIES = 128']) &&
      has(store,['const maxRetained = 128;', 'if (retained.length > maxRetained - 2) return false;', 'save(load());',
        'live.add(uri);', 'live.add(owned);', 'save([...load(), uri, owned]);', 'files.copy(uri, owned);',
        'live.delete(uri);','live.delete(uri); if (valid(uri) && load().includes(uri) && !remove(uri)) throw',
        '.filter(uri => !live.has(uri))', 'outstanding().uris.slice(0, 128)', 'remaining: Math.max(Number(remaining.metadataUnavailable), remaining.uris.length)']) &&
      has(run,['for (const uri of uris)', 'adopted.push(await options.adoptPhoto(uri))', 'if (adoptionFailed)',
        'finally { for (const uri of adopted) { try { await options.deletePhoto(uri); } catch', 'finally { if (captureAuthority === authority) captureAuthority = null; }']),
    deadlineCancellationIdentity: imported(ast.runtime,'samePhotoIdentity','./challenge-photo-contract') &&
      has(run,["abortListener = () => { void Promise.resolve().then(() => options.cancelPhoto(operationId)).catch(() => {}); resolve('cancelled'); };", 'options.signal?.addEventListener(\'abort\', abortListener, {once:true})','options.cancelPhoto(operationId)',
        'options.inferenceTimeoutMs ?? 8500', 'Promise.race([options.classifyPhoto(adopted[0],options.expectedLabels,operationId),deadline,cancelled])',
        'if (!current()) return \'stale\'', 'samePhotoIdentity(parsed.identity,capabilities.identity) ? parsed : unavailablePhoto()',
        'minPhotoConfidence: options.minPhotoConfidence ?? .65','photoLabels:classification.matchedLabels']) &&
      has(bridgePhoto,['!module?.classifyChallengePhoto || !module.cancelChallengePhoto','readPhotoClassification(await module.classifyChallengePhoto(uri,expectedLabels,operationId))','getNativeModule()?.cancelChallengePhoto?.(operationId)']),
    unavailableFailsClosed: imported(ast.bridge,'unavailablePhoto','../../../src/lib/challenge-photo-contract') &&
      has(print(fn(ast.contract,'unavailablePhoto')),['available:false,matched:false,labels:[],matchedLabels:[]','identity:null']) &&
      has(print(fn(ast.contract,'readPhotoIdentity')),["v.ruleRevision !== PHOTO_RULE_REVISION", "v.modelWeightsRevision !== null", "v.provider === 'bundled-mlkit' && v.classifierRevision === 'com.google.mlkit:image-labeling:17.0.9'", "v.provider === 'apple-vision'", 'return null;']) &&
      has(print(fn(ast.contract,'readPhotoClassification')),['if (!identity', 'return unavailablePhoto();', 'observed.has(normalize(x))', "v.available === true && v.matched === true && v.outcome === 'matched' && matchedLabels.length > 0"]),
    nativeDelegation: has(native.iosBridge,['private let photoPipeline = FreedChallengePhotoPipeline()',
      'self.photoPipeline.capabilities(cameraAvailable:', 'self.photoPipeline.classify(uri: uri, expectedLabels: expectedLabels, operationId: operationId, promise: promise)', 'self.photoPipeline.cancel(operationId)']) &&
      /^OnDestroy\{self\.photoPipeline\.destroy\(\)(?:;|\})/.test(compact(nativeBlock(native.iosBridge,/\bOnDestroy\s*/))) &&
      has(native.androidBridge,['private val photoPipeline = FreedChallengePhotoPipeline()', 'photoPipeline.destroy()', 'photoPipeline.capabilities(',
        'photoPipeline.classify(appContext.reactContext, uri, expectedLabels, operationId, promise)', 'AsyncFunction("cancelChallengePhoto") { operationId: String -> photoPipeline.cancel(operationId) }']),
    nativeProviderIdentity: has(native.iosPipeline,['"provider":"apple-vision"', '"classifierRevision":"VNClassifyImageRequest:revision-\\(request.revision)"',
      '"runtimeRevision":"ios-\\(os.majorVersion).\\(os.minorVersion).\\(os.patchVersion)"', '"ruleRevision":"freed-photo-targets-v1"', '"modelWeightsRevision":NSNull()',
      '"identity":identity(request)']) && has(native.androidPipeline,['"provider" to "bundled-mlkit"', '"classifierRevision" to "com.google.mlkit:image-labeling:17.0.9"',
      '"runtimeRevision" to "android-${Build.VERSION.SDK_INT}"', '"ruleRevision" to "freed-photo-targets-v1"', '"modelWeightsRevision" to null', '"identity" to identity()']),
    boundedNativeOwner: has(native.iosPipeline,['private static let physicalGate = FreedPhotoOperationGate<Operation>()', 'private var gate: FreedPhotoOperationGate<Operation> { Self.physicalGate }',
      '!destroyed && gate.start(operationId,', 'asyncAfter(deadline: .now() + 8)', 'defer { gate.drain(operationId) }', 'guard gate.isPublishable(operationId)',
      '$0.ownerId == ownerId && (expectedRequest == nil || $0.request === expectedRequest)', 'operation.request.cancel()', 'gate.invalidate { $0.ownerId == ownerId }', 'VNImageRequestHandler(url: url, options: [:]).perform([request])']) &&
      has(native.androidPipeline,['val physicalGate = FreedPhotoOperationGate<Operation>()', 'private val gate get() = physicalGate', '!destroyed && gate.start(operationId, operation)',
        'deadlines.schedule({ cancel(operationId, "unavailable", operation) }, 8, TimeUnit.SECONDS)', 'if (!gate.isPublishable(operationId))',
        'activeLabeler.process(image)', 'task.addOnCompleteListener(executor)', 'activeLabeler.close(); gate.drain(operationId)',
        'it.ownerId == ownerId && (expected == null || it === expected)', 'gate.invalidate { it.ownerId == ownerId }']) &&
      has(native.iosGate,['guard operation == nil else { return false }','current.id == id, current.publishable, accepting(current.value)','operation?.publishable = false','if operation?.id == id { operation = nil }']) &&
      has(native.androidGate,['if (operation != null) return false','current.id != id || !current.publishable || !accepting(current.value)','current.publishable = false','if (operation?.id == id) operation = null']) &&
      !/Tasks\.await|while\s*\(\s*true\s*\)/.test(native.androidPipeline),
    exactTargetProof: has(text.rules,["flower:['flower','blossom'],plant:['plant'],chair:['chair'],cup:['cup','mug'],shoe:['shoe','sneakers'],branch:['branch'],clock:['clock'],fruit:['fruit']"]) && has(print(fn(ast.verification,'photoLabelMatches')),['return observed === expected;']) &&
      has(native.iosMatching,['actual == target']) && has(native.androidMatching,['actual == target']) &&
      has(native.iosPipeline,['expected.allSatisfy({ label in Self.targets.values.contains { $0.contains(label) } })','FreedPhotoTargetMatching.matches(observed: observed, expected: $0)','observation.confidence >= 0.65']) &&
      has(native.androidPipeline,['expected.any { label -> targets.values.none { it.contains(label) } }', 'FreedPhotoTargetMatching.matches(normalize(label.text), it)','it.confidence >= 0.65f']) &&
      !/return\s+(?:true|observed\.includes|expected\.includes)|actual\.contains|target\.contains/.test([print(fn(ast.verification,'photoLabelMatches')),native.iosMatching,native.androidMatching].join('\n')),
    targetsRemainUnvalidated: has(print(fn(ast.contract,'readPhotoCapabilities')),['validatedPhotoTargets: []']) &&
      has(native.iosPipeline,['"validatedPhotoTargets":[String]()']) && has(native.androidPipeline,['"validatedPhotoTargets" to emptyList<String>()']) &&
      has(print(fn(ast.capability,'getChallengeCapability')),["if (rule?.kind === 'photo' && !capabilities.photo.validatedPhotoTargets?.includes(rule.targetId)) return { eligible: false"]),
    noPhotoExternalFallback: reviewedNativePhotoDelegation(native.iosBridge,'ios') && reviewedNativePhotoDelegation(native.androidBridge,'android') && !PHOTO_EXTERNAL_APIS.test(photoBoundary),
    noScreenshotOrOcr: !SCREEN_APIS.test(photoBoundary + nativeBridgePhoto + protection + earned.earnedPhotoBoundary),
    noProtectionClassification: !CLASSIFIER_APIS.test(protection),
  };
}

function inspectChallengeComfortCopy(catalog, legacy) {
  const records = [...catalog, ...legacy];
  if (!records.length) return false;
  const unsupported = /impossible to fake|cannot be faked|real movement evidence|helps discharge the craving|adrenaline|endorphins|dopamine|BDNF|prefrontal cortex|oxytocin|neurochemistry|alpha state|floods|rewires|craving-incompatible|collapses craving|weakens the loop permanently|fastest known|cannot survive a recipe|medicine that|dive reflex|autonomic|chemistry toward|chemical of craving|physically signals safety|resonance of your heart and brain|explosively|stay submerged|immerse|face into|push through|isometric burn|forcefully/i;
  return records.every(record => {
    if (typeof record.title !== 'string' || typeof record.why !== 'string' || !Array.isArray(record.steps)) return false;
    const display = [record.title, record.why, ...record.steps].join(' ');
    if (unsupported.test(display)) return false;
    if (record.category === 'physical' && ![/optional/i,/comfortable/i,/fewer|seated|quiet/i,/device movement/i,/not .*form|not .*repetitions/i].every(pattern => pattern.test(record.why))) return false;
    if (/^(?:breathing-478|box-breathing|wim-hof-rounds)(?:--|$)/.test(record.id) && ![/optional|if comfortable/i,/skip|switch|another reset/i].every(pattern => pattern.test(display))) return false;
    return true;
  });
}
module.exports = { PHOTO_SOURCE_PATHS, readChallengePhotoSafetySources, inspectChallengePhotoSafety, inspectChallengeComfortCopy };
