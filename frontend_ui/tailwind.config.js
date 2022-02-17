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
        },
        gray: {
          light: '#353639',
          faded: 'rgba(255, 255, 255, 0.65)',
        },
        green: {
          normal: '#25B38F',
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
        '10px': '0.63rem',
        '13px': '0.8125rem',
        '14px': '0.88rem',
        'xxs': '0.6875rem',
        'xxxs': '0.63rem'
      },
    },
  },
  variants: {},
  plugins: [],
};
