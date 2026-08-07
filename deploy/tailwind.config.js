/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      // One spelling per size: the named utilities are pinned to the same
      // metrics the old arbitrary values (text-[12px]/text-[14px]) rendered
      // with (inherited 1.5 line-height), so text-xs/text-sm are the canon.
      fontSize: {
        xs: ['12px', { lineHeight: '1.5' }],
        sm: ['14px', { lineHeight: '1.5' }],
      },
    },
  },
  plugins: [],
};
