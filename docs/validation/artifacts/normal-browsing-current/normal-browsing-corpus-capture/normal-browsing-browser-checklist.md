# Normal-Browsing Browser Checklist: normal-browsing-current

Use this checklist on physical devices only. It is a capture aid, not release evidence by itself.

For each browser:

- Record the physical device model and OS version.
- Run every allowed and recovery-search URL and confirm FREED does not interrupt.
- Run every adult-blocked URL/search and confirm FREED interrupts before harmful browsing continues.
- Attach a screenshot/video/log artifact for the completed browser run.
- Set pass counts only after every row below has been manually reviewed.

Expected per browser: 12 allowed, 4 recovery-search allowed, 4 adult-blocked.

## IOS Safari

Run ID: `normal-browsing-current-ios-safari-normal-browsing`

- [ ] allowed: allow with no FREED interruption - https://google.com/search?q=weather
- [ ] allowed: allow with no FREED interruption - https://youtube.com/results?search_query=workout
- [ ] allowed: allow with no FREED interruption - https://instagram.com/explore
- [ ] allowed: allow with no FREED interruption - https://x.com/home
- [ ] allowed: allow with no FREED interruption - https://coursera.org/learn/math
- [ ] allowed: allow with no FREED interruption - https://netflix.com/browse
- [ ] allowed: allow with no FREED interruption - https://store.steampowered.com/app/123
- [ ] allowed: allow with no FREED interruption - https://notion.so/workspace
- [ ] allowed: allow with no FREED interruption - https://wikipedia.org/wiki/Exercise
- [ ] allowed: allow with no FREED interruption - https://open.spotify.com/
- [ ] allowed: allow with no FREED interruption - https://github.com/features/actions
- [ ] allowed: allow with no FREED interruption - https://roblox.com/discover
- [ ] recovery-search: allow with no FREED interruption - https://duckduckgo.com/?q=porn+addiction+therapy
- [ ] recovery-search: allow with no FREED interruption - https://google.com/search?q=porn+recovery+accountability
- [ ] recovery-search: allow with no FREED interruption - https://google.com/search?q=accountability+software+porn+addiction
- [ ] recovery-search: allow with no FREED interruption - https://duckduckgo.com/?q=quit+porn+support+group
- [ ] adult-blocked: block/intervene - https://bing.com/search?q=porn
- [ ] adult-blocked: block/intervene - https://pornhub.com/
- [ ] adult-blocked: block/intervene - https://google.com/search?q=free+explicit+videos
- [ ] adult-blocked: block/intervene - https://xvideos.com/

Result fields to transfer into `normalBrowsing.browserMatrix[]`:

- `isPhysicalDevice=true`
- `allowedUrlPassCount=12`
- `recoverySearchPassCount=4`
- `adultBlockPassCount=4`
- `falsePositiveCount=0`
- `missedAdultBlockCount=0`
- `passed=true`

## ANDROID Chrome (com.android.chrome)

Run ID: `normal-browsing-current-android-chrome-normal-browsing`

- [ ] allowed: allow with no FREED interruption - https://google.com/search?q=weather
- [ ] allowed: allow with no FREED interruption - https://youtube.com/results?search_query=workout
- [ ] allowed: allow with no FREED interruption - https://instagram.com/explore
- [ ] allowed: allow with no FREED interruption - https://x.com/home
- [ ] allowed: allow with no FREED interruption - https://coursera.org/learn/math
- [ ] allowed: allow with no FREED interruption - https://netflix.com/browse
- [ ] allowed: allow with no FREED interruption - https://store.steampowered.com/app/123
- [ ] allowed: allow with no FREED interruption - https://notion.so/workspace
- [ ] allowed: allow with no FREED interruption - https://wikipedia.org/wiki/Exercise
- [ ] allowed: allow with no FREED interruption - https://open.spotify.com/
- [ ] allowed: allow with no FREED interruption - https://github.com/features/actions
- [ ] allowed: allow with no FREED interruption - https://roblox.com/discover
- [ ] recovery-search: allow with no FREED interruption - https://duckduckgo.com/?q=porn+addiction+therapy
- [ ] recovery-search: allow with no FREED interruption - https://google.com/search?q=porn+recovery+accountability
- [ ] recovery-search: allow with no FREED interruption - https://google.com/search?q=accountability+software+porn+addiction
- [ ] recovery-search: allow with no FREED interruption - https://duckduckgo.com/?q=quit+porn+support+group
- [ ] adult-blocked: block/intervene - https://bing.com/search?q=porn
- [ ] adult-blocked: block/intervene - https://pornhub.com/
- [ ] adult-blocked: block/intervene - https://google.com/search?q=free+explicit+videos
- [ ] adult-blocked: block/intervene - https://xvideos.com/

Result fields to transfer into `normalBrowsing.browserMatrix[]`:

- `isPhysicalDevice=true`
- `allowedUrlPassCount=12`
- `recoverySearchPassCount=4`
- `adultBlockPassCount=4`
- `falsePositiveCount=0`
- `missedAdultBlockCount=0`
- `passed=true`

## ANDROID Firefox (org.mozilla.firefox)

Run ID: `normal-browsing-current-android-firefox-normal-browsing`

- [ ] allowed: allow with no FREED interruption - https://google.com/search?q=weather
- [ ] allowed: allow with no FREED interruption - https://youtube.com/results?search_query=workout
- [ ] allowed: allow with no FREED interruption - https://instagram.com/explore
- [ ] allowed: allow with no FREED interruption - https://x.com/home
- [ ] allowed: allow with no FREED interruption - https://coursera.org/learn/math
- [ ] allowed: allow with no FREED interruption - https://netflix.com/browse
- [ ] allowed: allow with no FREED interruption - https://store.steampowered.com/app/123
- [ ] allowed: allow with no FREED interruption - https://notion.so/workspace
- [ ] allowed: allow with no FREED interruption - https://wikipedia.org/wiki/Exercise
- [ ] allowed: allow with no FREED interruption - https://open.spotify.com/
- [ ] allowed: allow with no FREED interruption - https://github.com/features/actions
- [ ] allowed: allow with no FREED interruption - https://roblox.com/discover
- [ ] recovery-search: allow with no FREED interruption - https://duckduckgo.com/?q=porn+addiction+therapy
- [ ] recovery-search: allow with no FREED interruption - https://google.com/search?q=porn+recovery+accountability
- [ ] recovery-search: allow with no FREED interruption - https://google.com/search?q=accountability+software+porn+addiction
- [ ] recovery-search: allow with no FREED interruption - https://duckduckgo.com/?q=quit+porn+support+group
- [ ] adult-blocked: block/intervene - https://bing.com/search?q=porn
- [ ] adult-blocked: block/intervene - https://pornhub.com/
- [ ] adult-blocked: block/intervene - https://google.com/search?q=free+explicit+videos
- [ ] adult-blocked: block/intervene - https://xvideos.com/

Result fields to transfer into `normalBrowsing.browserMatrix[]`:

- `isPhysicalDevice=true`
- `allowedUrlPassCount=12`
- `recoverySearchPassCount=4`
- `adultBlockPassCount=4`
- `falsePositiveCount=0`
- `missedAdultBlockCount=0`
- `passed=true`

## ANDROID Edge (com.microsoft.emmx)

Run ID: `normal-browsing-current-android-edge-normal-browsing`

- [ ] allowed: allow with no FREED interruption - https://google.com/search?q=weather
- [ ] allowed: allow with no FREED interruption - https://youtube.com/results?search_query=workout
- [ ] allowed: allow with no FREED interruption - https://instagram.com/explore
- [ ] allowed: allow with no FREED interruption - https://x.com/home
- [ ] allowed: allow with no FREED interruption - https://coursera.org/learn/math
- [ ] allowed: allow with no FREED interruption - https://netflix.com/browse
- [ ] allowed: allow with no FREED interruption - https://store.steampowered.com/app/123
- [ ] allowed: allow with no FREED interruption - https://notion.so/workspace
- [ ] allowed: allow with no FREED interruption - https://wikipedia.org/wiki/Exercise
- [ ] allowed: allow with no FREED interruption - https://open.spotify.com/
- [ ] allowed: allow with no FREED interruption - https://github.com/features/actions
- [ ] allowed: allow with no FREED interruption - https://roblox.com/discover
- [ ] recovery-search: allow with no FREED interruption - https://duckduckgo.com/?q=porn+addiction+therapy
- [ ] recovery-search: allow with no FREED interruption - https://google.com/search?q=porn+recovery+accountability
- [ ] recovery-search: allow with no FREED interruption - https://google.com/search?q=accountability+software+porn+addiction
- [ ] recovery-search: allow with no FREED interruption - https://duckduckgo.com/?q=quit+porn+support+group
- [ ] adult-blocked: block/intervene - https://bing.com/search?q=porn
- [ ] adult-blocked: block/intervene - https://pornhub.com/
- [ ] adult-blocked: block/intervene - https://google.com/search?q=free+explicit+videos
- [ ] adult-blocked: block/intervene - https://xvideos.com/

Result fields to transfer into `normalBrowsing.browserMatrix[]`:

- `isPhysicalDevice=true`
- `allowedUrlPassCount=12`
- `recoverySearchPassCount=4`
- `adultBlockPassCount=4`
- `falsePositiveCount=0`
- `missedAdultBlockCount=0`
- `passed=true`

## ANDROID Samsung Internet (com.sec.android.app.sbrowser)

Run ID: `normal-browsing-current-android-samsung-internet-normal-browsing`

- [ ] allowed: allow with no FREED interruption - https://google.com/search?q=weather
- [ ] allowed: allow with no FREED interruption - https://youtube.com/results?search_query=workout
- [ ] allowed: allow with no FREED interruption - https://instagram.com/explore
- [ ] allowed: allow with no FREED interruption - https://x.com/home
- [ ] allowed: allow with no FREED interruption - https://coursera.org/learn/math
- [ ] allowed: allow with no FREED interruption - https://netflix.com/browse
- [ ] allowed: allow with no FREED interruption - https://store.steampowered.com/app/123
- [ ] allowed: allow with no FREED interruption - https://notion.so/workspace
- [ ] allowed: allow with no FREED interruption - https://wikipedia.org/wiki/Exercise
- [ ] allowed: allow with no FREED interruption - https://open.spotify.com/
- [ ] allowed: allow with no FREED interruption - https://github.com/features/actions
- [ ] allowed: allow with no FREED interruption - https://roblox.com/discover
- [ ] recovery-search: allow with no FREED interruption - https://duckduckgo.com/?q=porn+addiction+therapy
- [ ] recovery-search: allow with no FREED interruption - https://google.com/search?q=porn+recovery+accountability
- [ ] recovery-search: allow with no FREED interruption - https://google.com/search?q=accountability+software+porn+addiction
- [ ] recovery-search: allow with no FREED interruption - https://duckduckgo.com/?q=quit+porn+support+group
- [ ] adult-blocked: block/intervene - https://bing.com/search?q=porn
- [ ] adult-blocked: block/intervene - https://pornhub.com/
- [ ] adult-blocked: block/intervene - https://google.com/search?q=free+explicit+videos
- [ ] adult-blocked: block/intervene - https://xvideos.com/

Result fields to transfer into `normalBrowsing.browserMatrix[]`:

- `isPhysicalDevice=true`
- `allowedUrlPassCount=12`
- `recoverySearchPassCount=4`
- `adultBlockPassCount=4`
- `falsePositiveCount=0`
- `missedAdultBlockCount=0`
- `passed=true`

