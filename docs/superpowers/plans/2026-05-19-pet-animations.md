# Pet Hover Animations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 5 new hover animations (tumble, squish, jump, shake, dance) to the FunBuddy desktop pet.

**Architecture:** Pure Motion variant additions — no new files, no new components. Extend the existing type union and variant map in two files.

**Tech Stack:** TypeScript, Motion (Framer Motion) v12

---

### Task 1: Update HoverAnimation type

**Files:**
- Modify: `src/renderer/src/types/pet.ts`

- [ ] **Step 1: Add 5 new animation names to the HoverAnimation type**

In `src/renderer/src/types/pet.ts`, change line 3 from:

```typescript
export type HoverAnimation = 'spin' | 'stretch' | 'think' | 'bounce' | 'heart' | 'firework' | 'cute'
```

to:

```typescript
export type HoverAnimation = 'spin' | 'stretch' | 'think' | 'bounce' | 'heart' | 'firework' | 'cute' | 'tumble' | 'squish' | 'jump' | 'shake' | 'dance'
```

- [ ] **Step 2: Run typecheck to verify**

Run: `cd <worktree> && npm run typecheck`
Expected: PASS (no errors — the new type values are not yet referenced, but the type itself is valid)

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/types/pet.ts
git commit -m "feat: add tumble, squish, jump, shake, dance to HoverAnimation type"
```

---

### Task 2: Add 5 new motion variants and register them

**Files:**
- Modify: `src/renderer/src/components/pet/hoverAnimations.ts`

- [ ] **Step 1: Add new animation names to HOVER_ANIMATIONS array**

In `src/renderer/src/components/pet/hoverAnimations.ts`, change line 4 from:

```typescript
export const HOVER_ANIMATIONS: HoverAnimation[] = ['spin', 'stretch', 'think', 'bounce', 'heart', 'firework', 'cute']
```

to:

```typescript
export const HOVER_ANIMATIONS: HoverAnimation[] = ['spin', 'stretch', 'think', 'bounce', 'heart', 'firework', 'cute', 'tumble', 'squish', 'jump', 'shake', 'dance']
```

- [ ] **Step 2: Add tumble variant**

Add after the `cute` variant (line 70) in `bodyVariants`:

```typescript
  tumble: {
    rotate: [0, 360],
    scaleY: [1, 0.85, 1],
    transition: { duration: 0.9, ease: 'easeInOut' },
  },
```

- [ ] **Step 3: Add squish variant**

```typescript
  squish: {
    scaleY: [1, 0.6, 1.15, 0.95, 1],
    scaleX: [1, 1.2, 0.9, 1.05, 1],
    y: [0, 10, -5, 2, 0],
    transition: { duration: 1.0, ease: 'easeInOut' },
  },
```

- [ ] **Step 4: Add jump variant**

```typescript
  jump: {
    y: [0, -30, 0],
    rotate: [0, -5, 5, 0],
    scaleY: [1, 0.9, 1.05, 1],
    transition: { duration: 0.7, ease: 'easeOut' },
  },
```

- [ ] **Step 5: Add shake variant**

```typescript
  shake: {
    x: [0, -8, 8, -6, 6, -3, 3, 0],
    rotate: [0, -3, 3, -2, 2, -1, 1, 0],
    transition: { duration: 0.6, ease: 'easeInOut' },
  },
```

- [ ] **Step 6: Add dance variant**

```typescript
  dance: {
    rotate: [0, 10, -10, 8, -8, 0],
    y: [0, -8, 0, -8, 0],
    scaleX: [1, 0.95, 1.05, 0.95, 1],
    transition: { duration: 1.4, ease: 'easeInOut' },
  },
```

- [ ] **Step 7: Run typecheck to verify**

Run: `cd <worktree> && npm run typecheck`
Expected: PASS — all variant keys match the HoverAnimation type union, no unused or missing entries.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/src/components/pet/hoverAnimations.ts
git commit -m "feat: add tumble, squish, jump, shake, dance hover animations"
```

---

### Task 3: Visual verification

**Files:** None (manual testing)

- [ ] **Step 1: Start the dev server**

Run: `cd <worktree> && npm run dev`

- [ ] **Step 2: Verify in the running app**

Hover over the pet repeatedly. Confirm all 12 animations appear (7 old + 5 new). Check that:
- Each animation plays smoothly without visual glitches
- No animation repeats twice in a row
- The pet returns to idle wiggle after each animation
