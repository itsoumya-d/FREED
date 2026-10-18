import Foundation

enum FreedWebsiteProbeCopy {
  // Website copy deliberately lives outside the generated application/cap copy.
  static let strings: [String: [String]] = [
    "en": ["Open FREED", "This site stays blocked. Open FREED for recovery; an activity does not unlock it.", "Choose individual websites only (1–50). Apps and categories cannot be saved.", "Cancel", "Done"],
    "hi": ["FREED खोलें", "यह साइट अवरुद्ध रहेगी। पुनर्प्राप्ति के लिए FREED खोलें; गतिविधि इसे नहीं खोलती।", "केवल अलग-अलग वेबसाइट चुनें (1–50)। ऐप और श्रेणियाँ सहेजी नहीं जा सकतीं।", "रद्द करें", "हो गया"],
    "es": ["Abrir FREED", "Este sitio sigue bloqueado. Abre FREED para recuperarte; una actividad no lo desbloquea.", "Elige solo sitios individuales (1–50). No se pueden guardar apps ni categorías.", "Cancelar", "Listo"],
    "pt": ["Abrir FREED", "Este site permanece bloqueado. Abra o FREED para recuperação; uma atividade não o desbloqueia.", "Escolha apenas sites individuais (1–50). Apps e categorias não podem ser salvos.", "Cancelar", "Concluído"],
    "fr": ["Ouvrir FREED", "Ce site reste bloqué. Ouvrez FREED pour vous recentrer ; une activité ne le débloque pas.", "Choisissez uniquement des sites individuels (1–50). Les apps et catégories ne peuvent pas être enregistrées.", "Annuler", "Terminé"],
    "de": ["FREED öffnen", "Diese Website bleibt gesperrt. Öffne FREED zur Erholung; eine Übung entsperrt sie nicht.", "Wähle nur einzelne Websites (1–50). Apps und Kategorien können nicht gespeichert werden.", "Abbrechen", "Fertig"],
    "ar": ["افتح FREED", "يبقى هذا الموقع محظورًا. افتح FREED للتعافي؛ النشاط لا يفتح الموقع.", "اختر مواقع فردية فقط (1–50). لا يمكن حفظ التطبيقات والفئات.", "إلغاء", "تم"],
    "ja": ["FREEDを開く", "このサイトはブロックされたままです。回復のためにFREEDを開いてください。活動を完了しても解除されません。", "個別のウェブサイトのみ選択してください（1〜50）。アプリとカテゴリは保存できません。", "キャンセル", "完了"],
    "ko": ["FREED 열기", "이 사이트는 계속 차단됩니다. 회복을 위해 FREED를 여세요. 활동을 완료해도 차단은 해제되지 않습니다.", "개별 웹사이트만 선택하세요(1–50). 앱과 카테고리는 저장할 수 없습니다.", "취소", "완료"],
    "zh-Hans": ["打开 FREED", "此网站保持屏蔽。打开 FREED 进行恢复；完成活动不会解除屏蔽。", "仅选择单独的网站（1–50）。无法保存应用和类别。", "取消", "完成"]
  ]
  static func row(_ language: String) -> [String] { strings[language] ?? strings["en"]! }
}
