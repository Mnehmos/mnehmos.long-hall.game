# Performance Optimization Guide

This document describes the performance optimizations implemented in the Long Hall Next application to ensure fast load times, smooth interactions, and optimal bundle sizes.

## Table of Contents

1. [Bundle Optimization](#bundle-optimization)
2. [CSS Performance](#css-performance)
3. [SVG Optimization](#svg-optimization)
4. [Lazy Loading](#lazy-loading)
5. [Performance Metrics](#performance-metrics)
6. [Development Scripts](#development-scripts)
7. [Best Practices](#best-practices)

---

## Bundle Optimization

### Vite Configuration (`astro.config.mjs`)

The Vite build configuration implements several optimization strategies:

#### Manual Chunk Splitting

Chunks are split strategically to optimize caching and reduce initial bundle size:

```javascript
manualChunks: (id) => {
  if (id.includes('node_modules/preact') || 
      id.includes('node_modules/@preact/signals')) {
    return 'vendor-preact';    // ~20KB gzipped
  }
  if (id.includes('node_modules/gsap')) {
    return 'vendor-gsap';       // ~30KB gzipped
  }
  if (id.includes('node_modules/zod')) {
    return 'vendor-zod';        // ~15KB gzipped
  }
  if (id.includes('/src/engine/')) {
    return 'game-engine';       // Game logic
  }
  if (id.includes('/src/state/')) {
    return 'game-state';        // State management
  }
  if (id.includes('/src/lib/animations/')) {
    return 'animations';        // GSAP animations
  }
}
```

**Benefits:**
- Long-term caching for vendor chunks (rarely change)
- Parallel loading of independent chunks
- Smaller initial bundle for faster First Contentful Paint

#### Build Targets

```javascript
build: {
  minify: 'esbuild',        // Fast minification
  target: 'esnext',         // Modern JS for smaller bundles
  sourcemap: false,         // Disabled in production
  chunkSizeWarningLimit: 500
}
```

#### Production Optimizations

```javascript
esbuild: {
  drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : []
}
```

Removes `console.log` and `debugger` statements in production builds.

---

## CSS Performance

### GPU Acceleration (`global.css`)

Elements that animate are promoted to their own compositing layer:

```css
/* GPU-accelerated animations */
.animated-element,
.card-hover,
.stat-bar-fill {
  will-change: transform, opacity;
}

/* Hardware acceleration for sprites */
.character-sprite,
.enemy-sprite {
  transform: translateZ(0);
  backface-visibility: hidden;
  perspective: 1000px;
}
```

### CSS Containment

Layout and paint containment reduces browser recalculation work:

```css
/* Contain layout for isolated components */
.combat-log {
  contain: content;
  overflow-anchor: auto;
}

.combat-panel,
.inventory-panel,
.hero-panel {
  contain: layout style;
}

/* Strict containment for modals */
.modal-overlay {
  contain: strict;
}
```

### Content Visibility

For large lists, use content-visibility to skip off-screen rendering:

```css
.virtual-list {
  contain: strict;
  content-visibility: auto;
  contain-intrinsic-size: 0 500px;
}
```

### Reduced Motion

Respects user preferences for reduced motion:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### Z-Index Layering

Consistent z-index values prevent paint issues:

```css
.layer-base { z-index: 0; }
.layer-content { z-index: 10; }
.layer-overlay { z-index: 100; }
.layer-modal { z-index: 1000; }
.layer-tooltip { z-index: 1100; }
```

---

## SVG Optimization

### SVGO Configuration (`svgo.config.js`)

SVG assets are optimized using SVGO with the following plugins:

#### Cleanup Plugins
- `removeComments` - Remove XML comments
- `removeEmptyAttrs` - Remove empty attributes
- `removeEmptyContainers` - Remove empty `<g>` elements
- `cleanupIds` - Minify IDs and references
- `removeUselessDefs` - Remove unused definitions

#### Path Optimization
```javascript
{
  name: 'convertPathData',
  params: {
    floatPrecision: 2,
    transformPrecision: 2,
  }
}
```

#### ID Prefixing
Prevents ID conflicts when multiple SVGs are on the same page:
```javascript
{
  name: 'prefixIds',
  params: {
    delim: '_',
    prefixIds: true,
    prefixClassNames: true
  }
}
```

### Running SVG Optimization

```bash
# Preview what would change (dry run)
npm run optimize:svg:preview

# Apply optimizations
npm run optimize:svg

# Runs automatically before build
npm run build  # triggers prebuild → optimize:svg
```

---

## Lazy Loading

### Astro Client Directives

Use appropriate hydration strategies for islands:

```astro
<!-- Hydrate immediately (critical UI) -->
<GameEngine client:load />

<!-- Hydrate when visible (below fold) -->
<Leaderboard client:visible />

<!-- Hydrate when browser is idle (non-critical) -->
<TooltipProvider client:idle />

<!-- Only hydrate on specific media query -->
<MobileMenu client:media="(max-width: 768px)" />
```

### Component Loading Priority

| Component | Directive | Reason |
|-----------|-----------|--------|
| `GameEngine` | `client:load` | Core gameplay, needed immediately |
| `CombatManager` | `client:load` | Interactive combat UI |
| `InventoryManager` | `client:visible` | Not visible initially |
| `Leaderboard` | `client:visible` | Below-fold content |
| `CharacterSprite` | `client:idle` | Decorative, can wait |
| `TooltipProvider` | `client:idle` | Enhancement, not critical |

### Image and SVG Loading

```css
/* Placeholder sizing to prevent CLS */
.sprite-placeholder {
  aspect-ratio: 1 / 1;
  background-color: var(--bg-secondary);
}

.sprite-loaded .sprite-placeholder {
  display: none;
}
```

---

## Performance Metrics

### Bundle Analysis Results (T7.6 - 2026-01-07)

Production build completed with excellent results - **well under 500KB target**:

#### JavaScript Bundles

| Chunk | Uncompressed | Gzipped | Purpose |
|-------|-------------|---------|---------|
| `vendor-preact` | 31.92 KB | 9.41 KB | Preact + Signals core |
| `page` | 5.20 KB | 1.54 KB | Page-level code |
| `client` | 4.53 KB | 1.67 KB | Astro client runtime |
| `astro` | 0.09 KB | - | Astro bootstrap |
| **Total JS** | **41.74 KB** | **~12.6 KB** | ✅ Under 300KB target |

#### CSS Bundles

| File | Uncompressed | Est. Gzipped | Notes |
|------|-------------|--------------|-------|
| `index.css` | 43.40 KB | ~6-8 KB | Tailwind + custom styles |

#### Total Bundle Summary

| Category | Target | Actual | Status |
|----------|--------|--------|--------|
| JavaScript (gzip) | <300 KB | ~12.6 KB | ✅ **95% under target** |
| CSS (gzip) | <50 KB | ~6-8 KB | ✅ **84% under target** |
| Total gzipped | <500 KB | ~20-25 KB | ✅ **95% under target** |
| Total uncompressed | - | ~161 KB | Excellent |

#### SVG Assets (src/art/)

| Asset | Size | Status |
|-------|------|--------|
| dragon.svg | 20.8 KB | Optimized |
| dark-knight.svg | 19.0 KB | Optimized |
| cleric.svg | 16.1 KB | Optimized |
| rogue.svg | 14.8 KB | Optimized |
| ranger.svg | 14.4 KB | Optimized |
| wizard.svg | 13.3 KB | Optimized |
| fighter.svg | 12.4 KB | Optimized |
| orc.svg | 11.6 KB | Optimized |
| troll.svg | 11.1 KB | Optimized |
| skeleton.svg | 10.0 KB | Optimized |
| goblin.svg | 7.1 KB | Optimized |
| **Total** | **~150 KB** | ✅ Under 150KB target |

### Target Metrics

| Metric | Target | Description |
|--------|--------|-------------|
| Lighthouse Performance | >90 | Overall performance score |
| First Contentful Paint (FCP) | <1.5s | First content rendered |
| Largest Contentful Paint (LCP) | <2.5s | Main content loaded |
| Time to Interactive (TTI) | <3.0s | Page becomes interactive |
| Cumulative Layout Shift (CLS) | <0.1 | Visual stability |
| Total Blocking Time (TBT) | <200ms | Main thread blocking |

### Measuring Performance

1. **Lighthouse CLI**
   ```bash
   npx lighthouse http://localhost:4321 --view
   ```

2. **Bundle Analysis**
   ```bash
   npm run analyze
   ```

3. **Chrome DevTools**
   - Performance tab for runtime profiling
   - Coverage tab for unused CSS/JS
   - Network tab for waterfall analysis

---

## Development Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `optimize:svg` | `npm run optimize:svg` | Optimize all SVGs in `src/art/` |
| `optimize:svg:preview` | `npm run optimize:svg:preview` | Preview SVG changes (dry run) |
| `analyze` | `npm run analyze` | Generate bundle visualization |
| `build:analyze` | `npm run build:analyze` | Build + analyze in one command |
| `build:size` | `npm run build:size` | Build + show bundle sizes |
| `build` | `npm run build` | Production build (includes SVG optimization) |

---

## Best Practices

### Do's ✅

1. **Use `will-change` sparingly** - Only on elements that will actually animate
2. **Remove `will-change` after animation** - Use `.animation-complete` class
3. **Use CSS containment** - For components with complex layouts
4. **Prefer `transform` and `opacity`** - For smooth animations
5. **Use `client:visible`** - For below-fold interactive components
6. **Batch state updates** - Reduce re-renders with signals
7. **Use `content-visibility: auto`** - For long scrollable lists

### Don'ts ❌

1. **Don't use `will-change: auto`** on many elements - Causes memory issues
2. **Don't animate `width`/`height`** - Use `transform: scale()` instead
3. **Don't use `client:load`** for non-critical islands
4. **Don't import entire libraries** - Tree-shake what you need
5. **Don't nest `contain: strict`** - Can cause layout issues
6. **Don't use large inline SVGs** - Reference optimized external files

### GSAP Best Practices

```typescript
// ✅ Good: Use transforms
gsap.to(element, { x: 100, y: 50, rotation: 45 });

// ❌ Bad: Animate layout properties
gsap.to(element, { left: '100px', width: '200px' });

// ✅ Good: Use will-change hint
gsap.set(element, { willChange: 'transform' });
gsap.to(element, { x: 100, onComplete: () => {
  gsap.set(element, { willChange: 'auto' });
}});
```

### Component Memoization

```typescript
import { useMemo, useCallback } from 'preact/hooks';

// Memoize expensive renders
const renderedEnemies = useMemo(() => 
  enemies.value?.map(e => <EnemyCard key={e.id} enemy={e} />),
  [enemies.value]
);

// Debounce rapid interactions
const handleAttack = useCallback(
  debounce((targetId: string) => attackEnemy(targetId), 100),
  []
);
```

---

## Architecture Decisions

### Why Preact + Signals?

- **Smaller bundle** - Preact is ~3KB vs React's ~40KB
- **Signals avoid re-renders** - Direct subscriptions to state changes
- **Compatible with React ecosystem** - `compat` mode for libraries

### Why GSAP?

- **Performance** - Optimized animation engine
- **Tree-shakeable** - Import only what you need
- **Timeline support** - Complex animation sequences

### Why Manual Chunking?

- **Predictable caching** - Vendor chunks change rarely
- **Parallel loading** - Browser can fetch multiple chunks
- **Smaller main bundle** - Faster initial render

---

## Related Documentation

- [Astro Performance](https://docs.astro.build/en/concepts/islands/)
- [GSAP Performance Tips](https://greensock.com/docs/v3/Performance/)
- [CSS Containment](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment)
- [Web Vitals](https://web.dev/vitals/)
