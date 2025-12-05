module.exports = {
  content: [
    './App.{js,jsx,ts,tsx}',
    './index.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './screens/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        poppins: ['PoppinsRegular'], // 400
        poppinsMedium: ['PoppinsMedium'], // 500
        poppinsSemiBold: ['PoppinsSemiBold'], // 600
        poppinsBold: ['PoppinsBold'], // 700
        poppinsExtraBold: ['PoppinsExtraBold'], // 800
        poppinsBlack: ['PoppinsBlack'], // 900
      },
      sans: [
        'PoppinsRegular',
        'PoppinsMedium',
        'PoppinsSemiBold',
        'PoppinsBold',
        'PoppinsExtraBold',
        'PoppinsBlack',
      ],
      colors: {
        primary: '#9707B5', // Example blue/indigo shade
      },
    },
  },
  plugins: [],
};
