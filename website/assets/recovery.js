(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root.document) api.mount(root.document, root.navigator || {});
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const APP_LINK = 'https://freed-7d5ee.firebaseapp.com/intervention';
  const SCHEME_LINK = 'freed://guided-reset';
  const COPY = Object.freeze({
    en: ['A moment with FREED','Take a moment.','Choose a useful reset in FREED.','Open Challenge','Open installed app','Leave for now','A reset never turns off website protection.','Need help?','Language','If the app did not open, try Open installed app.'],
    hi: ['FREED के साथ एक पल','एक पल रुकें।','FREED में एक मददगार गतिविधि चुनें।','चुनौती खोलें','इंस्टॉल किया ऐप खोलें','अभी के लिए छोड़ें','गतिविधि से वेबसाइट सुरक्षा कभी बंद नहीं होती।','मदद चाहिए?','भाषा','ऐप नहीं खुला तो इंस्टॉल किया ऐप खोलें पर टैप करें।'],
    es: ['Un momento con FREED','Tómate un momento.','Elige una pausa útil en FREED.','Abrir reto','Abrir la app instalada','Salir por ahora','Una pausa nunca desactiva la protección web.','¿Necesitas ayuda?','Idioma','Si la app no se abrió, prueba Abrir la app instalada.'],
    pt: ['Um momento com FREED','Pare um instante.','Escolha uma pausa útil no FREED.','Abrir desafio','Abrir o app instalado','Sair por agora','Uma pausa nunca desativa a proteção de sites.','Precisa de ajuda?','Idioma','Se o app não abriu, tente Abrir o app instalado.'],
    fr: ['Un moment avec FREED','Prenez un instant.','Choisissez une pause utile dans FREED.','Ouvrir un défi','Ouvrir l’app installée','Quitter pour le moment','Une pause ne désactive jamais la protection des sites.','Besoin d’aide ?','Langue','Si l’app ne s’est pas ouverte, essayez Ouvrir l’app installée.'],
    de: ['Ein Moment mit FREED','Nimm dir einen Moment.','Wähle eine hilfreiche Pause in FREED.','Aufgabe öffnen','Installierte App öffnen','Vorerst verlassen','Eine Pause schaltet den Webschutz niemals aus.','Brauchst du Hilfe?','Sprache','Falls die App nicht geöffnet wurde, wähle Installierte App öffnen.'],
    ar: ['لحظة مع FREED','خذ لحظة لنفسك.','اختر نشاطًا مفيدًا في FREED.','افتح التحدي','افتح التطبيق المثبّت','غادر الآن','لا يوقف النشاط حماية المواقع أبدًا.','تحتاج مساعدة؟','اللغة','إذا لم يُفتح التطبيق، جرّب فتح التطبيق المثبّت.'],
    ja: ['FREEDでひと息','少し、ひと息。','FREEDで役立つリセットを選びましょう。','チャレンジを開く','インストール済みアプリを開く','いったん離れる','リセットでサイトの保護が解除されることはありません。','ヘルプ','言語','アプリが開かなければ「インストール済みアプリを開く」をお試しください。'],
    ko: ['FREED와 잠깐 쉬기','잠시 쉬어 가세요.','FREED에서 도움이 되는 활동을 선택하세요.','챌린지 열기','설치된 앱 열기','지금은 나가기','활동을 해도 웹사이트 보호는 꺼지지 않습니다.','도움이 필요하신가요?','언어','앱이 열리지 않으면 설치된 앱 열기를 눌러 보세요.'],
    'zh-Hans': ['与 FREED 一起暂停片刻','给自己片刻。','在 FREED 中选择一项有益的活动。','打开挑战','打开已安装的应用','暂时离开','完成活动不会关闭网站保护。','需要帮助？','语言','如果应用没有打开，请尝试“打开已安装的应用”。']
  });
  const ids = ['heading','intro','open-challenge','open-installed','safe-exit','protection','help','language-label'];
  function localeFor(value) {
    if (typeof value !== 'string') return 'en';
    const base = value.toLowerCase().split('-')[0];
    return base === 'zh' ? 'zh-Hans' : Object.prototype.hasOwnProperty.call(COPY, base) ? base : 'en';
  }
  function mount(document, navigator) {
    let locale = localeFor(navigator.language);
    const selection = document.getElementById('language');
    function render(language) {
      locale = localeFor(language);
      document.documentElement.lang = locale;
      document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
      document.title = COPY[locale][0];
      ids.forEach((id, index) => { document.getElementById(id).textContent = COPY[locale][index + 1]; });
      selection.value = locale;
      document.getElementById('status').textContent = '';
    }
    render(locale);
    selection.addEventListener('change', () => render(selection.value));
    document.getElementById('open-challenge').addEventListener('click', () => {
      // A gesture follows the fixed anchor. No automatic redirect, analytics,
      // site/referrer inspection, or claim that the app actually opened.
      document.getElementById('open-installed').hidden = false;
      document.getElementById('status').textContent = COPY[locale][9];
    });
  }
  return Object.freeze({ APP_LINK, SCHEME_LINK, COPY, localeFor, mount });
});
