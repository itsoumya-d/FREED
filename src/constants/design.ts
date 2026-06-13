export const colors = {
  bg: "#1B1929",
  bgDeep: "#0B0820",
  surface: "#242236",
  surface2: "#2D2A44",
  surface3: "#393455",
  text: "#F6F1FF",
  text2: "#BEB7D9",
  text3: "#726B98",
  purple: "#B898FF",
  purpleDeep: "#7B4DFF",
  peach: "#FF9B72",
  pink: "#FF6D9E",
  mint: "#5ADF9E",
  sky: "#82CEFF",
  yellow: "#FFD666",
  red: "#D91612",
  red2: "#FF5148",
  black: "#090713",
  white: "#FFFFFF"
};

export const gradients = {
  app: ["#090622", "#171138", "#251551"] as const,
  hero: ["#11123A", "#4D1F71", "#D75A8A"] as const,
  purple: ["#271540", "#1E1130"] as const,
  peach: ["#3E2214", "#2C1A10"] as const,
  pink: ["#3E1624", "#2C1018"] as const,
  mint: ["#143028", "#10221C"] as const,
  sky: ["#152840", "#111E2C"] as const,
  yellow: ["#302614", "#221C10"] as const,
  danger: ["#8C100D", "#D91612"] as const,
  cta: ["#B438F0", "#1667FF"] as const,
  calm: ["#13465A", "#17345B", "#2A215B"] as const
};

export const radii = {
  sm: 12,
  md: 18,
  lg: 24,
  xl: 32,
  pill: 999
};

export const spacing = {
  page: 20,
  section: 18
};

// Typography — the freed-v2 reference uses Nunito at heavy weights (800/900).
// We expose the font-family token so it can be loaded via expo-font/@expo-google-fonts.
// Until the font file ships in the bundle, React Native falls back to the platform's
// rounded sans-serif (San Francisco on iOS, Roboto on Android), which keeps the
// heavy-weight look while staying lightweight.
export const typography = {
  family: "Nunito",
  familyFallback: undefined as string | undefined,
  heavy: "900" as const,
  bold: "800" as const,
  semibold: "700" as const,
  medium: "600" as const,
  regular: "500" as const
};

export const shadow = {
  glowPurple: {
    boxShadow: "0 12px 40px rgba(184, 152, 255, 0.28)"
  },
  glowRed: {
    boxShadow: "0 12px 44px rgba(217, 22, 18, 0.35)"
  },
  soft: {
    boxShadow: "0 16px 44px rgba(0, 0, 0, 0.28)"
  }
};

export const starField = Array.from({ length: 58 }, (_, index) => {
  const x = (index * 37) % 100;
  const y = (index * 61) % 100;
  const size = index % 9 === 0 ? 3 : index % 4 === 0 ? 2 : 1;
  const opacity = 0.16 + ((index * 17) % 50) / 100;
  return { x, y, size, opacity };
});
