module.exports = {
  purge: ['./pages/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
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
          primary: '#17191D',
          secondary: '#1E2024',
        },
        blue: {
          light: '#3E66F9',
          lighter: '#7691ff',
        },
        gray: {
          light: '#353639',
          faded: 'rgba(255, 255, 255, 0.65)',
          fadedMore: 'rgba(255, 255, 255, 0.2)',
          fadedMost: 'rgba(255, 255, 255, 0.15)',
        },
        green: {
          normal: '#25B38F',
        },
        red: {
          normal: '#ED6564',
        },
      },
      width: {
        body: '77rem',
        dashboardLeft: '44.5rem',
        dashboardRight: '31.5rem',
        '104px': '6.5rem',
      },
      height: {
        marketCard: '13.375rem',
      },
      padding: {
        '2px': '2px',
      },
      fontSize: {
        '10px': '0.625rem',
        '14px': '0.875rem',
        '13px': '0.8125rem',
      },
      lineHeight: {
        '10px': '0.625rem',
        '14px': '0.875rem',
        '17px': '1.063rem',
      },
    },
  },
  variants: {},
  plugins: [],
};
