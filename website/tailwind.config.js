export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  corePlugins: { preflight: false },
  theme: { extend: { fontFamily: { geist: ['var(--vi-font-site)'] } } },
  plugins: [],
};
