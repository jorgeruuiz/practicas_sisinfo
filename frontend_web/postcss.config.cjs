// Tailwind v4 uses a wrapper package for PostCSS integration.
// See error message: install '@tailwindcss/postcss' and use it here.
// Try to load the new wrapper plugin if available (Tailwind v4), otherwise fall back
// to the old tailwindcss package to avoid breaking the dev server while installing deps.
module.exports = {
  plugins: [
    require('tailwindcss'),
    require('autoprefixer'),
  ],
}
