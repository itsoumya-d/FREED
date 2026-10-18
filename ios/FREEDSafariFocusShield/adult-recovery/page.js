"use strict";

// Local copy only. No target, referrer, native, network, storage or authority access.
const COPY = Object.freeze({
  "en": [
    "Pause with FREED",
    "SAFARI RECOVERY",
    "A moment to choose.",
    "Open FREED for a useful reset: breathe, move, or try an available finding activity.",
    "Open Challenge",
    "Choose a useful activity in FREED, or leave this page.",
    "Website protection stays on. An ad or activity never unlocks adult websites.",
    "If FREED did not open, check that it is installed, then tap again.",
    "Leave this page"
  ],
  "hi": [
    "FREED के साथ विराम",
    "सफ़ारी रीसेट",
    "चुनने के लिए एक पल।",
    "एक उपयोगी रीसेट के लिए FREED खोलें: साँस लें, शरीर हिलाएँ या उपलब्ध खोज गतिविधि करें।",
    "चुनौती खोलें",
    "FREED में उपयोगी गतिविधि चुनें या इस पेज से बाहर जाएँ।",
    "वेबसाइट सुरक्षा चालू रहती है। विज्ञापन या गतिविधि वयस्क वेबसाइटों को अनलॉक नहीं करती।",
    "यदि FREED नहीं खुला, देखें कि वह इंस्टॉल है, फिर दोबारा टैप करें।",
    "इस पेज से बाहर जाएँ"
  ],
  "es": [
    "Una pausa con FREED",
    "PAUSA EN SAFARI",
    "Un momento para elegir.",
    "Abre FREED para una pausa útil: respira, muévete o prueba una actividad de búsqueda disponible.",
    "Abrir desafío",
    "Elige una actividad útil en FREED o sal de esta página.",
    "La protección sigue activa. Ningún anuncio ni actividad desbloquea sitios para adultos.",
    "Si FREED no se abrió, comprueba que esté instalada y vuelve a tocar.",
    "Salir de esta página"
  ],
  "pt": [
    "Uma pausa com FREED",
    "PAUSA NO SAFARI",
    "Um momento para escolher.",
    "Abra FREED para uma pausa útil: respire, movimente-se ou experimente uma atividade de busca disponível.",
    "Abrir desafio",
    "Escolha uma atividade útil no FREED ou saia desta página.",
    "A proteção continua ativa. Anúncios e atividades nunca desbloqueiam sites adultos.",
    "Se FREED não abriu, confirme que está instalado e toque novamente.",
    "Sair desta página"
  ],
  "fr": [
    "Une pause avec FREED",
    "PAUSE DANS SAFARI",
    "Un moment pour choisir.",
    "Ouvrez FREED pour une pause utile : respirez, bougez ou essayez une activité de recherche disponible.",
    "Ouvrir un défi",
    "Choisissez une activité utile dans FREED ou quittez cette page.",
    "La protection reste active. Une publicité ou une activité ne débloque jamais les sites pour adultes.",
    "Si FREED ne s’est pas ouvert, vérifiez son installation, puis réessayez.",
    "Quitter cette page"
  ],
  "de": [
    "Eine Pause mit FREED",
    "SAFARI-PAUSE",
    "Ein Moment zum Entscheiden.",
    "Öffne FREED für eine hilfreiche Pause: Atmen, Bewegung oder eine verfügbare Suchaufgabe.",
    "Challenge öffnen",
    "Wähle eine hilfreiche Aktivität in FREED oder verlasse diese Seite.",
    "Der Webschutz bleibt aktiv. Werbung oder Aktivitäten entsperren niemals Websites für Erwachsene.",
    "Falls FREED nicht geöffnet wurde, prüfe die Installation und tippe erneut.",
    "Diese Seite verlassen"
  ],
  "ar": [
    "استراحة مع FREED",
    "استراحة في سفاري",
    "لحظة للاختيار.",
    "افتح FREED لاستراحة مفيدة: تنفّس أو تحرّك أو جرّب نشاط بحث متاحًا.",
    "افتح التحدي",
    "اختر نشاطًا مفيدًا في FREED أو غادر هذه الصفحة.",
    "تبقى حماية المواقع مفعّلة. لا يفتح أي إعلان أو نشاط مواقع البالغين.",
    "إذا لم يُفتح FREED، تأكّد من تثبيته ثم اضغط مجددًا.",
    "غادر هذه الصفحة"
  ],
  "ja": [
    "FREEDでひと息",
    "SAFARIでひと息",
    "選び直すためのひととき。",
    "FREEDを開いて、呼吸、軽い運動、または利用できる探しものの活動を選びましょう。",
    "チャレンジを開く",
    "FREEDで役立つ活動を選ぶか、このページを離れてください。",
    "サイトの保護は有効なままです。広告や活動で成人向けサイトのブロックが解除されることはありません。",
    "FREEDが開かない場合は、インストールを確認してもう一度タップしてください。",
    "このページを離れる"
  ],
  "ko": [
    "FREED와 잠깐 쉬기",
    "SAFARI에서 잠깐 쉬기",
    "다시 선택할 시간.",
    "FREED를 열고 호흡, 가벼운 움직임 또는 이용 가능한 찾기 활동을 선택하세요.",
    "챌린지 열기",
    "FREED에서 도움이 되는 활동을 선택하거나 이 페이지를 나가세요.",
    "웹사이트 보호는 계속 켜져 있습니다. 광고나 활동으로 성인 사이트 차단이 해제되지 않습니다.",
    "FREED가 열리지 않으면 설치되어 있는지 확인한 후 다시 탭하세요.",
    "이 페이지 나가기"
  ],
  "zh": [
    "与 FREED 一起暂停片刻",
    "SAFARI 暂停",
    "给自己片刻，重新选择。",
    "打开 FREED，选择呼吸、轻柔运动或可用的寻找物品活动。",
    "打开挑战",
    "在 FREED 中选择有益的活动，或离开此页面。",
    "网站保护保持开启。广告或活动绝不会解除成人网站的封锁。",
    "如果 FREED 未打开，请确认已安装，然后再次轻点。",
    "离开此页面"
  ]
});
const language = typeof navigator.language === 'string' ? navigator.language.toLowerCase().split('-')[0] : 'en';
const locale = Object.prototype.hasOwnProperty.call(COPY, language) ? language : 'en';
const copy = COPY[locale];
document.documentElement.lang = locale;
document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
document.title = copy[0];
['label', 'heading', 'body', 'open-freed', 'notice', 'protection'].forEach((id, index) => { document.getElementById(id).textContent = copy[index + 1]; });
document.getElementById('open-freed').addEventListener('click', () => { document.getElementById('status').textContent = copy[7]; });

document.getElementById("safe-exit").textContent = copy[8];
