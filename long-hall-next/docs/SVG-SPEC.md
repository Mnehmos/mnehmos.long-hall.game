# SVG Character Template Specification

> **Document ID**: `SVG-SPEC-001`  
> **Version**: `1.0.0`  
> **Created**: 2026-01-05  
> **Phase**: Phase 3 - SVG Art System  
> **Task**: S3.1.1  

## Overview

This specification defines the structure, naming conventions, and styling system for all character SVG assets in The Long Hall. All hero and enemy artwork must conform to these standards to ensure consistent rendering, animation support, and accessibility compliance.

---

## 1. ViewBox Dimensions

All SVGs use a unitless coordinate system for scalability. The viewBox defines the internal coordinate space.

### 1.1 Standard Dimensions

| Character Type | viewBox | Aspect Ratio | Use Case |
|----------------|---------|--------------|----------|
| **Hero** | `0 0 100 150` | 2:3 (portrait) | Player characters, NPCs, recruits |
| **Enemy (Regular)** | `0 0 100 100` | 1:1 (square) | Standard combat enemies |
| **Boss** | `0 0 150 150` | 1:1 (square) | Boss encounters, elite enemies |

### 1.2 Rationale

- **Heroes (100×150)**: Taller format accommodates humanoid proportions, equipment details, and class-specific silhouettes. The portrait orientation matches the `HeroPanel` and `PaperDoll` component layouts.

- **Enemies (100×100)**: Square format provides flexibility for various creature shapes (bipedal, quadrupedal, amorphous). Works well in the `EnemyCard` grid layout.

- **Bosses (150×150)**: Larger canvas for more detailed artwork and imposing presence. The extra 50% size creates visual hierarchy in combat encounters.

### 1.3 SVG Root Element Template

```xml
<!-- Hero Template -->
<svg xmlns="http://www.w3.org/2000/svg" 
     viewBox="0 0 100 150"
     role="img" 
     aria-label="[Character Name] - [Class]">
  <!-- content -->
</svg>

<!-- Enemy Template -->
<svg xmlns="http://www.w3.org/2000/svg" 
     viewBox="0 0 100 100"
     role="img" 
     aria-label="[Enemy Name]">
  <!-- content -->
</svg>

<!-- Boss Template -->
<svg xmlns="http://www.w3.org/2000/svg" 
     viewBox="0 0 150 150"
     role="img" 
     aria-label="[Boss Name] - Boss">
  <!-- content -->
</svg>
```

---

## 2. Layer Structure

SVG content is organized into semantic layers using `<g>` (group) elements. Layers are rendered in document order (first = back, last = front).

### 2.1 Layer Order (Bottom to Top)

```xml
<svg viewBox="0 0 100 150">
  <!-- Layer 1: Background/Shadow (optional) -->
  <g id="layer-bg" class="layer-bg">
    <!-- Drop shadows, ground indicators -->
  </g>
  
  <!-- Layer 2: Body Base -->
  <g id="layer-body" class="layer-body">
    <!-- Core character shape, skin, base clothing -->
  </g>
  
  <!-- Layer 3: Equipment Overlay -->
  <g id="layer-equipment" class="layer-equipment">
    <!-- Armor, weapons, accessories -->
  </g>
  
  <!-- Layer 4: Effects -->
  <g id="layer-effects" class="layer-effects">
    <!-- Glows, particles, status indicators -->
  </g>
</svg>
```

### 2.2 Layer Descriptions

| Layer | ID | Purpose | Z-Index |
|-------|-----|---------|---------|
| **Background** | `layer-bg` | Drop shadows, ground shadows, environmental context | 0 |
| **Body** | `layer-body` | Character silhouette, skin, face, hair, base clothing | 1 |
| **Equipment** | `layer-equipment` | Armor pieces, held weapons, capes, accessories | 2 |
| **Effects** | `layer-effects` | Magical glows, status effects, hit flashes, particles | 3 |

### 2.3 Layer Visibility Control

Layers can be toggled via CSS for different display contexts:

```css
/* Hide effects layer in thumbnail view */
.thumbnail .layer-effects {
  display: none;
}

/* Show only body for silhouette preview */
.silhouette .layer-equipment,
.silhouette .layer-effects {
  display: none;
}
```

---

## 3. Animation State Groups

Each animation state is defined as a group containing the complete character pose. Only one state is visible at a time, controlled via CSS or JavaScript.

### 3.1 Required Animation States

| State ID | Description | When Shown |
|----------|-------------|------------|
| `#state-idle` | Default standing pose | Default, between actions |
| `#state-attack` | Attack/action pose | During attack animation |
| `#state-hurt` | Damage reaction pose | When taking damage |
| `#state-death` | Defeated pose | At 0 HP, before removal |

### 3.2 State Group Structure

```xml
<svg viewBox="0 0 100 150">
  <!-- Animation States Container -->
  <g id="states">
    <!-- Idle State (default visible) -->
    <g id="state-idle" class="anim-state active">
      <g id="layer-bg"><!-- ... --></g>
      <g id="layer-body"><!-- ... --></g>
      <g id="layer-equipment"><!-- ... --></g>
      <g id="layer-effects"><!-- ... --></g>
    </g>
    
    <!-- Attack State (hidden by default) -->
    <g id="state-attack" class="anim-state">
      <g id="layer-bg"><!-- ... --></g>
      <g id="layer-body"><!-- ... --></g>
      <g id="layer-equipment"><!-- ... --></g>
      <g id="layer-effects"><!-- ... --></g>
    </g>
    
    <!-- Hurt State (hidden by default) -->
    <g id="state-hurt" class="anim-state">
      <!-- ... layers ... -->
    </g>
    
    <!-- Death State (hidden by default) -->
    <g id="state-death" class="anim-state">
      <!-- ... layers ... -->
    </g>
  </g>
</svg>
```

### 3.3 State Visibility CSS

```css
/* Hide all states by default */
.anim-state {
  opacity: 0;
  visibility: hidden;
}

/* Show active state */
.anim-state.active {
  opacity: 1;
  visibility: visible;
}
```

### 3.4 Optional Animation States

These states are optional and can be added for enhanced visual feedback:

| State ID | Description | Use Case |
|----------|-------------|----------|
| `#state-cast` | Spellcasting pose | Wizard, Cleric abilities |
| `#state-defend` | Blocking pose | Shield users, dodge |
| `#state-special` | Unique ability pose | Class-specific skills |
| `#state-victory` | Celebration pose | Combat victory |

---

## 4. CSS Variable Theming System

All colors in SVGs should use CSS custom properties for consistent theming and runtime customization.

### 4.1 Class Color Tokens

These tokens are defined in [`tokens.css`](../src/styles/tokens.css:35-41) and map to the [`Role`](../src/engine/types.ts:1) type:

| Role | CSS Variable | Hex Value | Usage |
|------|--------------|-----------|-------|
| `fighter` | `--class-fighter` | `#dc2626` | Primary accent, weapon glow |
| `wizard` | `--class-wizard` | `#7c3aed` | Magic effects, robes |
| `rogue` | `--class-rogue` | `#10b981` | Stealth effects, cloak |
| `cleric` | `--class-cleric` | `#f59e0b` | Divine glow, vestments |
| `ranger` | `--class-ranger` | `#059669` | Nature effects, cloak |

### 4.2 Hero-Specific CSS Variables

Each hero SVG should define local overrides for consistent theming:

```xml
<svg viewBox="0 0 100 150" style="
  --hero-primary: var(--class-fighter);
  --hero-secondary: var(--copper);
  --hero-skin: #f5deb3;
  --hero-hair: #4a3728;
">
```

| Variable | Purpose | Default |
|----------|---------|---------|
| `--hero-primary` | Main class color accent | Class token |
| `--hero-secondary` | Secondary accent | `--copper` |
| `--hero-skin` | Skin tone | Varies |
| `--hero-hair` | Hair color | Varies |

### 4.3 Using Variables in SVG Elements

```xml
<!-- Solid fill with class color -->
<rect fill="var(--hero-primary)" />

<!-- Gradient using CSS variables -->
<linearGradient id="sword-gradient">
  <stop offset="0%" stop-color="var(--hero-primary)" />
  <stop offset="100%" stop-color="var(--hero-secondary)" />
</linearGradient>

<!-- Effect glow using class color -->
<circle fill="var(--hero-primary)" filter="url(#glow)" />
```

### 4.4 Combat Effect Colors

For damage/heal indicators and status effects:

| Variable | Hex Value | Usage |
|----------|-----------|-------|
| `--damage` | `#ef4444` | Damage numbers, hit flash |
| `--heal` | `#22c55e` | Heal numbers, restoration glow |
| `--buff` | `#3b82f6` | Buff indicators |
| `--debuff` | `#f97316` | Debuff indicators |
| `--crit` | `#fbbf24` | Critical hit flash |

### 4.5 Rarity Colors (for Equipment Glow)

| Rarity | Variable | Hex Value |
|--------|----------|-----------|
| Common | `--rarity-common` | `#78716c` |
| Uncommon | `--rarity-uncommon` | `#22c55e` |
| Rare | `--rarity-rare` | `#3b82f6` |
| Epic | `--rarity-epic` | `#a855f7` |
| Legendary | `--rarity-legendary` | `#f59e0b` |
| Godly | `--rarity-godly` | `#ef4444` |

---

## 5. Accessibility Requirements

All SVGs must meet WCAG 2.1 AA accessibility standards.

### 5.1 Required Attributes

```xml
<svg xmlns="http://www.w3.org/2000/svg" 
     viewBox="0 0 100 150"
     role="img"
     aria-label="Aldric the Fighter - A muscular warrior in red armor wielding a longsword">
```

| Attribute | Required | Purpose |
|-----------|----------|---------|
| `role="img"` | ✅ Yes | Identifies SVG as an image to assistive tech |
| `aria-label` | ✅ Yes | Provides text description for screen readers |
| `focusable="false"` | ⚠️ Decorative only | Prevents tab focus on non-interactive SVGs |

### 5.2 aria-label Guidelines

The `aria-label` should include:

1. **Character name** (if named)
2. **Class/type** 
3. **Brief visual description** (pose, notable features)

Examples:
```xml
<!-- Hero -->
aria-label="Seraphina the Cleric - A robed healer with golden staff raised"

<!-- Enemy -->
aria-label="Skeleton Warrior - An undead soldier with rusty sword and shield"

<!-- Boss -->
aria-label="The Crimson Lich - Boss - A floating skeletal mage wreathed in red flames"
```

### 5.3 Title and Desc Elements (Optional Enhancement)

For complex illustrations, add internal title and description:

```xml
<svg role="img" aria-labelledby="title desc">
  <title id="title">Aldric the Fighter</title>
  <desc id="desc">
    A muscular human warrior wearing crimson plate armor. 
    He wields a gleaming longsword and carries a tower shield 
    emblazoned with a lion crest.
  </desc>
  <!-- artwork -->
</svg>
```

### 5.4 Color Contrast

- Ensure sufficient contrast (4.5:1 minimum) between character elements and background
- Avoid relying solely on color to convey information
- Status effects should have shape/pattern indicators in addition to color

---

## 6. File Organization Structure

All SVG assets are organized under `src/art/` with consistent naming conventions.

### 6.1 Directory Structure

```
src/art/
├── heroes/
│   ├── fighter/
│   │   ├── fighter-base.svg      # Default fighter appearance
│   │   ├── fighter-female.svg    # Female variant
│   │   └── fighter-alt.svg       # Alternative skin
│   ├── wizard/
│   │   ├── wizard-base.svg
│   │   └── wizard-female.svg
│   ├── rogue/
│   │   ├── rogue-base.svg
│   │   └── rogue-female.svg
│   ├── cleric/
│   │   ├── cleric-base.svg
│   │   └── cleric-female.svg
│   └── ranger/
│       ├── ranger-base.svg
│       └── ranger-female.svg
├── enemies/
│   ├── dungeon_start/            # Theme-specific enemies
│   │   ├── skeleton.svg
│   │   ├── goblin.svg
│   │   └── rat-swarm.svg
│   ├── crypt/
│   │   ├── zombie.svg
│   │   ├── ghost.svg
│   │   └── wight.svg
│   ├── sewer/
│   │   ├── slime.svg
│   │   ├── giant-rat.svg
│   │   └── cultist.svg
│   └── bosses/
│       ├── skeleton-king.svg
│       ├── lich-lord.svg
│       └── sewer-beast.svg
├── equipment/
│   ├── weapons/
│   │   ├── sword.svg
│   │   ├── staff.svg
│   │   └── bow.svg
│   ├── armor/
│   │   ├── plate-chest.svg
│   │   ├── leather-chest.svg
│   │   └── robes.svg
│   └── shields/
│       ├── tower-shield.svg
│       └── buckler.svg
└── effects/
    ├── damage-flash.svg
    ├── heal-glow.svg
    ├── buff-aura.svg
    └── death-fade.svg
```

### 6.2 File Naming Convention

| Pattern | Example | Description |
|---------|---------|-------------|
| `{class}-base.svg` | `fighter-base.svg` | Default hero appearance |
| `{class}-{variant}.svg` | `wizard-female.svg` | Character variant |
| `{enemy-name}.svg` | `skeleton.svg` | Standard enemy |
| `{boss-name}.svg` | `lich-lord.svg` | Boss enemy |
| `{equipment-name}.svg` | `tower-shield.svg` | Equipment piece |

### 6.3 Import Pattern

```typescript
// In Astro components
import FighterBase from '@/art/heroes/fighter/fighter-base.svg?raw';
import Skeleton from '@/art/enemies/dungeon_start/skeleton.svg?raw';

// Dynamic import based on role
const heroSvg = await import(`@/art/heroes/${role}/${role}-base.svg?raw`);
```

---

## 7. Complete Template Example

### 7.1 Hero Template (Fighter)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg 
  xmlns="http://www.w3.org/2000/svg" 
  viewBox="0 0 100 150"
  role="img"
  aria-label="Fighter - A sturdy warrior in red armor with sword and shield"
  style="
    --hero-primary: var(--class-fighter, #dc2626);
    --hero-secondary: var(--copper, #b87333);
    --hero-skin: #f5deb3;
    --hero-hair: #4a3728;
  "
>
  <title>Fighter</title>
  <desc>A muscular warrior class character wielding a sword and shield</desc>
  
  <!-- Shared Definitions -->
  <defs>
    <!-- Glow filter for effects -->
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    
    <!-- Drop shadow for character -->
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="3" stdDeviation="2" flood-opacity="0.3"/>
    </filter>
    
    <!-- Equipment gradient -->
    <linearGradient id="armor-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="var(--hero-primary)"/>
      <stop offset="100%" stop-color="var(--hero-secondary)"/>
    </linearGradient>
  </defs>
  
  <!-- Animation States Container -->
  <g id="states">
    
    <!-- ==================== IDLE STATE ==================== -->
    <g id="state-idle" class="anim-state active">
      
      <!-- Layer 1: Background/Shadow -->
      <g id="layer-bg" class="layer-bg">
        <ellipse cx="50" cy="145" rx="20" ry="5" fill="#000" opacity="0.2"/>
      </g>
      
      <!-- Layer 2: Body Base -->
      <g id="layer-body" class="layer-body" filter="url(#shadow)">
        <!-- Body silhouette -->
        <path 
          d="M50 25 
             C35 25, 25 40, 25 60 
             L25 100 
             C25 110, 30 115, 35 120 
             L35 140 
             L45 140 
             L45 120 
             L55 120 
             L55 140 
             L65 140 
             L65 120 
             C70 115, 75 110, 75 100 
             L75 60 
             C75 40, 65 25, 50 25 Z"
          fill="var(--hero-skin)"
        />
        
        <!-- Head -->
        <circle cx="50" cy="25" r="15" fill="var(--hero-skin)"/>
        
        <!-- Hair -->
        <path 
          d="M35 20 C35 10, 65 10, 65 20 L65 15 C65 5, 35 5, 35 15 Z" 
          fill="var(--hero-hair)"
        />
        
        <!-- Face details -->
        <circle cx="44" cy="23" r="2" fill="#1c1917"/> <!-- Left eye -->
        <circle cx="56" cy="23" r="2" fill="#1c1917"/> <!-- Right eye -->
        <path d="M47 30 Q50 33, 53 30" stroke="#1c1917" stroke-width="1" fill="none"/>
      </g>
      
      <!-- Layer 3: Equipment Overlay -->
      <g id="layer-equipment" class="layer-equipment">
        <!-- Chest Armor -->
        <path 
          d="M30 50 L70 50 L75 70 L75 95 L25 95 L25 70 Z"
          fill="url(#armor-gradient)"
          stroke="var(--hero-secondary)"
          stroke-width="1"
        />
        
        <!-- Pauldrons -->
        <ellipse cx="28" cy="50" rx="8" ry="6" fill="var(--hero-primary)"/>
        <ellipse cx="72" cy="50" rx="8" ry="6" fill="var(--hero-primary)"/>
        
        <!-- Belt -->
        <rect x="28" y="90" width="44" height="8" fill="var(--hero-secondary)"/>
        <rect x="46" y="88" width="8" height="12" fill="#fbbf24"/> <!-- Belt buckle -->
        
        <!-- Sword (right hand) -->
        <g id="weapon-sword" transform="translate(75, 70) rotate(15)">
          <rect x="-2" y="-30" width="4" height="35" fill="#c0c0c0"/> <!-- Blade -->
          <rect x="-4" y="3" width="8" height="3" fill="var(--hero-secondary)"/> <!-- Guard -->
          <rect x="-2" y="5" width="4" height="10" fill="#8b4513"/> <!-- Grip -->
          <circle cx="0" cy="17" r="3" fill="var(--hero-primary)"/> <!-- Pommel -->
        </g>
        
        <!-- Shield (left arm) -->
        <g id="weapon-shield" transform="translate(20, 70)">
          <path 
            d="M0 -15 L15 -10 L15 15 L0 25 L-15 15 L-15 -10 Z"
            fill="var(--hero-primary)"
            stroke="var(--hero-secondary)"
            stroke-width="2"
          />
          <circle cx="0" cy="5" r="5" fill="var(--hero-secondary)"/> <!-- Boss -->
        </g>
      </g>
      
      <!-- Layer 4: Effects (empty in idle) -->
      <g id="layer-effects" class="layer-effects">
        <!-- Subtle class color glow (optional) -->
        <circle 
          cx="50" cy="75" r="35" 
          fill="var(--hero-primary)" 
          opacity="0.05"
        />
      </g>
      
    </g>
    
    <!-- ==================== ATTACK STATE ==================== -->
    <g id="state-attack" class="anim-state">
      
      <g id="layer-bg" class="layer-bg">
        <ellipse cx="55" cy="145" rx="22" ry="5" fill="#000" opacity="0.25"/>
      </g>
      
      <g id="layer-body" class="layer-body" filter="url(#shadow)">
        <!-- Body leaning forward -->
        <path 
          d="M55 25 
             C40 25, 28 40, 28 60 
             L25 100 
             C25 110, 30 115, 35 120 
             L32 140 
             L42 140 
             L45 120 
             L55 120 
             L58 140 
             L68 140 
             L65 120 
             C72 115, 78 110, 78 100 
             L78 60 
             C78 40, 70 25, 55 25 Z"
          fill="var(--hero-skin)"
        />
        <circle cx="55" cy="25" r="15" fill="var(--hero-skin)"/>
        <path d="M40 20 C40 10, 70 10, 70 20 L70 15 C70 5, 40 5, 40 15 Z" fill="var(--hero-hair)"/>
        <!-- Determined expression -->
        <circle cx="49" cy="23" r="2" fill="#1c1917"/>
        <circle cx="61" cy="23" r="2" fill="#1c1917"/>
        <line x1="47" y1="28" x2="63" y2="28" stroke="#1c1917" stroke-width="2"/>
      </g>
      
      <g id="layer-equipment" class="layer-equipment">
        <!-- Armor (same structure, shifted) -->
        <path 
          d="M33 50 L73 50 L78 70 L78 95 L28 95 L28 70 Z"
          fill="url(#armor-gradient)"
          stroke="var(--hero-secondary)"
          stroke-width="1"
        />
        <ellipse cx="31" cy="50" rx="8" ry="6" fill="var(--hero-primary)"/>
        <ellipse cx="75" cy="50" rx="8" ry="6" fill="var(--hero-primary)"/>
        
        <!-- Sword extended forward -->
        <g id="weapon-sword" transform="translate(85, 55) rotate(-30)">
          <rect x="-2" y="-35" width="4" height="40" fill="#c0c0c0"/>
          <rect x="-4" y="3" width="8" height="3" fill="var(--hero-secondary)"/>
          <rect x="-2" y="5" width="4" height="10" fill="#8b4513"/>
          <circle cx="0" cy="17" r="3" fill="var(--hero-primary)"/>
        </g>
        
        <!-- Shield raised -->
        <g id="weapon-shield" transform="translate(15, 55) rotate(-15)">
          <path 
            d="M0 -15 L15 -10 L15 15 L0 25 L-15 15 L-15 -10 Z"
            fill="var(--hero-primary)"
            stroke="var(--hero-secondary)"
            stroke-width="2"
          />
          <circle cx="0" cy="5" r="5" fill="var(--hero-secondary)"/>
        </g>
      </g>
      
      <g id="layer-effects" class="layer-effects">
        <!-- Attack swing arc -->
        <path 
          d="M70 30 Q95 50, 90 80" 
          stroke="var(--hero-primary)" 
          stroke-width="3" 
          fill="none" 
          opacity="0.6"
          filter="url(#glow)"
        />
      </g>
      
    </g>
    
    <!-- ==================== HURT STATE ==================== -->
    <g id="state-hurt" class="anim-state">
      
      <g id="layer-bg" class="layer-bg">
        <ellipse cx="45" cy="145" rx="18" ry="5" fill="#000" opacity="0.15"/>
      </g>
      
      <g id="layer-body" class="layer-body" filter="url(#shadow)">
        <!-- Body recoiling -->
        <path 
          d="M45 28 
             C30 28, 22 43, 22 63 
             L20 103 
             C20 113, 25 118, 30 123 
             L28 143 
             L38 143 
             L42 123 
             L52 123 
             L55 143 
             L65 143 
             L62 123 
             C68 118, 72 113, 72 103 
             L72 63 
             C72 43, 60 28, 45 28 Z"
          fill="var(--hero-skin)"
        />
        <circle cx="45" cy="28" r="15" fill="var(--hero-skin)"/>
        <path d="M30 23 C30 13, 60 13, 60 23 L60 18 C60 8, 30 8, 30 18 Z" fill="var(--hero-hair)"/>
        <!-- Pained expression -->
        <line x1="37" y1="23" x2="42" y2="26" stroke="#1c1917" stroke-width="2"/>
        <line x1="48" y1="26" x2="53" y2="23" stroke="#1c1917" stroke-width="2"/>
        <ellipse cx="45" cy="33" rx="3" ry="4" fill="#1c1917"/>
      </g>
      
      <g id="layer-equipment" class="layer-equipment">
        <path 
          d="M25 53 L65 53 L70 73 L70 98 L20 98 L20 73 Z"
          fill="url(#armor-gradient)"
          stroke="var(--hero-secondary)"
          stroke-width="1"
        />
        <ellipse cx="23" cy="53" rx="8" ry="6" fill="var(--hero-primary)"/>
        <ellipse cx="67" cy="53" rx="8" ry="6" fill="var(--hero-primary)"/>
        
        <!-- Sword lowered -->
        <g id="weapon-sword" transform="translate(70, 90) rotate(45)">
          <rect x="-2" y="-30" width="4" height="35" fill="#c0c0c0"/>
          <rect x="-4" y="3" width="8" height="3" fill="var(--hero-secondary)"/>
          <rect x="-2" y="5" width="4" height="10" fill="#8b4513"/>
          <circle cx="0" cy="17" r="3" fill="var(--hero-primary)"/>
        </g>
        
        <!-- Shield dropped -->
        <g id="weapon-shield" transform="translate(15, 85) rotate(20)">
          <path 
            d="M0 -15 L15 -10 L15 15 L0 25 L-15 15 L-15 -10 Z"
            fill="var(--hero-primary)"
            stroke="var(--hero-secondary)"
            stroke-width="2"
          />
          <circle cx="0" cy="5" r="5" fill="var(--hero-secondary)"/>
        </g>
      </g>
      
      <g id="layer-effects" class="layer-effects">
        <!-- Damage flash overlay -->
        <rect 
          x="10" y="10" width="80" height="130" 
          fill="var(--damage, #ef4444)" 
          opacity="0.3"
          rx="5"
        />
        <!-- Impact stars -->
        <g fill="#fbbf24" opacity="0.8">
          <polygon points="70,40 72,45 77,45 73,48 75,53 70,50 65,53 67,48 63,45 68,45"/>
          <polygon points="60,55 61,58 64,58 62,60 63,63 60,61 57,63 58,60 56,58 59,58" transform="scale(0.8)"/>
        </g>
      </g>
      
    </g>
    
    <!-- ==================== DEATH STATE ==================== -->
    <g id="state-death" class="anim-state">
      
      <g id="layer-bg" class="layer-bg">
        <ellipse cx="50" cy="142" rx="35" ry="8" fill="#000" opacity="0.1"/>
      </g>
      
      <g id="layer-body" class="layer-body" opacity="0.7">
        <!-- Body fallen -->
        <path 
          d="M15 120 
             C15 110, 25 100, 35 100 
             L75 100 
             C85 100, 90 110, 90 120 
             L90 125 
             C90 130, 85 135, 75 135 
             L35 135 
             C25 135, 15 130, 15 125 Z"
          fill="var(--hero-skin)"
        />
        <!-- Head to side -->
        <circle cx="25" cy="105" r="12" fill="var(--hero-skin)"/>
        <path d="M15 100 C13 92, 33 90, 35 100" fill="var(--hero-hair)"/>
        <!-- Closed eyes -->
        <line x1="20" y1="103" x2="25" y2="103" stroke="#1c1917" stroke-width="2"/>
        <line x1="28" y1="103" x2="33" y2="103" stroke="#1c1917" stroke-width="2"/>
      </g>
      
      <g id="layer-equipment" class="layer-equipment" opacity="0.7">
        <!-- Armor on fallen body -->
        <path 
          d="M35 105 L75 105 L80 115 L80 125 L30 125 L30 115 Z"
          fill="url(#armor-gradient)"
          stroke="var(--hero-secondary)"
          stroke-width="1"
        />
        
        <!-- Sword fallen nearby -->
        <g id="weapon-sword" transform="translate(85, 130) rotate(80)">
          <rect x="-2" y="-30" width="4" height="35" fill="#c0c0c0" opacity="0.8"/>
          <rect x="-4" y="3" width="8" height="3" fill="var(--hero-secondary)"/>
          <rect x="-2" y="5" width="4" height="10" fill="#8b4513"/>
        </g>
        
        <!-- Shield fallen -->
        <g id="weapon-shield" transform="translate(10, 125) rotate(-70)">
          <path 
            d="M0 -12 L12 -8 L12 12 L0 20 L-12 12 L-12 -8 Z"
            fill="var(--hero-primary)"
            stroke="var(--hero-secondary)"
            stroke-width="1.5"
            opacity="0.8"
          />
        </g>
      </g>
      
      <g id="layer-effects" class="layer-effects">
        <!-- Fading spirit effect (optional) -->
        <circle 
          cx="50" cy="80" r="25" 
          fill="none" 
          stroke="var(--hero-primary)" 
          stroke-width="1"
          opacity="0.2"
          stroke-dasharray="5,3"
        />
      </g>
      
    </g>
    
  </g><!-- End #states -->
  
</svg>
```

### 7.2 Enemy Template (Skeleton)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg 
  xmlns="http://www.w3.org/2000/svg" 
  viewBox="0 0 100 100"
  role="img"
  aria-label="Skeleton - An undead warrior with rusty sword"
  style="
    --enemy-primary: #e7e5e4;
    --enemy-secondary: #78716c;
    --enemy-accent: #44403c;
  "
>
  <title>Skeleton</title>
  <desc>An undead skeletal warrior enemy</desc>
  
  <defs>
    <filter id="glow">
      <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  
  <g id="states">
    
    <!-- IDLE STATE -->
    <g id="state-idle" class="anim-state active">
      <g id="layer-bg">
        <ellipse cx="50" cy="95" rx="15" ry="4" fill="#000" opacity="0.15"/>
      </g>
      
      <g id="layer-body">
        <!-- Ribcage -->
        <path 
          d="M40 40 L60 40 L65 55 L60 70 L40 70 L35 55 Z" 
          fill="none" 
          stroke="var(--enemy-primary)" 
          stroke-width="2"
        />
        <!-- Ribs -->
        <line x1="40" y1="45" x2="60" y2="45" stroke="var(--enemy-primary)" stroke-width="2"/>
        <line x1="38" y1="52" x2="62" y2="52" stroke="var(--enemy-primary)" stroke-width="2"/>
        <line x1="38" y1="59" x2="62" y2="59" stroke="var(--enemy-primary)" stroke-width="2"/>
        
        <!-- Spine -->
        <line x1="50" y1="40" x2="50" y2="75" stroke="var(--enemy-primary)" stroke-width="3"/>
        
        <!-- Skull -->
        <circle cx="50" cy="25" r="15" fill="var(--enemy-primary)"/>
        <!-- Eye sockets -->
        <circle cx="44" cy="22" r="4" fill="var(--enemy-accent)"/>
        <circle cx="56" cy="22" r="4" fill="var(--enemy-accent)"/>
        <!-- Eye glow -->
        <circle cx="44" cy="22" r="2" fill="#ef4444" opacity="0.8"/>
        <circle cx="56" cy="22" r="2" fill="#ef4444" opacity="0.8"/>
        <!-- Jaw -->
        <path d="M40 32 L50 38 L60 32" fill="none" stroke="var(--enemy-primary)" stroke-width="2"/>
        
        <!-- Arms -->
        <line x1="35" y1="45" x2="20" y2="60" stroke="var(--enemy-primary)" stroke-width="3"/>
        <line x1="65" y1="45" x2="80" y2="60" stroke="var(--enemy-primary)" stroke-width="3"/>
        
        <!-- Legs -->
        <line x1="45" y1="70" x2="40" y2="93" stroke="var(--enemy-primary)" stroke-width="3"/>
        <line x1="55" y1="70" x2="60" y2="93" stroke="var(--enemy-primary)" stroke-width="3"/>
      </g>
      
      <g id="layer-equipment">
        <!-- Rusty Sword -->
        <g transform="translate(80, 55) rotate(20)">
          <rect x="-2" y="-20" width="4" height="25" fill="#8b6914"/>
          <rect x="-3" y="3" width="6" height="2" fill="#5c4a1a"/>
          <rect x="-1.5" y="4" width="3" height="8" fill="#3d2e10"/>
        </g>
      </g>
      
      <g id="layer-effects">
        <!-- Subtle death aura -->
        <circle cx="50" cy="50" r="30" fill="var(--enemy-accent)" opacity="0.05"/>
      </g>
    </g>
    
    <!-- Additional states would follow same pattern... -->
    <g id="state-attack" class="anim-state"><!-- ... --></g>
    <g id="state-hurt" class="anim-state"><!-- ... --></g>
    <g id="state-death" class="anim-state"><!-- ... --></g>
    
  </g>
</svg>
```

---

## 8. Implementation Checklist

When creating a new character SVG, verify:

- [ ] **ViewBox**: Correct dimensions for character type
- [ ] **Accessibility**: `role="img"` and `aria-label` present
- [ ] **Layer structure**: All four layers present and ordered correctly
- [ ] **Animation states**: At minimum `#state-idle`, `#state-attack`, `#state-hurt`, `#state-death`
- [ ] **CSS variables**: Using design tokens for colors, not hardcoded hex
- [ ] **File location**: Placed in correct directory under `src/art/`
- [ ] **File naming**: Follows `{type}-{variant}.svg` convention
- [ ] **Definitions**: Reusable elements in `<defs>` (gradients, filters)
- [ ] **Class assignment**: `.anim-state` class on all state groups

---

## 9. Related Documents

- [`tokens.css`](../src/styles/tokens.css) - Design token definitions
- [`types.ts`](../src/engine/types.ts) - Role type definitions
- `SVG-ANIMATION-SPEC.md` - Animation timing and GSAP integration (S3.1.2)
- `REFACTOR-TASK-MAP.md` - Phase 3 task breakdown

---

## Changelog

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-05 | Architect | Initial specification |
