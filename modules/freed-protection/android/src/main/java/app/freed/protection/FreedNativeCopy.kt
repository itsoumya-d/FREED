package app.freed.protection

import android.content.Context
import android.content.res.Configuration
import android.graphics.Color
import java.util.Locale

/** Presentation state only: never changes permissions, rules or service health. */
object FreedNativeCopy {
  private const val PREFERENCES = "freed.presentation.v1"
  fun save(context: Context, language: String, themeMode: String, languagePreference: String? = null): Boolean {
    if (language !in FreedPresentationLocale.supported || themeMode !in setOf("system", "light", "dark")) return false
    val selected = languagePreference ?: language
    if (selected != "system" && selected !in FreedPresentationLocale.supported) return false
    return context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).edit()
      .putString("language", selected).putString("themeMode", themeMode).commit()
  }
  fun language(context: Context): String {
    val selected = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).getString("language", null)
    val preferred = context.applicationContext.resources.configuration.locales[0]?.toLanguageTag() ?: "en"
    return FreedPresentationLocale.resolve(selected, preferred)
  }
  fun localizedContext(context: Context): Context {
    val configuration = Configuration(context.resources.configuration)
    val locale = Locale.forLanguageTag(language(context))
    configuration.uiMode = (configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK.inv()) or (if (dark(context)) Configuration.UI_MODE_NIGHT_YES else Configuration.UI_MODE_NIGHT_NO)
    configuration.setLocale(locale)
    configuration.setLayoutDirection(locale)
    return context.createConfigurationContext(configuration)
  }
  fun text(context: Context, resource: Int, values: Map<String, String> = emptyMap()): String {
    var result = localizedContext(context).getString(resource)
    for ((name, value) in values) result = result.replace("{{$name}}", value)
    return result
  }
  fun dark(context: Context): Boolean {
    val selected = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).getString("themeMode", "system")
    return selected == "dark" || (selected != "light" && context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES)
  }
  fun color(context: Context, light: String, dark: String): Int = Color.parseColor(if (dark(context)) dark else light)
}
