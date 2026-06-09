# The Long Hall - Retrospective: What I Wish Was Different

## Overview

This document is a candid retrospective on decisions made during The Long Hall's development. Not everything here is "wrong" - some decisions were appropriate for the context. But with hindsight and the goal of building a maintainable, scalable game, these are things I would do differently.

---

## Architecture Decisions

### 1. String Template Rendering

**What We Did**: Built the entire UI with template literals returning HTML strings.

```typescript
// Current approach
function renderGame(state: RunState): string {
  return `<div class="game">
    ${renderHeader(state)}
    ${renderSidebar(state)}
    ${renderMainContent(state)}
  </div>`;
}
```

**Why It Seemed Good**:
- No framework dependency
- Simple to understand
- Fast initial development

**Why It's Problematic**:
- Full DOM replacement on every update (no diffing)
- Lost focus, scroll position, input state on re-render
- XSS risk if user content not escaped
- 1000+ line render function
- No component reusability
- Hard to test individual pieces

**What I'd Do Instead**:
- Start with Astro + Preact islands from day one
- Use signal-based reactivity for game state
- Component-per-concern architecture

---

### 2. Single Monolithic render.ts

**What We Did**: One file handles all rendering logic.

**Why It Seemed Good**:
- Easy to find things (it's all in one place!)
- No import/export complexity
- Copy-paste development

**Why It's Problematic**:
- 1000 lines is unmaintainable
- Multiple concerns tangled together
- Can't test components in isolation
- Merge conflicts nightmare
- Cognitive overload

**What I'd Do Instead**:
```
src/ui/
├── components/
│   ├── Header.ts
│   ├── Sidebar.ts
│   ├── RoomDisplay.ts
│   ├── CombatPanel.ts
│   └── ...
├── overlays/
│   ├── GameOver.ts
│   ├── Victory.ts
│   └── ...
└── render.ts  # Just orchestration
```

---

### 3. ASCII Art for Characters

**What We Did**: Characters represented with multi-line ASCII strings.

```typescript
export function getHeroArt(role: string): string {
  return `
    ╔═══╗
    ║ ⚔ ║
    ╠═══╣
    ║   ║
    ╚═══╝`;
}
```

**Why It Seemed Good**:
- Retro aesthetic
- No art assets needed
- Works everywhere
- Fast to create

**Why It's Problematic**:
- Fixed size, doesn't scale
- Can't animate meaningfully
- Requires monospace font
- Limited expressiveness
- Accessibility nightmare (screen readers)
- Can't show equipment visually

**What I'd Do Instead**:
- SVG-based character art from the start
- Equipment changes character appearance
- CSS/GSAP animations for combat
- Fallback to simple icons, not ASCII

---

### 4. No Testing Infrastructure

**What We Did**: Zero tests. Manual testing only.

**Why It Seemed Good**:
- Ship faster
- "I'll add tests later"
- Small codebase initially

**Why It's Problematic**:
- Combat math bugs discovered in production
- Afraid to refactor
- No confidence in changes
- Regression every update
- Can't verify seeded RNG determinism

**What I'd Do Instead**:
- TDD for all combat logic
- Seeded snapshot tests for room generation
- E2E tests for critical paths
- Test setup on day one

---

### 5. Content in TypeScript Files

**What We Did**: Items, enemies, abilities all defined as TS constants.

```typescript
export const ITEMS: Item[] = [
  { id: 'iron_sword', name: 'Iron Sword', ... },
];
```

**Why It Seemed Good**:
- Type safety
- IDE autocomplete
- Compile-time validation

**Why It's Problematic**:
- Content changes require rebuild
- Designers can't edit without TypeScript
- Mixing data with code
- Hard to localize
- Bloats bundle size

**What I'd Do Instead**:
- JSON/YAML content files
- Zod schema validation at build time
- Type generation from schema
- Separate content from code

---

## Code Quality Issues

### 6. Inline Styles in Render Functions

**What We Did**: Mixed styling concerns into render logic.

```typescript
html += `<div style="color: ${hpColor}; ${member.isAlive ? '' : 'opacity: 0.5;'}">`;
```

**Why It Seemed Good**:
- Quick to implement
- Dynamic styling easy

**Why It's Problematic**:
- CSS and logic tangled
- Hard to maintain consistency
- Can't use CSS features (hover, media queries)
- No style reuse

**What I'd Do Instead**:
- CSS classes for all states
- CSS custom properties for dynamic values
- `data-*` attributes for state-based styling

---

### 7. Magic Numbers Everywhere

**What We Did**: Hardcoded values scattered through code.

```typescript
const XP_THRESHOLDS = [0, 50, 150, 300, 500, 800, 1200];  // Only defined in render.ts
const escapeDC = 12 + Math.floor(state.depth / 5);
```

**Why It Seemed Good**:
- Fast to implement
- "I'll refactor later"

**Why It's Problematic**:
- Same constants defined multiple places
- Hard to balance game
- Not discoverable
- Easy to introduce inconsistency

**What I'd Do Instead**:
```typescript
// config/balance.ts
export const BALANCE = {
  xp: {
    thresholds: [0, 50, 150, 300, 500, 800, 1200],
    perKill: (enemyLevel: number) => 10 + enemyLevel * 5,
  },
  combat: {
    baseDC: 10,
    escapeDCPerDepth: 0.2,
  },
  // ...
} as const;
```

---

### 8. No Error Boundaries

**What We Did**: Errors crash the whole game.

**Why It Seemed Good**:
- Errors should be loud
- "It won't error in production"

**Why It's Problematic**:
- One bug = lost progress
- Poor user experience
- Hard to debug reported issues
- No graceful degradation

**What I'd Do Instead**:
- Error boundaries around major sections
- Auto-save before risky operations
- Recovery options for users
- Error reporting to backend

---

## State Management Issues

### 9. Mutable State in Render

**What We Did**: Some state tracked in render module.

```typescript
// ui/render.ts
let cachedHighScores: ScoreEntry[] = [];

export function setCachedHighScores(scores: ScoreEntry[]) {
  cachedHighScores = scores;
}
```

**Why It Seemed Good**:
- Quick fix for caching
- Avoided prop drilling

**Why It's Problematic**:
- State split between modules
- Not part of main state tree
- Can get out of sync
- Hard to reason about

**What I'd Do Instead**:
- All state in one store
- Computed/derived state for caching
- Clear data flow

---

### 10. No State Persistence Strategy

**What We Did**: Only high scores saved. Game state lost on refresh.

**Why It Seemed Good**:
- "Roguelikes don't need saves"
- Simpler implementation

**Why It's Problematic**:
- Users lose progress on crash
- Can't resume later
- Mobile users switch apps and lose game
- No meaningful progression between runs

**What I'd Do Instead**:
- Auto-save to localStorage
- Cloud save for authenticated users
- Run history and stats
- Meta-progression system

---

## UX Decisions

### 11. No Onboarding

**What We Did**: Drop player into game with no explanation.

**Why It Seemed Good**:
- "Players will figure it out"
- Tutorial is boring
- Ship faster

**Why It's Problematic**:
- Confusing ability system
- Don't understand skill distribution
- Miss important mechanics
- New players bounce

**What I'd Do Instead**:
- Optional tutorial run
- Contextual tooltips
- Progressive disclosure
- Help overlay (?)

---

### 12. Poor Mobile Experience (Initially)

**What We Did**: Desktop-first, mobile as afterthought.

**Why It Seemed Good**:
- Easier to develop
- "I'll mobile-ify later"

**Why It's Problematic**:
- Buttons too small
- Layout breaks
- Touch targets inadequate
- Retrofitting mobile is hard

**What I'd Do Instead**:
- Mobile-first design
- Touch targets from start (44px minimum)
- Test on real devices early
- Container queries for component responsiveness

---

### 13. Combat Log Noise

**What We Did**: Every action logged verbosely.

**Why It Seemed Good**:
- Transparency
- Debug information
- RPG authenticity

**Why It's Problematic**:
- Information overload
- Important events lost in noise
- Hard to scan
- Scrolls too fast

**What I'd Do Instead**:
- Log levels (verbose/normal/minimal)
- Visual grouping by round
- Highlighting for important events
- Collapsible detail

---

## Technical Debt

### 14. No Type Safety for Actions

**What We Did**: Actions are stringly-typed.

```typescript
type GameAction = 
  | { type: 'ADVANCE_ROOM' }
  | { type: 'ATTACK'; payload: { attackerId: string; targetId: string } }
  | { type: 'USE_ABILITY'; payload: { ... } };
```

**Why It Seemed Good**:
- Standard Redux pattern
- Flexible

**Why It's Problematic**:
- Easy to typo action types
- Payload shape not enforced
- No autocomplete for action creation

**What I'd Do Instead**:
```typescript
// Type-safe action creators
const actions = {
  advanceRoom: () => ({ type: 'ADVANCE_ROOM' as const }),
  attack: (attackerId: string, targetId: string) => ({
    type: 'ATTACK' as const,
    payload: { attackerId, targetId },
  }),
};
```

---

### 15. No Dependency Injection

**What We Did**: Hard dependencies on global state and imports.

**Why It Seemed Good**:
- Simple
- Less boilerplate

**Why It's Problematic**:
- Hard to test
- Can't mock dependencies
- Tight coupling

**What I'd Do Instead**:
- Service pattern or context
- Inject RNG, API client, etc.
- Easier testing

---

## Process Issues

### 16. No Design Documents

**What We Did**: Code first, document never.

**Why It Seemed Good**:
- Ship fast
- Code is the documentation

**Why It's Problematic**:
- Lost context on decisions
- Onboarding new contributors hard
- Repeating mistakes
- No reference for intended behavior

**What I'd Do Instead**:
- ADRs for significant decisions
- Game design document
- API contracts
- Architecture diagrams

---

### 17. No Version Control Discipline

**What We Did**: Large, mixed commits. No branches.

**Why It Seemed Good**:
- Fast iteration
- Solo developer
- "I know what changed"

**Why It's Problematic**:
- Hard to revert specific changes
- No code review
- Git history useless for debugging
- Can't cherry-pick fixes

**What I'd Do Instead**:
- Feature branches
- Atomic commits
- Meaningful commit messages
- PR even for solo work (self-review)

---

## Summary: Key Takeaways

| Category | Lesson |
|----------|--------|
| **Architecture** | Component boundaries from day one |
| **Testing** | TDD for game logic, not optional |
| **Content** | Separate data from code |
| **State** | Single source of truth |
| **UX** | Mobile-first, onboarding matters |
| **Process** | Document decisions, clean git history |

---

## What We Got Right

Not everything was a mistake:

1. ✅ **Seeded RNG** - Excellent for debugging and sharing runs
2. ✅ **Reducer pattern** - Predictable state management
3. ✅ **D&D mechanics** - Familiar, well-balanced system
4. ✅ **Equipment mastery** - Player investment in items
5. ✅ **TypeScript** - Type safety prevented many bugs
6. ✅ **Vite** - Fast development experience
7. ✅ **Clerk auth** - Easy authentication
8. ✅ **CSS custom properties** - Theming capability

---

## Related Documents

- [ARCHITECTURE-ANALYSIS.md](./ARCHITECTURE-ANALYSIS.md) - Current state analysis
- [WISH-LIST-ASTRO.md](./WISH-LIST-ASTRO.md) - Desired improvements
- [TDD-PLAN.md](./TDD-PLAN.md) - Testing strategy
