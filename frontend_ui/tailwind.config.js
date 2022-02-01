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
        },
        blue: {
          light: "#3E66F9"
        }
      },
      width: {
        body: "77rem",
        dashboardLeft: "44.5rem",
        dashboardRight: "31.5rem",
        "104px": "6.5rem"
      },
      fontSize: {
        "10px": "0.63rem",
        "14px": "0.88rem"
      }
    },
  },
  variants: {},
  plugins: [],
}
