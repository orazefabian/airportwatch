/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          900: "#0a0f1e",
          800: "#0d1530",
          700: "#111d42",
          600: "#162050",
        },
      },
    },
  },
  plugins: [],
};
