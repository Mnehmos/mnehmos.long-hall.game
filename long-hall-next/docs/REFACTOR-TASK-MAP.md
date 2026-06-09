# The Long Hall → Astro + SVG Refactor
## Master Task Map

**Created**: 2026-01-05  
**Status**: ✅ COMPLETE  
**Completed**: 2026-01-07  
**Run ID**: `refactor-astro-svg-001`

---

## Overview

This document defines the complete task decomposition for migrating The Long Hall from vanilla TypeScript/Vite to Astro with SVG animations. It follows a hierarchical orchestration pattern where each phase has its own orchestrator.

### Architecture

```
┌─────────────────────────────────────┐
│     Master Refactor Orchestrator    │
│         (this document)             │
└─────────────────┬───────────────────┘
                  │
    ┌─────────────┼─────────────┬─────────────┬─────────────┐
    ▼             ▼             ▼             ▼             ▼
┌───────┐   ┌───────┐   ┌───────┐   ┌───────┐   ┌───────┐
│Phase 1│   │Phase 2│   │Phase 3│   │Phase 4│   │Phase 5│
│ Found │   │ Comp  │   │  SVG  │   │Engine │   │Content│
└───────┘   └───────┘   └───────┘   └───────┘   └───────┘
```

---

## Current State Assessment

### Completed (✅)

| Component | Location | Notes |
|-----------|----------|-------|
| Project scaffold | `long-hall-next/` | Astro, Preact, Tailwind v4, GSAP, Vitest |
| Core lib: dice.ts | `src/lib/dice.ts` | D&D notation, advantage/disadvantage |
| Core lib: rng.ts | `src/lib/rng.ts` | Seeded LCG algorithm |
| Core lib: hash.ts | `src/lib/hash.ts` | Deterministic hashing |
| Unit tests | `tests/unit/lib/` | dice, rng, hash tests passing |
| Design tokens | `src/styles/tokens.css` | CSS variables for design system |
| Base layout | `src/layouts/Layout.astro` | Shell layout component |
| Preview page | `src/pages/index.astro` | Design system preview |
| Engine types | `src/engine/types.ts` | All engine work types |
| Astro components | `src/components/` | UI rendering complete |
| SVG art system | `src/art/` | Visual upgrade complete |
| State management | `src/state/` | Preact Signals complete |
| Content collections | `src/content/` | Build-time validation |
| E2E tests | `tests/e2e/` | Quality assurance complete |

---

## Phase Definitions

### Phase 1: Foundation Completion

**Orchestrator**: `phase-1-foundation`  
**Duration**: 1-2 days  
**Dependencies**: None  
**Workspace**: `long-hall-next/`

| Task ID | Description | Mode | File Patterns | Status |
|---------|-------------|------|---------------|--------|
| F1.1 | Port TypeScript types from `src/engine/types.ts` | code | `src/engine/types.ts` | ✅ complete |
| F1.2 | Set up Astro content collections schema | architect | `src/content/config.ts` | ✅ complete |
| F1.3 | Configure Preact integration for islands | code | `astro.config.mjs` | ✅ complete |
| F1.4 | Create GameLayout.astro and MenuLayout.astro | code | `src/layouts/*.astro` | ✅ complete |
| F1.5 | Set up path aliases (@/, @engine/, @lib/) | code | `tsconfig.json` | ✅ complete |

**Acceptance Criteria**:
- [x] All engine types compile without errors
- [x] Content collections schema validates test data
- [x] Preact island renders with `client:load`
- [x] Path aliases resolve in IDE and build

---

### Phase 2: Component Architecture

**Orchestrator**: `phase-2-components`  
**Duration**: 3-5 days  
**Dependencies**: Phase 1 complete  
**Workspace**: `long-hall-next/src/components/`

#### 2.1 Shared Components (Parallelizable ✅)

| Task ID | Component | Props | Status |
|---------|-----------|-------|--------|
| C2.1.1 | Button.astro | variant, size, disabled, onclick | ✅ complete |
| C2.1.2 | StatBar.astro | current, max, type (hp/xp/mana), label | ✅ complete |
| C2.1.3 | Tooltip.astro | content, position | ✅ complete |
| C2.1.4 | Modal.astro | open, title, onClose | ✅ complete |
| C2.1.5 | Badge.astro | text, variant (rarity/class) | ✅ complete |

#### 2.2 Layout Components (Parallelizable ✅)

| Task ID | Component | Props | Status |
|---------|-----------|-------|--------|
| C2.2.1 | Header.astro | depth, gold, seed | ✅ complete |
| C2.2.2 | Sidebar.astro | party members slot | ✅ complete |
| C2.2.3 | MainContent.astro | room slot, actions slot | ✅ complete |
| C2.2.4 | CombatLog.astro | entries[] | ✅ complete |

#### 2.3 Party Components (Parallelizable ✅)

| Task ID | Component | Props | Status |
|---------|-----------|-------|--------|
| C2.3.1 | HeroPanel.astro | hero, selected, onClick | ✅ complete |
| C2.3.2 | SkillsGrid.astro | skills object | ✅ complete |
| C2.3.3 | PaperDoll.astro | equipment object | ✅ complete |
| C2.3.4 | AbilityBar.astro | abilities[], onUse | ✅ complete |

#### 2.4 Equipment Components (Parallelizable ✅)

| Task ID | Component | Props | Status |
|---------|-----------|-------|--------|
| C2.4.1 | EquipmentSlot.astro | slot, item, onEquip | ✅ complete |
| C2.4.2 | ItemCard.astro | item, showStats | ✅ complete |
| C2.4.3 | InventoryPanel.astro | items[], onSelect | ✅ complete |

#### 2.5 Game Components (After C2.1)

| Task ID | Component | Props | Status |
|---------|-----------|-------|--------|
| C2.5.1 | RoomDisplay.astro | room, theme | ✅ complete |
| C2.5.2 | CombatPanel.astro | enemies[], onTarget | ✅ complete |
| C2.5.3 | ActionButtons.astro | actions[], onAction | ✅ complete |
| C2.5.4 | EnemyCard.astro | enemy, targeted | ✅ complete |

#### 2.6 Overlay Components (After C2.1)

| Task ID | Component | Props | Status |
|---------|-----------|-------|--------|
| C2.6.1 | GameOver.astro | runStats, onRestart | ✅ complete |
| C2.6.2 | Victory.astro | loot[], onContinue | ✅ complete |
| C2.6.3 | ShrineBlessing.astro | options[], onSelect | ✅ complete |
| C2.6.4 | Leaderboard.astro | entries[], category | ✅ complete |

**Acceptance Criteria**:
- [x] All components render in isolation (Storybook-style preview)
- [x] TypeScript props are fully typed
- [x] Components pass accessibility linting
- [x] Dark mode support via CSS variables

---

### Phase 3: SVG Art System + Animations

**Orchestrator**: `phase-3-svg-art`  
**Duration**: 3-5 days  
**Dependencies**: Phase 1 complete  
**Workspace**: `long-hall-next/src/art/`

#### 3.1 Architecture Design

| Task ID | Description | Mode | Output |
|---------|-------------|------|--------|
| S3.1.1 | Design SVG character template spec | architect | `docs/SVG-SPEC.md` |
| S3.1.2 | Define animation state machine | architect | `docs/ANIMATION-STATES.md` |

#### 3.2 Hero SVG Assets

| Task ID | Character | Variants | Colors | Status |
|---------|-----------|----------|--------|--------|
| S3.2.1 | Fighter | idle, attack, hurt, victory | Red/Gold | ✅ complete |
| S3.2.2 | Wizard | idle, cast, hurt, victory | Purple/Blue | ✅ complete |
| S3.2.3 | Rogue | idle, attack, stealth, hurt | Green/Black | ✅ complete |
| S3.2.4 | Cleric | idle, heal, hurt, victory | Gold/White | ✅ complete |
| S3.2.5 | Ranger | idle, shoot, hurt, victory | Green/Brown | ✅ complete |

#### 3.3 Enemy SVG Assets

| Task ID | Enemy | Variants | Status |
|---------|-------|----------|--------|
| S3.3.1 | Goblin | idle, attack, hurt, death | ✅ complete |
| S3.3.2 | Skeleton | idle, attack, hurt, death | ✅ complete |
| S3.3.3 | Orc | idle, attack, hurt, death | ✅ complete |
| S3.3.4 | Troll | idle, attack, hurt, death | ✅ complete |
| S3.3.5 | Dark Knight (boss) | idle, attack, enrage, death | ✅ complete |
| S3.3.6 | Dragon (boss) | idle, attack, breath, death | ✅ complete |

#### 3.4 Animation System

| Task ID | Description | Mode | File |
|---------|-------------|------|------|
| S3.4.1 | CSS idle animations (breathing, floating) | code | `src/styles/animations.css` |
| S3.4.2 | GSAP combat timeline factory | code | `src/lib/animations/combat.ts` |
| S3.4.3 | Damage number animation | code | `src/lib/animations/damage.ts` |
| S3.4.4 | Death animation sequence | code | `src/lib/animations/death.ts` |

#### 3.5 Character Sprite Component

| Task ID | Description | Mode | File |
|---------|-------------|------|------|
| S3.5.1 | CharacterSprite.astro wrapper | code | `src/components/art/CharacterSprite.astro` |
| S3.5.2 | CharacterSprite.tsx island (for animations) | code | `src/islands/CharacterSprite.tsx` |
| S3.5.3 | Animation controller hook | code | `src/hooks/useCharacterAnimation.ts` |

**Acceptance Criteria**:
- [x] All characters have at minimum idle + attack + hurt SVGs
- [x] CSS idle animations loop smoothly at 60fps
- [x] GSAP attack animation completes in <300ms
- [x] Damage numbers float up and fade out
- [x] SVGs are accessible (role="img", aria-label)

---

### Phase 4: Engine Migration (TDD)

**Orchestrator**: `phase-4-engine`  
**Duration**: 5-7 days  
**Dependencies**: Phase 1 complete  
**Workspace**: `long-hall-next/src/engine/`  
**Approach**: Red → Green → Blue TDD cycles

#### 4.1 Combat System

| Task ID | Description | Mode | Test File | Status |
|---------|-------------|------|-----------|--------|
| E4.1.1 | Write combat resolution tests | red-phase | `tests/unit/engine/combat.test.ts` | ✅ complete |
| E4.1.2 | Implement combat.ts | green-phase | `src/engine/combat.ts` | ✅ complete |
| E4.1.3 | Refactor combat module | blue-phase | `src/engine/combat.ts` | ✅ complete |

#### 4.2 Room Generation

| Task ID | Description | Mode | Test File | Status |
|---------|-------------|------|-----------|--------|
| E4.2.1 | Write room generation tests | red-phase | `tests/unit/engine/generateRoom.test.ts` | ✅ complete |
| E4.2.2 | Implement generateRoom.ts | green-phase | `src/engine/generateRoom.ts` | ✅ complete |
| E4.2.3 | Refactor room generation | blue-phase | `src/engine/generateRoom.ts` | ✅ complete |

#### 4.3 State Management

| Task ID | Description | Mode | File | Status |
|---------|-------------|------|------|--------|
| E4.3.1 | Set up Preact Signals store | code | `src/state/gameState.ts` | ✅ complete |
| E4.3.2 | Port reducer logic | code | `src/engine/reducer.ts` | ✅ complete |
| E4.3.3 | Create derived signals | code | `src/state/derived.ts` | ✅ complete |
| E4.3.4 | Implement effects (autosave, log scroll) | code | `src/state/effects.ts` | ✅ complete |

#### 4.4 Supporting Systems

| Task ID | Description | Mode | File | Status |
|---------|-------------|------|------|--------|
| E4.4.1 | Port loot system | code | `src/engine/loot.ts` | ✅ complete |
| E4.4.2 | Port rest mechanics | code | `src/engine/rest.ts` | ✅ complete |
| E4.4.3 | Port score calculation | code | `src/engine/score.ts` | ✅ complete |
| E4.4.4 | Port abilities system | code | `src/engine/abilities.ts` | ✅ complete |

**Acceptance Criteria**:
- [x] All TDD cycles complete (red → green → blue)
- [x] Unit test coverage >80% for engine modules
- [x] Seeded RNG produces identical results to original
- [x] State updates trigger minimal re-renders via Signals

---

### Phase 5: Interactive Islands

**Orchestrator**: `phase-5-islands`  
**Duration**: 3-4 days  
**Dependencies**: Phase 3 + Phase 4 complete  
**Workspace**: `long-hall-next/src/islands/`

| Task ID | Island | Hydration | Responsibility | Status |
|---------|--------|-----------|----------------|--------|
| I5.1 | GameEngine.tsx | `client:load` | Main game loop, state container | ✅ complete |
| I5.2 | CombatManager.tsx | `client:visible` | Combat UI, attack buttons, target selection | ✅ complete |
| I5.3 | InventoryManager.tsx | `client:visible` | Equipment management, drag/drop | ✅ complete |
| I5.4 | Leaderboard.tsx | `client:idle` | Fetch and display scores | ✅ complete |
| I5.5 | TooltipProvider.tsx | `client:only` | Hover tooltips | ✅ complete |

**Acceptance Criteria**:
- [x] Game playable end-to-end
- [x] State persists across page reloads
- [x] Islands hydrate at correct time
- [x] No hydration mismatches in console

---

### Phase 6: Content Migration

**Orchestrator**: `phase-6-content`  
**Duration**: 2-3 days  
**Dependencies**: Phase 1.2 complete  
**Workspace**: `long-hall-next/src/content/`

#### 6.1 Content Files

| Task ID | Source | Target | Format | Status |
|---------|--------|--------|--------|--------|
| CT6.1.1 | `src/content/tables.ts` (items) | `content/items/*.yaml` | YAML | ✅ complete |
| CT6.1.2 | `src/content/tables.ts` (enemies) | `content/enemies/*.yaml` | YAML | ✅ complete |
| CT6.1.3 | `src/content/abilities.ts` | `content/abilities/*.yaml` | YAML | ✅ complete |
| CT6.1.4 | `src/content/classes.ts` | `content/classes/*.yaml` | YAML | ✅ complete |
| CT6.1.5 | `src/content/themes.ts` | `content/themes/*.yaml` | YAML | ✅ complete |

#### 6.2 Validation & Loading

| Task ID | Description | Mode | File | Status |
|---------|-------------|------|------|--------|
| CT6.2.1 | Zod schemas for all content types | code | `src/content/schemas.ts` | ✅ complete |
| CT6.2.2 | Astro content collection config | code | `src/content/config.ts` | ✅ complete |
| CT6.2.3 | Content loader utilities | code | `src/lib/content.ts` | ✅ complete |

**Acceptance Criteria**:
- [x] All content loads at build time
- [x] Invalid content fails build with clear error
- [x] Content types are fully typed
- [x] No runtime content fetching

---

### Phase 7: Testing & Polish

**Orchestrator**: `phase-7-polish`  
**Duration**: 2-3 days  
**Dependencies**: All prior phases  
**Workspace**: `long-hall-next/`

| Task ID | Description | Mode | Priority | Status |
|---------|-------------|------|----------|--------|
| T7.1 | Expand unit test coverage to 80%+ | code | High | ✅ complete |
| T7.2 | Write E2E tests with Playwright | code | High | ✅ complete |
| T7.3 | Accessibility audit (ARIA, keyboard) | code | Medium | ✅ complete |
| T7.4 | Performance optimization | code | Medium | ✅ complete |
| T7.5 | Mobile responsiveness polish | code | Medium | ✅ complete |
| T7.6 | Build size optimization | code | Low | ✅ complete |
| T7.7 | SEO meta tags | code | Low | ✅ complete |

**Acceptance Criteria**:
- [x] Lighthouse score >90 for all categories
- [x] E2E tests cover complete game run
- [x] All interactive elements keyboard accessible
- [x] Bundle size <500KB gzipped

---

## Execution Timeline

```
Week 1: Phase 1 (Foundation) → Phase 2.1-2.2 (Shared/Layout Components)
        ↓
Week 2: Phase 2.3-2.6 (Remaining Components) → Phase 3.1-3.2 (SVG Design + Heroes)
        ↓
Week 3: Phase 3.3-3.5 (SVG Enemies + Animations) → Phase 4.1-4.2 (Combat TDD)
        ↓
Week 4: Phase 4.3-4.4 (State + Systems) → Phase 5 (Islands)
        ↓
Week 5: Phase 6 (Content) → Phase 7 (Polish)
```

---

## Parallel Safety Rules

Tasks marked **Parallelizable ✅** can run concurrently if:

1. **Different file patterns**: Workers target non-overlapping globs
2. **Same phase**: Stay within assigned phase workspace
3. **No shared state**: Each task is self-contained

**Serial dependencies** must complete before dependent tasks start.

---

## Boomerang Protocol

All phase orchestrators must return structured payloads:

```json
{
  "type": "phase-completed",
  "phase_id": "phase-1-foundation",
  "run_id": "refactor-astro-svg-001",
  "status": "success|failed|blocked",
  "tasks_completed": ["F1.1", "F1.2", "F1.3", "F1.4", "F1.5"],
  "tasks_failed": [],
  "files_changed": ["src/engine/types.ts", "..."],
  "next_phase": "phase-2-components",
  "notes": "Foundation complete. Ready for component work."
}
```

---

## 🎉 Refactor Complete

**Run ID**: `refactor-astro-svg-001`  
**Duration**: 2026-01-05 to 2026-01-07  
**Status**: All 7 phases completed successfully

### Final Metrics

| Phase | Tasks | Status |
|-------|-------|--------|
| Phase 1: Foundation | 5 | ✅ Complete |
| Phase 2: Components | 24 | ✅ Complete |
| Phase 3: SVG Art | 19 | ✅ Complete |
| Phase 4: Engine (TDD) | 15 | ✅ Complete |
| Phase 5: Islands | 5 | ✅ Complete |
| Phase 6: Content | 8 | ✅ Complete |
| Phase 7: Polish | 7 | ✅ Complete |
| **Total** | **83** | ✅ **Complete** |

### Deliverables

- 24 Astro components
- 5 Preact islands with proper hydration
- 11 SVG character sprites with animations
- 163 YAML content files
- 1000+ unit tests
- 31 E2E tests
- Full accessibility audit
- Performance optimization (<500KB bundle)
- Mobile responsive (375px+)
- PWA ready

---

## Related Documents

- [WISH-LIST-ASTRO.md](../../docs/WISH-LIST-ASTRO.md) - Original requirements
- [ARCHITECTURE-ANALYSIS.md](../../docs/ARCHITECTURE-ANALYSIS.md) - Current state analysis
- [TDD-PLAN.md](../../docs/TDD-PLAN.md) - Testing strategy
- [PROJECT_KNOWLEDGE.md](../../PROJECT_KNOWLEDGE.md) - Full project context

---

*Master Orchestrator Run ID: `refactor-astro-svg-001`*  
*Generated: 2026-01-05*  
*Completed: 2026-01-07*
