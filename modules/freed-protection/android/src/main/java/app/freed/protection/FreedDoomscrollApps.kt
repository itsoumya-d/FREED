package app.freed.protection

internal object FreedDoomscrollApps {
  const val YOUTUBE_PACKAGE = "com.google.android.youtube"
  const val INSTAGRAM_PACKAGE = "com.instagram.android"
  const val TIKTOK_PRIMARY_PACKAGE = "com.zhiliaoapp.musically"
  const val TIKTOK_TRILL_PACKAGE = "com.ss.android.ugc.trill"
  const val TIKTOK_ALT_PACKAGE = "com.tiktok"
  const val X_PACKAGE = "com.twitter.android"
  const val REDDIT_PACKAGE = "com.reddit.frontpage"

  const val YOUTUBE_SHORTS_RULE = "short-form:youtube-shorts"
  const val INSTAGRAM_REELS_RULE = "short-form:instagram-reels"
  const val TIKTOK_FEED_RULE = "short-form:tiktok-feed"

  const val YOUTUBE_SHORTS_HOST = "youtube-shorts.app.freed.local"
  const val INSTAGRAM_REELS_HOST = "instagram-reels.app.freed.local"
  const val TIKTOK_FEED_HOST = "tiktok-feed.app.freed.local"

  val TIKTOK_PACKAGES = setOf(
    TIKTOK_PRIMARY_PACKAGE,
    TIKTOK_TRILL_PACKAGE,
    TIKTOK_ALT_PACKAGE
  )

  val SUPPORTED_BLOCKED_APP_PACKAGES = setOf(
    YOUTUBE_PACKAGE,
    INSTAGRAM_PACKAGE,
    TIKTOK_PRIMARY_PACKAGE,
    TIKTOK_TRILL_PACKAGE,
    TIKTOK_ALT_PACKAGE,
    X_PACKAGE,
    REDDIT_PACKAGE
  )

  fun shortFormHostForRule(rule: String): String {
    return when (rule) {
      YOUTUBE_SHORTS_RULE -> YOUTUBE_SHORTS_HOST
      INSTAGRAM_REELS_RULE -> INSTAGRAM_REELS_HOST
      TIKTOK_FEED_RULE -> TIKTOK_FEED_HOST
      else -> "short-form.app.freed.local"
    }
  }

  fun packageForShortFormRule(rule: String): String? {
    return when (rule) {
      YOUTUBE_SHORTS_RULE -> YOUTUBE_PACKAGE
      INSTAGRAM_REELS_RULE -> INSTAGRAM_PACKAGE
      TIKTOK_FEED_RULE -> TIKTOK_PRIMARY_PACKAGE
      else -> null
    }
  }

  fun packageForShortFormHost(host: String): String? {
    return when (host) {
      YOUTUBE_SHORTS_HOST -> YOUTUBE_PACKAGE
      INSTAGRAM_REELS_HOST -> INSTAGRAM_PACKAGE
      TIKTOK_FEED_HOST -> TIKTOK_PRIMARY_PACKAGE
      else -> null
    }
  }
}
