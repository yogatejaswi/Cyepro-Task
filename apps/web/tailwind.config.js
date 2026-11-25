/** @type {import('tailwindcss').Config} */
export default { content: ['./index.html', './src/**/*.{ts,tsx}'], theme: { extend: { colors: { brand: { 50: '#edf6fb', 100: '#d8eaf5', 600: '#0876aa', 700: '#055e8d', 900: '#003b61' }, ink: '#142333' }, boxShadow: { card: '0 12px 35px rgba(23, 53, 74, .055)' } } }, plugins: [] };
