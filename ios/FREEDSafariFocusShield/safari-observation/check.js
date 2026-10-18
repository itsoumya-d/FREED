"use strict";
const copy = {
 en: ["Check Safari", "Blocking and recovery remain unverified.", "Checking…", "Configuration check recorded. Return to FREED for details. Blocking and recovery remain unverified.", "Could not confirm this check. Open FREED first, allow Safari access, then try again."],
 hi: ["Safari जाँचें", "ब्लॉकिंग और रिकवरी सत्यापित नहीं हैं।", "जाँच जारी…", "कॉन्फ़िगरेशन जाँच दर्ज हुई। विवरण के लिए FREED लौटें। ब्लॉकिंग और रिकवरी सत्यापित नहीं हैं।", "जाँच की पुष्टि नहीं हुई। पहले FREED खोलें, Safari अनुमति दें और पुनः प्रयास करें।"],
 es: ["Comprobar Safari", "Bloqueo y recuperación sin verificar.", "Comprobando…", "Comprobación registrada. Vuelve a FREED para ver detalles. Bloqueo y recuperación sin verificar.", "No se pudo confirmar. Abre FREED, permite el acceso de Safari e inténtalo de nuevo."],
 pt: ["Verificar Safari", "Bloqueio e recuperação não verificados.", "Verificando…", "Verificação registrada. Volte ao FREED para detalhes. Bloqueio e recuperação não verificados.", "Não foi possível confirmar. Abra FREED, permita acesso ao Safari e tente novamente."],
 fr: ["Vérifier Safari", "Blocage et récupération non vérifiés.", "Vérification…", "Vérification enregistrée. Revenez dans FREED pour les détails. Blocage et récupération non vérifiés.", "Confirmation impossible. Ouvrez FREED, autorisez Safari et réessayez."],
 de: ["Safari prüfen", "Blockierung und Erholung bleiben ungeprüft.", "Prüfung läuft…", "Konfigurationsprüfung gespeichert. Details in FREED. Blockierung und Erholung bleiben ungeprüft.", "Keine Bestätigung. Öffne FREED, erlaube Safari-Zugriff und versuche es erneut."],
 ar: ["تحقق من Safari", "الحظر والتعافي غير متحقق منهما.", "جارٍ التحقق…", "تم تسجيل فحص الإعداد. ارجع إلى FREED للتفاصيل. الحظر والتعافي غير متحقق منهما.", "تعذر التأكيد. افتح FREED أولاً واسمح بالوصول في Safari ثم أعد المحاولة."],
 ja: ["Safariを確認", "ブロックと回復は未検証です。", "確認中…", "設定確認を記録しました。詳細はFREEDでご確認ください。ブロックと回復は未検証です。", "確認できませんでした。FREEDを開き、Safariのアクセスを許可して再試行してください。"],
 ko: ["Safari 확인", "차단과 회복은 검증되지 않았습니다.", "확인 중…", "설정 확인을 기록했습니다. 자세한 내용은 FREED에서 확인하세요. 차단과 회복은 검증되지 않았습니다.", "확인하지 못했습니다. FREED를 먼저 열고 Safari 접근을 허용한 후 다시 시도하세요."],
 zh: ["检查 Safari", "拦截和恢复功能仍未经验证。", "正在检查…", "已记录配置检查。请返回 FREED 查看详情。拦截和恢复功能仍未经验证。", "无法确认。请先打开 FREED，允许 Safari 访问，然后重试。"]
};
// Consent is owned by this popup. No page, background event or load requests access.
const permissionCopy = {
 en: ["Allow website access", "Safari will ask to allow access only to the websites declared by this extension.", "Included websites", "Waiting for Safari…", "Website access allowed.", "Access was not allowed or was cancelled. You can try again.", "Could not confirm permission. Retry or allow FREED in Safari settings.", "Permission request unavailable. Allow FREED in Safari settings, then check again."],
 hi: ["वेबसाइट की अनुमति दें", "Safari केवल इस एक्सटेंशन में घोषित वेबसाइटों के लिए अनुमति माँगेगा।", "शामिल वेबसाइटें", "Safari की प्रतीक्षा…", "वेबसाइट की अनुमति मिली।", "अनुमति नहीं मिली या रद्द हुई। पुनः प्रयास कर सकते हैं।", "अनुमति की पुष्टि नहीं हुई। फिर प्रयास करें या Safari सेटिंग में FREED को अनुमति दें।", "अनुमति अनुरोध उपलब्ध नहीं है। Safari सेटिंग में FREED को अनुमति देकर फिर जाँचें।"],
 es: ["Permitir acceso web", "Safari pedirá acceso solo a los sitios declarados por esta extensión.", "Sitios incluidos", "Esperando a Safari…", "Acceso web permitido.", "Acceso denegado o cancelado. Puedes volver a intentarlo.", "No se pudo confirmar el permiso. Reintenta o permite FREED en los ajustes de Safari.", "Solicitud no disponible. Permite FREED en los ajustes de Safari y comprueba de nuevo."],
 pt: ["Permitir acesso a sites", "O Safari pedirá acesso apenas aos sites declarados por esta extensão.", "Sites incluídos", "Aguardando Safari…", "Acesso permitido.", "Acesso negado ou cancelado. Você pode tentar novamente.", "Não foi possível confirmar a permissão. Tente novamente ou permita FREED nos ajustes do Safari.", "Solicitação indisponível. Permita FREED nos ajustes do Safari e verifique novamente."],
 fr: ["Autoriser les sites web", "Safari demandera l’accès uniquement aux sites déclarés par cette extension.", "Sites inclus", "En attente de Safari…", "Accès autorisé.", "Accès refusé ou annulé. Vous pouvez réessayer.", "Autorisation non confirmée. Réessayez ou autorisez FREED dans les réglages Safari.", "Demande indisponible. Autorisez FREED dans les réglages Safari, puis vérifiez à nouveau."],
 de: ["Websitezugriff erlauben", "Safari fragt nur nach Zugriff auf die von dieser Erweiterung angegebenen Websites.", "Enthaltene Websites", "Warten auf Safari…", "Websitezugriff erlaubt.", "Zugriff abgelehnt oder abgebrochen. Du kannst es erneut versuchen.", "Berechtigung nicht bestätigt. Erneut versuchen oder FREED in den Safari-Einstellungen erlauben.", "Berechtigungsanfrage nicht verfügbar. FREED in den Safari-Einstellungen erlauben und erneut prüfen."],
 ar: ["السماح بالوصول للمواقع", "سيطلب Safari الوصول فقط إلى المواقع المعلنة في هذا الامتداد.", "المواقع المشمولة", "في انتظار Safari…", "تم السماح بالوصول.", "لم يُسمح بالوصول أو أُلغي الطلب. يمكنك المحاولة مجددًا.", "تعذر تأكيد الإذن. أعد المحاولة أو اسمح لـ FREED في إعدادات Safari.", "طلب الإذن غير متاح. اسمح لـ FREED في إعدادات Safari ثم تحقق مجددًا."],
 ja: ["Webサイトへのアクセスを許可", "Safariは、この拡張機能に記載されたWebサイトのみへのアクセスを確認します。", "対象のWebサイト", "Safariの応答を待っています…", "アクセスが許可されました。", "アクセスが拒否またはキャンセルされました。再試行できます。", "許可を確認できませんでした。再試行するか、Safari設定でFREEDを許可してください。", "許可を要求できません。Safari設定でFREEDを許可してから再確認してください。"],
 ko: ["웹사이트 접근 허용", "Safari가 이 확장 프로그램에 선언된 웹사이트에만 접근을 요청합니다.", "포함된 웹사이트", "Safari 응답 대기 중…", "접근이 허용되었습니다.", "접근이 거부되었거나 취소되었습니다. 다시 시도할 수 있습니다.", "권한을 확인하지 못했습니다. 다시 시도하거나 Safari 설정에서 FREED를 허용하세요.", "권한 요청을 사용할 수 없습니다. Safari 설정에서 FREED를 허용한 후 다시 확인하세요."],
 zh: ["允许网站访问", "Safari 将仅请求访问此扩展声明的网站。", "包含的网站", "正在等待 Safari…", "已允许网站访问。", "访问被拒绝或已取消。你可以重试。", "无法确认权限。请重试或在 Safari 设置中允许 FREED。", "无法请求权限。请在 Safari 设置中允许 FREED，然后重新检查。"]
};
const language = (navigator.language || "en").split(/[-_]/)[0];
const text = copy[language] || copy.en, consent = permissionCopy[language] || permissionCopy.en;
document.documentElement.lang = language in copy ? language : "en";
document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
const button = document.getElementById("check"), allow = document.getElementById("allow"), status = document.getElementById("status"), permissionStatus = document.getElementById("permission-status");
button.textContent = text[0]; status.textContent = text[1];
allow.textContent = consent[0]; document.getElementById("intro").textContent = consent[1];
document.getElementById("scope-label").textContent = consent[2];
let origins = [];
try {
  const declared = browser.runtime.getManifest().host_permissions;
  // Manifest-only exact scope: reject empty, unrestricted, path-specific or malformed grants.
  if (Array.isArray(declared) && declared.length > 0 && declared.length <= 4012 && declared.every(origin => typeof origin === "string" && /^(?:\*|https?):\/\/(?:\*\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+\/\*$/.test(origin))) origins = [...declared];
} catch { /* Manual configuration checks remain available without the permissions API. */ }
document.getElementById("scope-list").textContent = origins.join("\n");
let busy = false, disposed = false;
const observationTimers = new Set();
function setBusy(value) {
  busy = value; button.disabled = value; allow.disabled = value;
  button.setAttribute("aria-busy", String(value)); allow.setAttribute("aria-busy", String(value));
}
async function checkConfiguration() {
  if (disposed) return;
  status.textContent = text[2];
  let timer;
  try {
    const result = await Promise.race([
      browser.runtime.sendMessage({ version: 1, type: "check-safari-configuration" }),
      new Promise(resolve => { timer = setTimeout(() => resolve({ persisted: false }), 32000); observationTimers.add(timer); })
    ]);
    if (!disposed) status.textContent = result?.persisted === true ? text[3] : text[4];
  } catch { if (!disposed) status.textContent = text[4]; }
  finally { clearTimeout(timer); observationTimers.delete(timer); }
}
button.addEventListener("click", async () => {
  if (busy || disposed) return;
  setBusy(true);
  try { await checkConfiguration(); } finally { if (!disposed) setBusy(false); }
});
allow.addEventListener("click", async () => {
  if (busy || disposed) return;
  if (!origins.length || typeof globalThis.browser?.permissions?.request !== "function") { permissionStatus.textContent = consent[7]; return; }
  setBusy(true); permissionStatus.textContent = consent[3];
  try {
    // Keep this call in the deliberate click's synchronous turn, before any await.
    const permission = browser.permissions.request({ origins: [...origins] });
    const granted = await permission;
    if (disposed) return;
    permissionStatus.textContent = granted === true ? consent[4] : granted === false ? consent[5] : consent[6];
  } catch { if (!disposed) permissionStatus.textContent = consent[6]; }
  try { if (!disposed) await checkConfiguration(); } finally { if (!disposed) setBusy(false); }
});
globalThis.addEventListener?.("pagehide", () => {
  disposed = true;
  for (const timer of observationTimers) clearTimeout(timer);
  observationTimers.clear();
});
