/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark theme base colors (default) - now using CSS variables
        background: 'var(--tw-color-background)',
        surface: 'var(--tw-color-surface)',
        'surface-hover': 'var(--tw-color-surface-hover)',
        
        // Border and text colors
        border: 'var(--tw-color-border)',
        
        // Primary DKB-inspired blue palette
        primary: 'var(--tw-color-primary)',      // Blue 500 - main brand color
        'primary-hover': 'var(--tw-color-primary-hover)', // Blue 600 - hover state
        'primary-light': 'var(--tw-color-primary-light)', // Blue 300 - light accent
        
        // DKB secondary blue (darker)
        'dkb-blue-dark': '#1e40af', // Blue 800 - kept as hex for stability
        
        // Status colors - use vars so they adapt to theme text contrast
        success: 'var(--tw-color-success)',      // Green 500 - positive indicators
        danger: 'var(--tw-color-danger)',       // Red 500 - negative/error states
        warning: 'var(--tw-color-warning)',      // Amber 500 - warnings
        
        // Additional accent colors for UI variety
        purple: '#8b5cf6',       // Violet 500 - secondary accent
        teal: '#14b8a6',         // Teal 500 - additional positive state
      },
    },
  },
  plugins: [],
}
