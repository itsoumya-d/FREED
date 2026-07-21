import ManagedSettings
import ManagedSettingsUI
import UIKit

final class ShieldConfigurationExtension: ShieldConfigurationDataSource {
  private let title = ShieldConfiguration.Label(
    text: "Hold on. You are still in control.",
    color: .white
  )

  private let primary = ShieldConfiguration.Label(
    text: "Start recovery",
    color: .white
  )

  private let secondary = ShieldConfiguration.Label(
    text: "Close",
    color: UIColor(white: 1, alpha: 0.72)
  )

  private func recoveryShield(categoryWide: Bool = false) -> ShieldConfiguration {
    let subtitle = ShieldConfiguration.Label(
      text: categoryWide
        ? "Category-wide recovery: completing a challenge unlocks this selected category only."
        : "FREED paused this selected app or site. Completing a challenge unlocks only this target.",
      color: UIColor(white: 1, alpha: 0.78)
    )

    return ShieldConfiguration(
      backgroundBlurStyle: .systemMaterialDark,
      backgroundColor: UIColor(red: 0.07, green: 0.06, blue: 0.12, alpha: 1),
      title: title,
      subtitle: subtitle,
      primaryButtonLabel: primary,
      primaryButtonBackgroundColor: UIColor(red: 0.72, green: 0.60, blue: 1, alpha: 1),
      secondaryButtonLabel: secondary
    )
  }

  override func configuration(shielding application: Application) -> ShieldConfiguration {
    recoveryShield()
  }

  override func configuration(shielding application: Application, in category: ActivityCategory) -> ShieldConfiguration {
    recoveryShield(categoryWide: true)
  }

  override func configuration(shielding webDomain: WebDomain) -> ShieldConfiguration {
    recoveryShield()
  }

  override func configuration(shielding webDomain: WebDomain, in category: ActivityCategory) -> ShieldConfiguration {
    recoveryShield(categoryWide: true)
  }
}
