# DESIGN.md — OSC Tracker
> Inspired by Linear.app · Adapted for the OSC Update Status Tracking System

## Design Philosophy
Clean, information-dense, and precise. Every pixel earns its place. No decorative fluff — structure communicates hierarchy. Speed and clarity over personality.

## Color System

### Light Mode
| Token | Value | Usage |
|-------|-------|-------|
| Background | `#f5f5f7` | Page background |
| Surface | `#ffffff` | Cards, panels |
| Surface Raised | `#fafafa` | Table headers, sidebar items |
| Border | `#e4e4e7` | Card borders, dividers |
| Border Subtle | `#f0f0f2` | Table row separators |
| Text Primary | `#09090b` | Headings, body text |
| Text Secondary | `#52525b` | Labels, captions |
| Text Tertiary | `#a1a1aa` | Placeholders, hints |
| Accent | `#2563eb` | Primary actions, active nav, focus rings |
| Accent Hover | `#1d4ed8` | Button hover state |
| Accent Subtle | `#eff6ff` | Selected row bg, info chips |

### Dark Mode
| Token | Value | Usage |
|-------|-------|-------|
| Background | `#0d0d0f` | Page background |
| Surface | `#111113` | Cards, panels |
| Surface Raised | `#18181b` | Table headers |
| Border | `#27272a` | Dividers |
| Border Subtle | `#1f1f23` | Row separators |
| Text Primary | `#fafafa` | All body text |
| Text Secondary | `#a1a1aa` | Labels |
| Text Tertiary | `#52525b` | Hints |
| Accent | `#3b82f6` | Primary actions |

### Status Colors
| Status | Light | Dark |
|--------|-------|------|
| Success / OSC Updated | `#059669` on `#ecfdf5` | `#34d399` on `#022c22` |
| Info / Email Sent | `#2563eb` on `#eff6ff` | `#60a5fa` on `#1e3a5f` |
| Warning / Email+Reminder | `#d97706` on `#fffbeb` | `#fbbf24` on `#3d2000` |
| Neutral / On Hold | `#71717a` on `#f4f4f5` | `#a1a1aa` on `#27272a` |
| Danger / Check Remarks | `#dc2626` on `#fef2f2` | `#f87171` on `#3b0a0a` |

## Typography

**Font Family:** Inter (variable), fallback: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif

| Scale | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| xs | 11px | 400-500 | 1.45 | Table headers (uppercase), tags |
| sm | 12px | 400-500 | 1.5 | Labels, captions, secondary text |
| base | 13.5px | 400 | 1.55 | Body, table cells, inputs |
| md | 15px | 500-600 | 1.4 | Card titles, nav items |
| lg | 18px | 600 | 1.35 | Page headings |
| xl | 22px | 700 | 1.25 | Dashboard stat numbers |

**Rules:**
- No system sans-serif defaults (Arial, Helvetica) on main UI
- All caps only for table column headers and section labels — never decorative
- Numeric data uses tabular numbers (font-variant-numeric: tabular-nums)

## Spacing

8px base unit system:
- 2px: micro gap (icon + label)
- 4px: tight (badge padding)
- 8px: small (input padding y, chip gap)
- 12px: medium (input padding x, card padding sm)
- 16px: base (panel padding, table cell padding x)
- 20px: relaxed (page padding)
- 24px: section gap
- 32px: large section gap

## Borders & Radius

| Element | Radius |
|---------|--------|
| Button, Input | 8px |
| Card / Panel | 10px |
| Badge / Tag | 5px |
| Avatar | 9999px |
| Modal | 12px |

Border width: 1px everywhere. No 2px borders except focus rings.

## Shadows

Card (light): box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.04)
Card (dark): box-shadow: 0 1px 3px rgba(0,0,0,0.3)
Modal: box-shadow: 0 20px 60px rgba(0,0,0,0.15)
No drop shadows on buttons or nav items.

## Components

### Buttons
- Primary: bg-[#2563eb] text-white, 7px y / 14px x padding, 8px radius, 500 weight
- Secondary: white bg, border border-[#e4e4e7], neutral text, same sizing
- Danger: bg-[#dc2626] text-white
- Ghost: transparent bg, neutral text, hover fills with subtle bg
- All buttons: cursor-pointer, disabled at 50% opacity, no box-shadow

### Inputs
- 1px border #e4e4e7, 8px radius, 8px y / 12px x padding
- Focus: border-[#2563eb] with ring-2 ring-blue-500/10
- Placeholder: text-[#a1a1aa]

### Tables
- Header row: uppercase, 11px, #a1a1aa, bg-[#fafafa]
- Row border: 1px #f0f0f2, removed on last row
- Row hover: bg-black/[0.015] (light) / bg-white/[0.025] (dark)
- Cell padding: 11px top/bottom, 16px left/right
- Sticky header on scroll

### Status Badges
- rounded-[5px] pill shape, 3px y / 8px x padding, 11px 500 weight
- Ring border for color variant (1px inset ring)
- No icons inside badges — text label only

### Sidebar (dark)
- Background: #111113
- Active nav item: bg-white/10 with text-white, icon in #3b82f6
- Inactive: text-white/40, hover text-white/80
- Width: 220px
- Border right: border-white/[0.06]

### Cards / Panels
- White background (light), #111113 (dark)
- rounded-[10px] corner radius
- border border-[#e4e4e7] (light), border-[#27272a] (dark)
- Subtle shadow (see above)
- Internal padding: 20px

## Iconography
- Library: Lucide React (stroke width 1.5)
- Sizes: 14px (inline), 16px (button), 20px (nav), 24px (hero/stat)
- Never use emoji as icons
- Keep icon color in sync with text color; use accent color only on active state

## Motion & Animation
- Duration: 100-150ms for micro (hover, toggle); 200ms for panels/drawers
- Easing: ease-out for appear, ease-in for disappear
- No bounce, spring, or elastic easing
- prefers-reduced-motion: reduce collapses all animations to instant
- Skeleton loaders for data-dependent content (not spinners)

## Layout

### App Shell
- Sidebar: 220px fixed left (dark bg)
- Content area: flex-1, bg-[#f5f5f7] (light) / bg-[#0d0d0f] (dark)
- Header: 48px, white/dark bg, 1px border bottom
- Main content: p-5 lg:p-6, overflow-y-auto

## Anti-Patterns to Avoid
- No pure black (#000000) or pure white (#ffffff) in dark mode — always tinted
- No gradient backgrounds on data UI
- No card-in-card nesting
- No box shadows on inline elements (badges, tags, chips)
- No border-radius above 12px on rectangular containers
- No placeholder text as labels — use real labels above inputs
- No font-size below 11px for any readable text
