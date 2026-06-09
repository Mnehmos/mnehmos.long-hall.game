# The Long Hall - Wish List for Astro Refactor

## Overview

This document outlines the ideal architecture for The Long Hall when migrated to Astro. These are not just bug fixes or minor improvements, but substantial enhancements that leverage Astro's component model, partial hydration, and modern tooling.

---

## Priority 1: Core Architecture

### 1.1 Component-Based Rendering

**Current**: Single 1000-line `render.ts` function generating HTML strings

**Desired**: Modular Astro components with clear responsibilities

```
src/
├── components/
│   ├── layout/
│   │   ├── Header.astro
│   │   ├── Sidebar.astro
│   │   └── MainContent.astro
│   │
│   ├── game/
│   │   ├── RoomDisplay.astro
│   │   ├── CombatPanel.astro
│   │   ├── ActionButtons.astro
│   │   └── CombatLog.astro
│   │
│   ├── party/
│   │   ├── PartyMember.astro
│   │   ├── HeroPanel.astro
│   │   ├── SkillsGrid.astro
│   │   └── PaperDoll.astro
│   │
│   ├── equipment/
│   │   ├── EquipmentSlot.astro
│   │   ├── ItemCard.astro
│   │   └── InventoryPanel.astro
│   │
│   ├── shop/
│   │   ├── ShopSection.astro
│   │   ├── RecruitSection.astro
│   │   └── TraderPanel.astro
│   │
│   ├── overlays/
│   │   ├── GameOver.astro
│   │   ├── Victory.astro
│   │   ├── ShrineBlessing.astro
│   │   └── Leaderboard.astro
│   │
│   └── shared/
│       ├── StatBar.astro
│       ├── Button.astro
│       ├── Tooltip.astro
│       └── Modal.astro
│
├── islands/           # Interactive React/Preact components
│   ├── GameEngine.tsx      # Main game loop
│   ├── CombatManager.tsx   # Combat interactions
│   └── InventoryManager.tsx
│
└── pages/
    ├── index.astro         # Landing/menu
    ├── play.astro          # Game page
    ├── leaderboard.astro   # Full leaderboard
    └── about.astro         # Game info
```

**Benefits**:
- Single responsibility principle
- Easier testing
- Better IDE support
- Reusable components

---

### 1.2 SVG Art System

**Current**: ASCII art in `art.ts`

**Desired**: SVG-based character art system

```typescript
// src/art/types.ts
interface CharacterArt {
  id: string;
  svg: string;           // Raw SVG content
  variants: {
    idle: string;
    attack?: string;
    hurt?: string;
    death?: string;
  };
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

// src/art/heroes/fighter.svg
<svg viewBox="0 0 64 64" class="hero-art hero-fighter">
  <g class="body">
    <rect class="torso" x="22" y="20" width="20" height="24" />
    <circle class="head" cx="32" cy="12" r="10" />
  </g>
  <g class="equipment">
    <path class="weapon main-hand" d="..." />
    <path class="shield off-hand" d="..." />
  </g>
  <g class="effects">
    <!-- Animated effects layer -->
  </g>
</svg>
```

**Art Requirements**:

| Character Type | Variants Needed | Colors |
|----------------|-----------------|--------|
| Fighter | idle, attack, hurt, victory | Red/Gold |
| Wizard | idle, cast, hurt, victory | Purple/Blue |
| Rogue | idle, attack, stealth, hurt | Green/Black |
| Cleric | idle, heal, hurt, victory | Gold/White |
| Ranger | idle, shoot, hurt, victory | Green/Brown |
| Goblin | idle, attack, hurt, death | Green |
| Skeleton | idle, attack, hurt, death | White/Gray |
| Troll | idle, attack, hurt, death | Gray/Green |
| Boss variants | idle, attack, enrage, death | Unique |

**Animation Approach**:
- CSS animations for idle states
- GSAP or Web Animations API for combat
- SVG `<animate>` for simple effects
- Class-based state changes

```css
/* Idle breathing animation */
.hero-art .body {
  animation: breathe 3s ease-in-out infinite;
}

@keyframes breathe {
  0%, 100% { transform: scaleY(1); }
  50% { transform: scaleY(1.02); }
}

/* Combat hit flash */
.hero-art.hit .body {
  animation: hit-flash 0.2s ease-out;
}

@keyframes hit-flash {
  0% { filter: brightness(2); }
  100% { filter: brightness(1); }
}
```

---

### 1.3 Island Architecture for Interactivity

**Current**: Full page re-renders on every state change

**Desired**: Astro Islands with Preact/React for interactive elements only

```astro
---
// pages/play.astro
import Layout from '../layouts/GameLayout.astro';
import Header from '../components/layout/Header.astro';
import GameEngine from '../islands/GameEngine';  // Interactive
import Sidebar from '../components/party/Sidebar.astro';  // Static shell
---

<Layout title="Play - The Long Hall">
  <Header />
  
  <!-- Static shell with interactive island -->
  <main class="game-container">
    <aside class="sidebar-shell">
      <GameEngine client:load section="party" />
    </aside>
    
    <section class="main-content">
      <GameEngine client:load section="room" />
      <GameEngine client:load section="actions" />
    </section>
    
    <aside class="combat-log">
      <GameEngine client:load section="log" />
    </aside>
  </main>
</Layout>
```

**Island Responsibilities**:

| Island | Hydration | Purpose |
|--------|-----------|---------|
| GameEngine | `client:load` | Core game loop, state |
| CombatPanel | `client:visible` | Combat interactions |
| Inventory | `client:visible` | Equipment management |
| Leaderboard | `client:idle` | Score display |
| Tooltip | `client:only` | Hover information |

---

## Priority 2: Content & Data

### 2.1 Content as Data Files

**Current**: TypeScript constants in code

**Desired**: JSON/YAML content files with schema validation

```yaml
# content/items/weapons.yaml
- id: iron_sword
  name: Iron Sword
  type: main_hand
  rarity: common
  cost: 20
  stats:
    attackBonus: 1
    damageBonus: 2
  flavor: "A trusty blade for any adventurer."

- id: flame_tongue
  name: Flame Tongue
  type: main_hand
  rarity: rare
  cost: 150
  stats:
    attackBonus: 2
    damageBonus: 4
  enchantment:
    name: Burning
    effect:
      damageBonus: 2
      damageType: fire
  flavor: "Burns with inner fire."
```

```typescript
// Content schema validation
import { z } from 'zod';

const ItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['main_hand', 'off_hand', 'head', 'chest', ...]),
  rarity: z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary', 'godly']),
  cost: z.number().positive(),
  stats: z.object({
    attackBonus: z.number().optional(),
    damageBonus: z.number().optional(),
    acBonus: z.number().optional(),
    maxHpBonus: z.number().optional(),
  }),
  enchantment: EnchantmentSchema.optional(),
  flavor: z.string().optional(),
});

// Load at build time
const items = await loadContentCollection('items/weapons.yaml', ItemSchema);
```

**Benefits**:
- Non-developers can edit content
- Easy localization
- Validation at build time
- Content collections in Astro

---

### 2.2 Localization Support

**Current**: English hardcoded

**Desired**: i18n-ready content structure

```
content/
├── en/
│   ├── items.yaml
│   ├── abilities.yaml
│   ├── enemies.yaml
│   └── ui.yaml
├── es/
│   └── ... (Spanish)
└── de/
    └── ... (German)
```

```astro
---
// Using Astro i18n integration
import { t } from '../i18n';
const { item } = Astro.props;
---

<div class="item-card">
  <h3>{t(`items.${item.id}.name`)}</h3>
  <p class="flavor">{t(`items.${item.id}.flavor`)}</p>
</div>
```

---

## Priority 3: Visual & UX

### 3.1 Design System with CSS Variables

**Current**: Flat CSS with some variables

**Desired**: Comprehensive design token system

```css
/* src/styles/tokens.css */
:root {
  /* Colors - Base Palette */
  --color-stone-50: #fafaf9;
  --color-stone-100: #f5f5f4;
  --color-stone-900: #1c1917;
  
  /* Colors - Semantic */
  --color-bg-primary: var(--color-stone-900);
  --color-bg-secondary: #1e1e1e;
  --color-bg-tertiary: #0a0a0a;
  
  /* Colors - Accent (Copper from Mnehmos) */
  --color-copper: #b87333;
  --color-copper-light: #d4956a;
  
  /* Colors - Game States */
  --color-health: #e74c3c;
  --color-mana: #3498db;
  --color-xp: #a78bfa;
  --color-gold: #fbbf24;
  
  /* Colors - Rarity */
  --color-rarity-common: #888888;
  --color-rarity-uncommon: #2ecc71;
  --color-rarity-rare: #3498db;
  --color-rarity-epic: #9b59b6;
  --color-rarity-legendary: #f39c12;
  --color-rarity-godly: #ff6b6b;
  
  /* Colors - Classes */
  --color-class-fighter: #dc3545;
  --color-class-wizard: #9b59b6;
  --color-class-rogue: #1abc9c;
  --color-class-cleric: #f1c40f;
  --color-class-ranger: #27ae60;
  
  /* Typography */
  --font-display: 'Space Grotesk', sans-serif;
  --font-body: 'Inter', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  
  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  
  /* Borders */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 9999px;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.3);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.4);
  
  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-normal: 200ms ease;
  --transition-slow: 300ms ease;
}

/* Class-specific theming */
[data-class="fighter"] {
  --color-class-primary: var(--color-class-fighter);
  --color-class-glow: rgba(220, 53, 69, 0.3);
}

[data-class="wizard"] {
  --color-class-primary: var(--color-class-wizard);
  --color-class-glow: rgba(155, 89, 182, 0.3);
}
```

---

### 3.2 Smooth Combat Animations

**Current**: No combat animations

**Desired**: Micro-animations for combat feedback

```typescript
// src/animations/combat.ts
import { gsap } from 'gsap';

export function animateAttack(attackerId: string, targetId: string) {
  const attacker = document.querySelector(`[data-character="${attackerId}"]`);
  const target = document.querySelector(`[data-character="${targetId}"]`);
  
  if (!attacker || !target) return;
  
  const timeline = gsap.timeline();
  
  // Attacker lunges forward
  timeline.to(attacker, {
    x: 20,
    duration: 0.15,
    ease: 'power2.out',
  });
  
  // Weapon swing
  timeline.to(`${attackerId} .weapon`, {
    rotation: 45,
    duration: 0.1,
    ease: 'power3.in',
  }, '-=0.05');
  
  // Target hit flash
  timeline.to(target, {
    filter: 'brightness(2)',
    duration: 0.05,
  });
  
  // Target recoil
  timeline.to(target, {
    x: -10,
    duration: 0.1,
    ease: 'power2.out',
  }, '<');
  
  // Reset
  timeline.to([attacker, target], {
    x: 0,
    filter: 'brightness(1)',
    duration: 0.2,
    ease: 'power2.inOut',
  });
  
  return timeline;
}

export function animateDamageNumber(
  targetId: string, 
  damage: number, 
  isCrit: boolean
) {
  const target = document.querySelector(`[data-character="${targetId}"]`);
  if (!target) return;
  
  const dmgEl = document.createElement('div');
  dmgEl.className = `damage-number ${isCrit ? 'crit' : ''}`;
  dmgEl.textContent = `-${damage}`;
  target.appendChild(dmgEl);
  
  gsap.fromTo(dmgEl, {
    y: 0,
    opacity: 1,
    scale: isCrit ? 1.5 : 1,
  }, {
    y: -50,
    opacity: 0,
    duration: 1,
    ease: 'power2.out',
    onComplete: () => dmgEl.remove(),
  });
}
```

---

### 3.3 Responsive Layout Improvements

**Current**: CSS Grid with media queries

**Desired**: Container queries for component-level responsiveness

```css
/* Component adapts to its container, not viewport */
.hero-panel {
  container-type: inline-size;
  container-name: hero;
}

@container hero (max-width: 300px) {
  .hero-panel .skills-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .hero-panel .paper-doll-grid {
    font-size: 0.6em;
  }
  
  .hero-panel .ascii-art {
    display: none;  /* Hide art in small containers */
  }
  
  .hero-panel .svg-art {
    max-height: 60px;  /* Smaller SVG in tight space */
  }
}

/* Main layout still uses viewport queries */
@media (max-width: 768px) {
  .game-layout {
    grid-template-columns: 1fr;
    grid-template-areas:
      "header"
      "room"
      "actions"
      "party"
      "log";
  }
}
```

---

## Priority 4: Performance & Quality

### 4.1 State Management with Signals

**Current**: Full re-render on state change

**Desired**: Granular reactivity with Preact Signals

```typescript
// src/state/gameState.ts
import { signal, computed, effect } from '@preact/signals';

// Core state atoms
export const gameState = signal<RunState>(createInitialState());
export const uiState = signal<UIState>({ selectedMember: 0 });

// Derived state (computed)
export const aliveMembers = computed(() => 
  gameState.value.party.members.filter(m => m.isAlive)
);

export const currentRoom = computed(() => 
  gameState.value.currentRoom
);

export const isInCombat = computed(() => {
  const room = currentRoom.value;
  return room?.enemies && room.enemies.some(e => e.hp > 0);
});

// Actions
export function dispatch(action: GameAction) {
  gameState.value = reducer(gameState.value, action);
}

// Side effects
effect(() => {
  // Auto-save when game state changes
  if (gameState.value.depth > 0) {
    localStorage.setItem('autosave', JSON.stringify(gameState.value));
  }
});

effect(() => {
  // Scroll combat log when history updates
  const log = document.getElementById('combat-log');
  if (log) {
    log.scrollTop = log.scrollHeight;
  }
});
```

---

### 4.2 Testing Infrastructure

See [TDD-PLAN.md](./TDD-PLAN.md) for comprehensive testing strategy.

**Summary**:
- Vitest for unit tests
- Playwright for E2E
- Component testing with Astro test utils
- Seeded RNG for deterministic tests

---

### 4.3 Accessibility Improvements

**Current**: Minimal accessibility

**Desired**: WCAG AA compliance

```astro
---
// Accessible combat log with live region
---

<section 
  class="combat-log"
  aria-label="Combat Log"
  aria-live="polite"
  aria-atomic="false"
>
  {entries.map(entry => (
    <div 
      class={`log-entry log-${entry.type}`}
      role="log"
      aria-label={entry.ariaLabel}
    >
      {entry.text}
    </div>
  ))}
</section>
```

```typescript
// Combat log entry with aria labels
function createLogEntry(text: string, type: LogType): LogEntry {
  return {
    text,
    type,
    ariaLabel: generateAriaLabel(text, type),
    timestamp: Date.now(),
  };
}

function generateAriaLabel(text: string, type: LogType): string {
  switch (type) {
    case 'hero-hit':
      return `Your attack: ${text}`;
    case 'enemy-hit':
      return `Enemy attack: ${text}`;
    case 'death':
      return `Critical event: ${text}`;
    default:
      return text;
  }
}
```

**Keyboard Navigation**:
```typescript
// Full keyboard support
const keyboardShortcuts = {
  '1-4': 'Select party member',
  'a': 'Attack selected target',
  'Tab': 'Cycle through targets',
  'Space': 'Confirm action',
  'Escape': 'Cancel/close overlay',
  'r': 'Take rest (when available)',
  'n': 'Advance to next room',
};
```

---

## Priority 5: Features

### 5.1 Save/Load System

**Current**: Leaderboard only (scores)

**Desired**: Full save/load with cloud sync

```typescript
interface SaveData {
  version: string;
  timestamp: number;
  seed: string;
  state: RunState;
  checksum: string;  // Integrity verification
}

// Local save
async function saveLocal(state: RunState): Promise<void> {
  const save: SaveData = {
    version: APP_VERSION,
    timestamp: Date.now(),
    seed: state.seed,
    state,
    checksum: await computeChecksum(state),
  };
  
  localStorage.setItem('save_slot_1', JSON.stringify(save));
}

// Cloud save (for authenticated users)
async function saveCloud(state: RunState): Promise<void> {
  const save = await createSaveData(state);
  
  await fetch('/api/saves', {
    method: 'POST',
    body: JSON.stringify(save),
    headers: { 'Content-Type': 'application/json' },
  });
}

// Load with version migration
async function loadSave(slot: string): Promise<RunState | null> {
  const raw = localStorage.getItem(`save_slot_${slot}`);
  if (!raw) return null;
  
  const save: SaveData = JSON.parse(raw);
  
  // Verify integrity
  const checksum = await computeChecksum(save.state);
  if (checksum !== save.checksum) {
    console.warn('Save file corrupted or modified');
    return null;
  }
  
  // Migrate if needed
  return migrateSave(save);
}
```

---

### 5.2 Achievement System

```typescript
interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;           // SVG icon
  condition: (state: RunState) => boolean;
  progress?: (state: RunState) => { current: number; max: number };
  secret?: boolean;       // Hidden until unlocked
}

const achievements: Achievement[] = [
  {
    id: 'first_blood',
    name: 'First Blood',
    description: 'Defeat your first enemy',
    icon: 'sword',
    condition: (s) => s.totalKills >= 1,
  },
  {
    id: 'deep_delver',
    name: 'Deep Delver',
    description: 'Reach depth 50',
    icon: 'stairs',
    condition: (s) => s.depth >= 50,
    progress: (s) => ({ current: s.depth, max: 50 }),
  },
  {
    id: 'godslayer',
    name: 'Godslayer',
    description: 'Defeat a boss with a godly weapon',
    icon: 'crown',
    condition: (s) => s.achievements.godslayer,
    secret: true,
  },
];
```

---

### 5.3 Sound System (Optional)

```typescript
// Web Audio API wrapper
class SoundManager {
  private context: AudioContext;
  private sounds: Map<string, AudioBuffer>;
  private musicGain: GainNode;
  private sfxGain: GainNode;
  
  async loadSounds() {
    const soundList = [
      'attack_hit',
      'attack_miss',
      'attack_crit',
      'level_up',
      'death',
      'victory',
      'shrine',
      'gold_pickup',
    ];
    
    for (const sound of soundList) {
      const response = await fetch(`/sounds/${sound}.mp3`);
      const buffer = await response.arrayBuffer();
      this.sounds.set(sound, await this.context.decodeAudioData(buffer));
    }
  }
  
  playSfx(name: string, options: { volume?: number; pitch?: number } = {}) {
    const buffer = this.sounds.get(name);
    if (!buffer) return;
    
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = options.pitch ?? 1;
    
    const gain = this.context.createGain();
    gain.gain.value = options.volume ?? 1;
    
    source.connect(gain);
    gain.connect(this.sfxGain);
    source.start();
  }
}
```

---

## Implementation Phases

### Phase 1: Foundation (2 weeks)
- [ ] Set up Astro project
- [ ] Create base layouts
- [ ] Port state management
- [ ] Basic component structure

### Phase 2: Components (2 weeks)
- [ ] Break render.ts into components
- [ ] Create shared component library
- [ ] Implement island architecture
- [ ] Port all UI functionality

### Phase 3: Art Migration (2 weeks)
- [ ] Design SVG character system
- [ ] Create all character art
- [ ] Implement animation system
- [ ] Polish visual feedback

### Phase 4: Content & Testing (1 week)
- [ ] Migrate content to YAML
- [ ] Add content validation
- [ ] Write unit tests
- [ ] Write E2E tests

### Phase 5: Features & Polish (1 week)
- [ ] Save/load system
- [ ] Achievements
- [ ] Accessibility audit
- [ ] Performance optimization

---

## Related Documents

- [ARCHITECTURE-ANALYSIS.md](./ARCHITECTURE-ANALYSIS.md) - Current state analysis
- [WISH-WAS-DIFFERENT.md](./WISH-WAS-DIFFERENT.md) - Retrospective
- [TDD-PLAN.md](./TDD-PLAN.md) - Testing strategy
