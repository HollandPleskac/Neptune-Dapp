module.exports = {
  purge: ['./pages/**/*.{js,ts,jsx,tsx}','./components/**/*.{js,ts,jsx,tsx}'],
  // content: [
  //   "./pages/**/*.{js,jsx,ts,tsx}",
  // ],
  future: {
    // removeDeprecatedGapUtilities: true,
    // purgeLayersByDefault: true,
  },
  theme: {
    extend: {
      colors: {
        dark: {
          primary: "#17191D",
          secondary: "#1E2024"
        }
      },
      width: {
        body: "77rem",
        dashboardLeft: "44.5rem",
        dashboardRight: "31.5rem",
      }
    },
  },
  variants: {},
  plugins: [],
}
