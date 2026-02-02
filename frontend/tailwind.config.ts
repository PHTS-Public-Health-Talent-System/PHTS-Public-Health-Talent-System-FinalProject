import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // ตั้งค่าให้ sans (default) ใช้ Source Sans 3 ก่อน แล้วตามด้วย Sarabun
        sans: ["var(--font-sans)", "var(--font-sarabun)", ...defaultTheme.fontFamily.sans],
        // Heading ใช้ Lexend
        heading: ["var(--font-heading)", ...defaultTheme.fontFamily.sans],
        // ถ้าต้องการเรียกใช้ภาษาไทยเฉพาะเจาะจง
        thai: ["var(--font-sarabun)", ...defaultTheme.fontFamily.sans],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // สีจาก frontend_old/theme/palette.ts
        phts: {
          primary: "#006C9C",      // deep teal/blue main
          primaryDark: "#004B75",  // hover state
          secondary: "#009688",    // secondary teal
          background: "#F4F6F8",   // page background (light gray)
          text: "#212B36",         // primary text (grey[800])
          textSec: "#637381",      // secondary text (grey[600])
          error: "#FF4842",        // error state
        }
      },
    },
  },
  plugins: [],
};
export default config;
