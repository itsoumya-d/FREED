package app.freed.protection

/** A runtime preference cannot lift an unreviewed production build. */
object FreedFocusShieldPolicy {
  fun canInspectSurface(releaseEnabled: Boolean, debugBuild: Boolean, devPreview: Boolean,
    rolloutEnabled: Boolean, userOptedIn: Boolean): Boolean =
    (releaseEnabled || (debugBuild && devPreview)) && rolloutEnabled && userOptedIn
}
