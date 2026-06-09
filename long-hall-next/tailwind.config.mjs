/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}',
    './public/**/*.html',
  ],
  // Safelist classes that may be dynamically generated or used in templates
  safelist: [
    // Animation classes used dynamically
    'animate-shake',
    'animate-pulse',
    'animate-pulse-slow',
    'animate-float',
    'animate-spin-slow',
    // Combat flash animations
    'animate-damage-flash',
    'animate-heal-flash',
    'animate-crit-flash',
    // Rarity colors (applied dynamically based on item rarity)
    { pattern: /^text-rarity-/ },
    { pattern: /^bg-rarity-/ },
    { pattern: /^border-rarity-/ },
    // Class colors (applied based on character class)
    { pattern: /^text-class-/ },
    { pattern: /^bg-class-/ },
    { pattern: /^border-class-/ },
    // Combat colors (applied during combat events)
    { pattern: /^text-combat-/ },
    { pattern: /^bg-combat-/ },
    // Stat bar colors
    { pattern: /^bg-stat-/ },
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand colors
        copper: {
          DEFAULT: '#b87333',
          light: '#d4956a',
          dark: '#8b5a2b',
        },
        // Parchment backgrounds
        parchment: {
          DEFAULT: '#faf8f5',
          dark: '#f5f0e8',
          card: '#fffdf9',
        },
        // Rarity progression
        rarity: {
          common: '#78716c',
          uncommon: '#22c55e',
          rare: '#3b82f6',
          epic: '#a855f7',
          legendary: '#f59e0b',
          godly: '#ef4444',
        },
        // Character classes
        class: {
          fighter: '#dc2626',
          wizard: '#7c3aed',
          rogue: '#10b981',
          cleric: '#f59e0b',
          ranger: '#059669',
        },
        // Combat/stat colors
        stat: {
          hp: '#ef4444',
          'hp-bg': '#fecaca',
          xp: '#8b5cf6',
          'xp-bg': '#ddd6fe',
          gold: '#f59e0b',
        },
        combat: {
          damage: '#ef4444',
          heal: '#22c55e',
          buff: '#3b82f6',
          debuff: '#f97316',
          miss: '#9ca3af',
          crit: '#fbbf24',
        },
      },
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        copper: '0 4px 12px rgba(184, 115, 51, 0.15)',
        'copper-lg': '0 8px 24px rgba(184, 115, 51, 0.2)',
      },
      borderRadius: {
        sm: '0.25rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'shake': 'shake 0.5s ease-in-out',
        'float': 'float 2s ease-in-out infinite',
        'damage-flash': 'damage-flash 0.3s ease-out',
        'heal-flash': 'heal-flash 0.3s ease-out',
        'crit-flash': 'crit-flash 0.4s ease-out',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-4px)' },
          '75%': { transform: 'translateX(4px)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'damage-flash': {
          '0%, 100%': { backgroundColor: 'transparent' },
          '50%': { backgroundColor: 'rgba(239, 68, 68, 0.3)' },
        },
        'heal-flash': {
          '0%, 100%': { backgroundColor: 'transparent' },
          '50%': { backgroundColor: 'rgba(34, 197, 94, 0.3)' },
        },
        'crit-flash': {
          '0%, 100%': { transform: 'scale(1)', color: '#fbbf24' },
          '50%': { transform: 'scale(1.2)', color: '#ef4444' },
        },
      },
      transitionDuration: {
        fast: '150ms',
        normal: '200ms',
        slow: '300ms',
      },
      spacing: {
        18: '4.5rem',
        22: '5.5rem',
      },
    },
  },
  plugins: [],
}
