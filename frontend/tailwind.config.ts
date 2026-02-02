import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";
import tailwindcssAnimate from "tailwindcss-animate";

const config = {
  darkMode: "class",
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        // ใช้ Sarabun เป็นฟอนต์หลักเพื่อความอ่านง่ายสไตล์ราชการ
        sans: ["var(--font-sarabun)", ...defaultTheme.fontFamily.sans],
        // ใช้ Inter สำหรับตัวเลขให้ดูชัดเจน (เช่น เลขบัตร ปชช.)
        numbers: ["var(--font-inter)", ...defaultTheme.fontFamily.sans],
        // Legacy support aliases if needed, mapping to new system
        heading: ["var(--font-sarabun)", ...defaultTheme.fontFamily.sans],
        display: ["var(--font-sarabun)", ...defaultTheme.fontFamily.sans],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "#f8fafc", // Slate-50: พื้นหลังถนอมสายตา
        foreground: "hsl(var(--foreground))",

        // Medical Blue Theme
        primary: {
          DEFAULT: "#0284c7", // Sky-600: สีหลัก สดใสแต่นุ่มนวล
          foreground: "#ffffff",
          hover: "#0369a1", // Sky-700
        },
        secondary: {
          DEFAULT: "#f1f5f9", // Slate-100
          foreground: "#0f172a", // Slate-900
        },
        destructive: {
          DEFAULT: "#ef4444", // Red-500
          foreground: "#ffffff",
        },
        muted: {
          DEFAULT: "#f1f5f9",
          foreground: "#64748b", // Slate-500
        },
        accent: {
          DEFAULT: "#e0f2fe", // Sky-100
          foreground: "#0284c7",
        },
        popover: {
          DEFAULT: "#ffffff",
          foreground: "#0f172a",
        },
        card: {
          DEFAULT: "#ffffff",
          foreground: "#0f172a",
        },
      },
      borderRadius: {
        lg: "0.75rem", // 12px
        xl: "1rem",    // 16px (เน้นความมน)
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.05)', // เงาฟุ้งแบบ Minimal
      }
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;

export default config;
