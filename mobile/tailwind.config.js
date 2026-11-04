/** @type {import('tailwindcss').Config} */
// Palette mirrors client/DESIGN.md (warm paper). The older class names (background, foreground,
// border, power-orange, deep-slate ...) stay as aliases so screens built before the redesign keep working.
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        canvas: "#F8F3EA",
        "canvas-deep": "#EFE7DA",
        wash: "#FBE9D9",
        surface: "#FFFFFF",
        ink: "#1C1B1A",
        body: "#4A4741",
        muted: "#7A766E",
        ash: "#A8A5A0",
        hairline: "#E1DCD3",
        action: "#C2410C",
        "action-hover": "#9A3412",
        "brand-orange": "#E97316",
        success: "#15803D",
        danger: "#B91C1C",

        "power-orange": "#E97316",
        "deep-slate": "#1C1B1A",
        "ghost-white": "#F8F3EA",
        "turf-green": "#15803D",
        "error-red": "#B91C1C",
        background: "#F8F3EA",
        foreground: "#1C1B1A",
        border: "#E1DCD3",
        card: "#FFFFFF",
        "card-foreground": "#1C1B1A",
        primary: "#1C1B1A",
        "primary-foreground": "#FFFFFF",
      },
      // React Native picks a font file per weight, so each weight is its own family name.
      fontFamily: {
        sans: ["Geist_400Regular"],
        "sans-medium": ["Geist_500Medium"],
        "sans-semibold": ["Geist_600SemiBold"],
        serif: ["Newsreader_400Regular"],
        "serif-light": ["Newsreader_300Light"],
        "serif-italic": ["Newsreader_400Regular_Italic"],
      },
      borderRadius: {
        button: "6px",
        tile: "16px",
        panel: "24px",
      },
    },
  },
  plugins: [],
};
