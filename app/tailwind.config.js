import animate from "tailwindcss-animate";
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      // Escala única de texto da interface: 13 (apoio) / 15 (corpo) / 16 (base). Antes havia 8,5 a 17px misturados.
      fontFamily: { sans: ["var(--f-ui)", "system-ui", "sans-serif"], mono: ["var(--f-mono)", "monospace"] },
      fontSize: { xs: ["0.8125rem", "1.25rem"], sm: ["0.9375rem", "1.4rem"] },
      colors: {
        border: "hsl(var(--border))", input: "hsl(var(--input))", ring: "hsl(var(--ring))",
        background: "hsl(var(--background))", foreground: "hsl(var(--foreground))",
        ok: "hsl(var(--ok))", warn: "hsl(var(--warn))", err: "hsl(var(--err))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
      },
      // Raios: sm/md = --r-md, lg/xl = --r-lg (Configurações → Aparência → Forma); padrão 8 e 12.
      borderRadius: { sm: "var(--r-md, 0.5rem)", md: "var(--r-md, 0.5rem)", lg: "var(--r-lg, 0.75rem)", xl: "var(--r-lg, 0.75rem)" },
    },
  },
  plugins: [animate],
};
