import type { BlockVerdict } from "../src/lib/blocking-engine";

export type ClassifierSafetyCase = {
  id: string;
  group: "normal-browsing" | "recovery-research" | "adult-search-intent" | "adult-domain" | "overmatch-guard";
  url: string;
  expected: BlockVerdict;
};

export const classifierSafetyCorpus: ClassifierSafetyCase[] = [
  { id: "google-weather", group: "normal-browsing", url: "https://google.com/search?q=weather", expected: "allow" },
  { id: "gmail", group: "normal-browsing", url: "https://mail.google.com/mail/u/0/#inbox", expected: "allow" },
  { id: "drive", group: "normal-browsing", url: "https://drive.google.com/drive/my-drive", expected: "allow" },
  { id: "youtube-workout", group: "normal-browsing", url: "https://youtube.com/results?search_query=discipline+workout", expected: "allow" },
  { id: "instagram", group: "normal-browsing", url: "https://instagram.com/p/example", expected: "allow" },
  { id: "x-productivity", group: "normal-browsing", url: "https://x.com/search?q=productivity", expected: "allow" },
  { id: "twitter-mental-health", group: "normal-browsing", url: "https://twitter.com/search?q=mental+health", expected: "allow" },
  { id: "reddit-discipline", group: "normal-browsing", url: "https://reddit.com/r/getdisciplined", expected: "allow" },
  { id: "facebook-marketplace", group: "normal-browsing", url: "https://facebook.com/marketplace", expected: "allow" },
  { id: "linkedin-jobs", group: "normal-browsing", url: "https://linkedin.com/jobs", expected: "allow" },
  { id: "wikipedia-habits", group: "normal-browsing", url: "https://wikipedia.org/wiki/Habit_formation", expected: "allow" },
  { id: "github-expo", group: "normal-browsing", url: "https://github.com/expo/expo", expected: "allow" },
  { id: "stackoverflow-react-native", group: "normal-browsing", url: "https://stackoverflow.com/questions/tagged/react-native", expected: "allow" },
  { id: "netflix", group: "normal-browsing", url: "https://netflix.com/browse", expected: "allow" },
  { id: "spotify-focus", group: "normal-browsing", url: "https://spotify.com/search/focus", expected: "allow" },
  { id: "twitch-dev", group: "normal-browsing", url: "https://twitch.tv/directory/category/software-and-game-development", expected: "allow" },
  { id: "roblox", group: "normal-browsing", url: "https://roblox.com/discover", expected: "allow" },
  { id: "minecraft", group: "normal-browsing", url: "https://minecraft.net/en-us", expected: "allow" },
  { id: "coursera", group: "normal-browsing", url: "https://coursera.org/learn/learning-how-to-learn", expected: "allow" },
  { id: "khan-academy", group: "normal-browsing", url: "https://khanacademy.org/science", expected: "allow" },
  { id: "duckduckgo-recovery", group: "recovery-research", url: "https://duckduckgo.com/?q=porn+addiction+therapy", expected: "allow" },
  { id: "google-recovery", group: "recovery-research", url: "https://google.com/search?q=porn+addiction+recovery", expected: "allow" },
  { id: "youtube-education", group: "recovery-research", url: "https://youtube.com/results?search_query=effects+of+adult+video+consumption", expected: "allow" },
  { id: "reddit-support", group: "recovery-research", url: "https://reddit.com/search?q=porn+addiction+dopamine+support", expected: "allow" },
  { id: "recovery-domain", group: "recovery-research", url: "https://porn-addiction-recovery.example.org", expected: "allow" },
  { id: "google-accountability-partner", group: "recovery-research", url: "https://google.com/search?q=porn+accountability+partner", expected: "allow" },
  { id: "duckduckgo-relapse-prevention", group: "recovery-research", url: "https://duckduckgo.com/?q=porn+relapse+prevention+plan", expected: "allow" },
  { id: "youtube-urge-surfing", group: "recovery-research", url: "https://youtube.com/results?search_query=porn+urge+surfing+exercise", expected: "allow" },
  { id: "google-nofap-sobriety", group: "recovery-research", url: "https://google.com/search?q=nofap+porn+sobriety+support", expected: "allow" },
  { id: "accountability-domain", group: "recovery-research", url: "https://porn-accountability.example.org", expected: "allow" },
  { id: "relapse-prevention-domain", group: "recovery-research", url: "https://nsfw-relapse-prevention.example.org", expected: "allow" },
  { id: "corn-recipes", group: "overmatch-guard", url: "https://corn-recipes.example.com", expected: "allow" },
  { id: "support-center", group: "overmatch-guard", url: "https://support-center.example.com", expected: "allow" },
  { id: "classroom", group: "overmatch-guard", url: "https://classroom.example.edu", expected: "allow" },
  { id: "xylophone", group: "overmatch-guard", url: "https://xylophone-lessons.example.org", expected: "allow" },
  { id: "bing-adult-intent", group: "adult-search-intent", url: "https://bing.com/search?q=porn", expected: "block" },
  { id: "google-free-adult-video", group: "adult-search-intent", url: "https://google.com/search?q=free+porn+video", expected: "block" },
  { id: "safe-wording-mixed-intent", group: "adult-search-intent", url: "https://google.com/search?q=free+porn+recovery+video", expected: "block" },
  { id: "accountability-mixed-consumption", group: "adult-search-intent", url: "https://google.com/search?q=free+porn+accountability+videos", expected: "block" },
  { id: "explicit-image-search", group: "adult-search-intent", url: "https://duckduckgo.com/?q=nsfw+video+images", expected: "block" },
  { id: "adult-seed", group: "adult-domain", url: "https://pornhub.com/watch?private=1", expected: "block" },
  { id: "adult-seed-cam", group: "adult-domain", url: "https://livejasmin.com/en/private", expected: "block" },
  { id: "adult-seed-hentai", group: "adult-domain", url: "https://nhentai.net/g/example", expected: "block" },
  { id: "adult-seed-short", group: "adult-domain", url: "https://sex.com", expected: "block" },
  { id: "adult-seed-video", group: "adult-domain", url: "https://eporner.com/video-example", expected: "block" },
  { id: "adult-token-videos", group: "adult-domain", url: "https://porn-videos.example.com", expected: "block" },
  { id: "adult-token-gallery", group: "adult-domain", url: "https://nsfw-gallery.example.net", expected: "block" },
  { id: "adult-token-stream", group: "adult-domain", url: "https://hentai-stream.example.org", expected: "block" },
  { id: "adult-token-tube", group: "adult-domain", url: "https://xxx-tube.example.tv", expected: "block" }
];
