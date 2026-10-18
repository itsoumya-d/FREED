import ManagedSettings
import ManagedSettingsUI
import UIKit

private enum FreedShieldCopy {
  static func language(selected: String?, preferred: String) -> String {
    if let selected, strings[selected] != nil { return selected }
    let normalized = preferred.replacingOccurrences(of: "_", with: "-").lowercased()
    if normalized.hasPrefix("zh") { return ["hant", "tw", "hk", "mo"].contains(where: normalized.contains) ? "en" : "zh-Hans" }
    let base = String(normalized.split(separator: "-").first ?? "en")
    return strings[base] != nil ? base : "en"
  }
  // BEGIN GENERATED SHIELD COPY
  static let strings: [String: [String: String]] = [
    "en": [
      "title": "Hold on. You are still in control.",
      "primary": "Start recovery",
      "secondary": "Close",
      "targetDescription": "FREED paused this selected app or site. Completing a practice unlocks only this target.",
      "categoryDescription": "Category-wide protection is active. Completing a practice unlocks only this selected category."
    ],
    "hi": [
      "title": "एक पल रुकें। निर्णय अभी भी आपके हाथ में है।",
      "primary": "अपना अभ्यास शुरू करें",
      "secondary": "बंद करें",
      "targetDescription": "FREED ने इस चुने हुए ऐप या साइट को कुछ देर के लिए रोका है। एक अभ्यास पूरा करने पर केवल यही ऐप या साइट खुलेगी।",
      "categoryDescription": "इस पूरी श्रेणी पर सुरक्षा सक्रिय है। एक अभ्यास पूरा करने पर केवल यही चुनी हुई श्रेणी खुलेगी।"
    ],
    "es": [
      "title": "Espera un momento. Tú sigues teniendo el control.",
      "primary": "Empezar una práctica",
      "secondary": "Cerrar",
      "targetDescription": "FREED ha pausado esta app o sitio seleccionado. Completar una práctica desbloquea solo este objetivo.",
      "categoryDescription": "La protección de toda la categoría está activa. Completar una práctica desbloquea solo esta categoría seleccionada."
    ],
    "pt": [
      "title": "Espere um momento. Você continua no controle.",
      "primary": "Iniciar uma prática",
      "secondary": "Fechar",
      "targetDescription": "O FREED pausou este app ou site selecionado. Concluir uma prática desbloqueia apenas este alvo.",
      "categoryDescription": "A proteção de toda a categoria está ativa. Concluir uma prática desbloqueia apenas esta categoria selecionada."
    ],
    "fr": [
      "title": "Un instant. Vous gardez le contrôle.",
      "primary": "Commencer une pratique",
      "secondary": "Fermer",
      "targetDescription": "FREED a mis en pause cette app ou ce site sélectionné. Terminer une pratique débloque uniquement cette cible.",
      "categoryDescription": "La protection de toute la catégorie est active. Terminer une pratique débloque uniquement cette catégorie sélectionnée."
    ],
    "de": [
      "title": "Einen Moment. Du behältst die Kontrolle.",
      "primary": "Eine Übung beginnen",
      "secondary": "Schließen",
      "targetDescription": "FREED hat diese ausgewählte App oder Website pausiert. Eine abgeschlossene Übung gibt nur dieses Ziel frei.",
      "categoryDescription": "Der Schutz der gesamten Kategorie ist aktiv. Eine abgeschlossene Übung gibt nur diese ausgewählte Kategorie frei."
    ],
    "ar": [
      "title": "تمهل. ما زال القرار بيدك.",
      "primary": "ابدأ تمرينًا",
      "secondary": "إغلاق",
      "targetDescription": "أوقف FREED هذا التطبيق أو الموقع المحدد مؤقتًا. إكمال تمرين يفتح هذا الهدف فقط.",
      "categoryDescription": "الحماية تشمل الفئة بأكملها. إكمال تمرين يفتح هذه الفئة المحددة فقط."
    ],
    "ja": [
      "title": "少し待ちましょう。選ぶ力は、まだあなたにあります。",
      "primary": "練習を始める",
      "secondary": "閉じる",
      "targetDescription": "FREEDがこの選択したアプリまたはサイトを一時停止しました。練習を完了すると、この対象だけが解除されます。",
      "categoryDescription": "カテゴリ全体の保護が有効です。練習を完了すると、この選択したカテゴリだけが解除されます。"
    ],
    "ko": [
      "title": "잠시 멈추세요. 선택은 여전히 당신의 몫입니다.",
      "primary": "회복 시작",
      "secondary": "닫기",
      "targetDescription": "FREED가 선택한 앱 또는 사이트를 일시 정지했습니다. 연습을 완료하면 이 대상만 잠금 해제됩니다.",
      "categoryDescription": "카테고리 전체에 보호가 적용되었습니다. 연습을 완료하면 선택한 카테고리만 잠금 해제됩니다."
    ],
    "zh-Hans": [
      "title": "先停一下。选择权仍在你手中。",
      "primary": "开始练习",
      "secondary": "关闭",
      "targetDescription": "FREED已暂停此选定的应用或网站。完成一次练习后，只会解除此目标的限制。",
      "categoryDescription": "整个类别的保护已启用。完成一次练习后，只会解除此选定类别的限制。"
    ]
  ]
  // END GENERATED SHIELD COPY
}

@objc(ShieldConfigurationExtension)
final class ShieldConfigurationExtension: ShieldConfigurationDataSource {
  private var preferences: [String: String] {
    UserDefaults(suiteName: "group.app.freed.recovery")?.dictionary(forKey: "freed.presentation.v1") as? [String: String] ?? [:]
  }
  private func color(light: UIColor, dark: UIColor) -> UIColor {
    let theme = preferences["themeMode"]
    return UIColor { traits in
      let useDark = theme == "dark" || (theme != "light" && traits.userInterfaceStyle == .dark)
      return useDark ? dark : light
    }
  }
  private func kiteIcon() -> UIImage {
    UIGraphicsImageRenderer(size: CGSize(width: 64, height: 64)).image { renderer in
      let context = renderer.cgContext
      context.scaleBy(x: 0.5, y: 0.5)
      context.setStrokeColor(color(
        light: UIColor(red: 65 / 255, green: 74 / 255, blue: 206 / 255, alpha: 1),
        dark: UIColor(red: 161 / 255, green: 173 / 255, blue: 255 / 255, alpha: 1)
      ).cgColor)
      context.setLineWidth(8)
      context.setLineJoin(.round)
      context.setLineCap(.round)
      let path = UIBezierPath()
      path.move(to: CGPoint(x: 64, y: 12)); path.addLine(to: CGPoint(x: 108, y: 58))
      path.addLine(to: CGPoint(x: 66, y: 116)); path.addLine(to: CGPoint(x: 18, y: 68)); path.close()
      path.move(to: CGPoint(x: 64, y: 12)); path.addLine(to: CGPoint(x: 51, y: 65)); path.addLine(to: CGPoint(x: 108, y: 58))
      path.move(to: CGPoint(x: 18, y: 68)); path.addLine(to: CGPoint(x: 51, y: 65)); path.addLine(to: CGPoint(x: 66, y: 116))
      context.addPath(path.cgPath); context.strokePath()
    }
  }

  private func recoveryShield(categoryWide: Bool = false, website: Bool = false) -> ShieldConfiguration {
    let saved = preferences
    let language = FreedShieldCopy.language(selected: saved["language"], preferred: Locale.preferredLanguages.first ?? "en")
    // The generator and release checks require all five keys for every locale.
    let websiteCopy = FreedWebsiteProbeCopy.row(language)
    let copy = FreedShieldCopy.strings[language] ?? FreedShieldCopy.strings["en"]!
    let ink = UIColor(red: 20 / 255, green: 24 / 255, blue: 39 / 255, alpha: 1)
    let text = color(light: ink, dark: UIColor(red: 245 / 255, green: 246 / 255, blue: 250 / 255, alpha: 1))
    let secondary = color(light: UIColor(white: 0.34, alpha: 1), dark: UIColor(white: 0.72, alpha: 1))
    let background = color(light: UIColor(red: 250 / 255, green: 250 / 255, blue: 251 / 255, alpha: 1), dark: UIColor(red: 16 / 255, green: 19 / 255, blue: 25 / 255, alpha: 1))
    let blur: UIBlurEffect.Style = saved["themeMode"] == "dark" ? .systemMaterialDark : saved["themeMode"] == "light" ? .systemMaterialLight : .systemMaterial

    return ShieldConfiguration(
      backgroundBlurStyle: blur,
      backgroundColor: background,
      icon: kiteIcon(),
      title: .init(text: copy["title"]!, color: text),
      subtitle: .init(text: website ? websiteCopy[1] : copy[categoryWide ? "categoryDescription" : "targetDescription"]!, color: secondary),
      primaryButtonLabel: .init(text: website ? websiteCopy[0] : copy["primary"]!, color: color(light: .white, dark: ink)),
      primaryButtonBackgroundColor: color(light: UIColor(red: 65 / 255, green: 74 / 255, blue: 206 / 255, alpha: 1), dark: UIColor(red: 161 / 255, green: 173 / 255, blue: 255 / 255, alpha: 1)),
      secondaryButtonLabel: .init(text: copy["secondary"]!, color: secondary)
    )
  }

  override func configuration(shielding application: Application) -> ShieldConfiguration {
    let diagnostic = FreedShieldRuntimeDiagnostics.begin(role: .configuration, callback: .app)
    defer { FreedShieldRuntimeDiagnostics.finish(diagnostic, outcome: .configured) }
    return recoveryShield()
  }

  override func configuration(shielding application: Application, in category: ActivityCategory) -> ShieldConfiguration {
    let diagnostic = FreedShieldRuntimeDiagnostics.begin(role: .configuration, callback: .category)
    defer { FreedShieldRuntimeDiagnostics.finish(diagnostic, outcome: .configured) }
    return recoveryShield(categoryWide: true)
  }

  override func configuration(shielding webDomain: WebDomain) -> ShieldConfiguration {
    let diagnostic = FreedShieldRuntimeDiagnostics.begin(role: .configuration, callback: .site)
    defer { FreedShieldRuntimeDiagnostics.finish(diagnostic, outcome: .configured) }
    return recoveryShield(website: true)
  }

  override func configuration(shielding webDomain: WebDomain, in category: ActivityCategory) -> ShieldConfiguration {
    let diagnostic = FreedShieldRuntimeDiagnostics.begin(role: .configuration, callback: .site)
    defer { FreedShieldRuntimeDiagnostics.finish(diagnostic, outcome: .configured) }
    return recoveryShield(website: true)
  }
}
