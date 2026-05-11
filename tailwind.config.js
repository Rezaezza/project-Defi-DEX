module.exports = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      boxShadow: {
        glow: "0 0 40px rgba(56, 189, 248, 0.18)",
      },
      backgroundImage: {
        "blue-glow": "radial-gradient(circle at top, rgba(56, 189, 248, 0.16), transparent 40%), radial-gradient(circle at 80% 20%, rgba(59, 130, 246, 0.18), transparent 30%)",
      },
    }
  },
  plugins: []
};
