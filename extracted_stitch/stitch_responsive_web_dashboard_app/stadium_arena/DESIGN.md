---
name: Stadium Arena
colors:
  surface: '#0f131d'
  surface-dim: '#0f131d'
  surface-bright: '#353944'
  surface-container-lowest: '#0a0e18'
  surface-container-low: '#171b26'
  surface-container: '#1c1f2a'
  surface-container-high: '#262a35'
  surface-container-highest: '#313540'
  on-surface: '#dfe2f1'
  on-surface-variant: '#bbcabf'
  inverse-surface: '#dfe2f1'
  inverse-on-surface: '#2c303b'
  outline: '#86948a'
  outline-variant: '#3c4a42'
  surface-tint: '#4edea3'
  primary: '#4edea3'
  on-primary: '#003824'
  primary-container: '#10b981'
  on-primary-container: '#00422b'
  inverse-primary: '#006c49'
  secondary: '#ffb95f'
  on-secondary: '#472a00'
  secondary-container: '#ee9800'
  on-secondary-container: '#5b3800'
  tertiary: '#ffb3af'
  on-tertiary: '#650911'
  tertiary-container: '#fc7c78'
  on-tertiary-container: '#711419'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#6ffbbe'
  primary-fixed-dim: '#4edea3'
  on-primary-fixed: '#002113'
  on-primary-fixed-variant: '#005236'
  secondary-fixed: '#ffddb8'
  secondary-fixed-dim: '#ffb95f'
  on-secondary-fixed: '#2a1700'
  on-secondary-fixed-variant: '#653e00'
  tertiary-fixed: '#ffdad7'
  tertiary-fixed-dim: '#ffb3af'
  on-tertiary-fixed: '#410005'
  on-tertiary-fixed-variant: '#842225'
  background: '#0f131d'
  on-background: '#dfe2f1'
  surface-variant: '#313540'
  pitch-void: '#050811'
  pitch-base: '#0B0F19'
  pitch-surface: '#111827'
  pitch-elevated: '#1F2937'
  pitch-border: '#374151'
  pitch-divider: '#1E293B'
  neon-emerald: '#10B981'
  neon-emerald-glow: rgba(16, 185, 129, 0.25)
  gold-trophy: '#F59E0B'
  gold-glow: rgba(245, 158, 11, 0.2)
  card-red: '#EF4444'
  card-red-glow: rgba(239, 68, 68, 0.25)
  card-yellow: '#FBBF24'
  referee-cyan: '#06B6D4'
  text-primary: '#F9FAFB'
  text-secondary: '#9CA3AF'
  text-muted: '#6B7280'
typography:
  display-hero:
    fontFamily: Oswald
    fontSize: 72px
    fontWeight: '700'
    lineHeight: 76px
    letterSpacing: 0.02em
  display-hero-mobile:
    fontFamily: Oswald
    fontSize: 44px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: 0.02em
  scoreboard-lg:
    fontFamily: Oswald
    fontSize: 56px
    fontWeight: '700'
    lineHeight: 60px
    letterSpacing: 0.04em
  scoreboard-lg-mobile:
    fontFamily: Oswald
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: 0.03em
  headline-lg:
    fontFamily: Oswald
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 38px
    letterSpacing: 0.02em
  headline-lg-mobile:
    fontFamily: Oswald
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: 0.02em
  headline-md:
    fontFamily: Oswald
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: 0.01em
  headline-sm:
    fontFamily: Oswald
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: 0.02em
  timer-display:
    fontFamily: Oswald
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: 0.05em
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.08em
  label-tech:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  space-2xs: 0.25rem
  space-xs: 0.5rem
  space-sm: 0.75rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 3rem
  space-3xl: 4rem
  scoreboard-gutter: 1rem
  timeline-pad: 1.25rem
  arena-margin-desktop: 2.5rem
  arena-margin-mobile: 1rem
---

## Brand & Style

This design system powers a high-stakes, broadcast-grade academic esports arena. The aesthetic fuses the electrifying atmosphere of UEFA Champions League night fixtures with the clinical, high-density data overlays of Tier-1 tactical esports championships.

The experience is centered around adrenaline, tension, and unquestioned referee authority. The design style combines dark broadcast minimalism with tactical scoreboard brutality: pitch-deep slate backgrounds, stadium floodlight emeralds, electric tournament gold badges, razor-sharp status lines, and punchy condensed typography. The interface must communicate real-time velocity, instant decision transparency, and tournament prestige whether viewed on a player mobile device, an umpire touch console, or an arena spectator jumbotron.

## Colors

The dark arena palette is anchored in deep nighttime pitch tones (`#050811` and `#0B0F19`), serving as a zero-distraction canvas for instantaneous data capture. 

- **Neon Emerald (`#10B981`)**: The primary brand and action color. Represents active field play, match kickoff, approved goals, verified answers, and alive state countdowns.
- **Trophy Gold (`#F59E0B`)**: The secondary color, used exclusively for high-stakes prestige highlights, match victories, captain armbands, and tournament leader indicators.
- **Disciplinary & Status Alerts**: `card-yellow` (`#FBBF24`) and `card-red` (`#EF4444`) provide authentic sports officiating hierarchy for referee warnings, bookable offenses, and disallowed goals.
- **Referee Cyan (`#06B6D4`)**: A dedicated functional color reserved for the referee suite, normalization engine controls, and official timekeeper decisions.
- **High-Contrast Dark Canvas**: Text tokens range from ultra-bright `#F9FAFB` for scoreboard digits and primary questions to muted `#6B7280` for technical timestamps and sub-bench designations.

## Typography

The type system creates a split-second structural contrast between broadcast showmanship and operational precision.

- **Headline & Scoreboards (`Oswald`)**: The condensed verticality of Oswald delivers commanding scoreboard authority, ideal for high-impact goal reveals, match headers, massive score displays, and ticking pressure countdowns. Headlines should routinely be presented in uppercase with tightened tracking to emulate real sports telecasts.
- **Body & Controls (`Inter`)**: Inter delivers unmatched optical clarity under intense multi-player answering conditions. Its neutral geometry ensures answers, referee logs, time splits (`12:04:103`), and player substitutions remain instantly scannable without optical fatigue.
- **Display Scaling**: Massive scoreboard counters and countdown clocks collapse systematically on mobile screens via designated mobile tokens to preserve tabular integrity.

## Layout & Spacing

The arena layout follows a 12-column dynamic fluid grid on desktop and tablets, switching to a high-density, vertical stack layout on mobile devices.

- **Top Fixture Bar**: Persistent, fixed-height (64px desktop / 56px mobile) pinned score strip displaying match clock, live score line, and question milestone tracker (`QUESTION 7 / 10`).
- **Match Grid**: Desktop divides into a tripartite arrangement: Active Pitch / Arena Arena Canvas (6 columns, centered), Live Timeline / Substitution Bench (3 columns, left), and Referee / Answering Console (3 columns, right).
- **Mobile Reflow**: Scoreboard docks persistently to the sticky header. The question, input area, and referee decision banners take absolute focal priority, with the timeline accessible via a segmented drawer or toggle.
- **Rhythm**: Spacing follows a 4px structural unit, relying heavily on `space-sm` (12px) and `space-md` (16px) inside cards to pack competitive intelligence cleanly without visual crowding.

## Elevation & Depth

Visual hierarchy is constructed through technical surface stacking, razor-thin borders, and neon telemetry luminescence rather than fuzzy dropshadows.

- **Level 0 (Arena Pitch)**: The base application canvas (`#050811`), completely dark and non-reflective.
- **Level 1 (Card & Stadium Surfaces)**: Surface panels (`#0B0F19` and `#111827`) bounded by a subtle 1px sports mesh border (`#1F2937` or `#374151`).
- **Level 2 (Active Arena Overlay & Floating Dials)**: Elevated referee panels, active question modals, and flyouts (`#1F2937`) edged with an inner highlight stroke (`rgba(255, 255, 255, 0.05)`).
- **Luminescence (Neon Glow Tiers)**: Goal declarations and zero-hour countdown ticks emit directional colored glows. Active countdown timer emits `neon-emerald-glow` (0 0 24px rgba(16, 185, 129, 0.25)). Imminent penalty or time-out states glow with `card-red-glow`.

## Shapes

The design system employs a disciplined, angular, soft-cornered profile (`roundedness: 1`). 

- Standard components (buttons, answer cards, match events) use a crisp `4px` radius (`0.25rem`), preserving an aggressive, tactical sports hardware silhouette.
- Scoreboard pods and large module containers use `8px` (`0.5rem`).
- Strict angularity signals precision and discipline: rounded pill shapes are prohibited, except for micro status beads and live radar indicators. Cut corners or chamfered 45-degree accents may be used on primary score panels to evoke stadium scoreboard signage.

## Components

### Persistent Scoreboard Header
- **Layout**: Centered horizontal telemetry strip. Left team badge/name, large numerical digit (`scoreboard-lg`), centered divider with current game clock and round chip (`Q 4/10`), right numerical digit, right team.
- **State Changes**: Score flashes emerald (`#10B981`) for 1200ms upon referee goal verification.

### Question & Countdown Arena Module
- **Question Banner**: Contained within `#111827`, accented with a 2px top border in `neon-emerald`.
- **Timer Pod**: Center-stage circular or bar gauge housing `timer-display` typography. Pulses from `neon-emerald` to `card-red` when remaining time drops under 5 seconds. Locks completely when timer hits `00:00`.

### Answer Input Field & Player Locked State
- **Input Field**: High-contrast dark field (`#0B0F19`), crisp 1px border (`#374151`), focused emerald border with subtle ring.
- **Submission Lock**: Instant lock upon keyboard Enter or submit press. Shifts to disabled glass surface stamped with a locked padlock icon and label: `ANSWER LOCKED — AWAITING REFEREE`.

### Referee Decision Cockpit
- **Submission Table**: Displays player name, raw submission text, normalized answer group, and exact split timestamp (`hh:mm:ss:ms`).
- **Referee Verification Buttons**: 
  - `Accept Goal`: Emerald surface (`#10B981`) with dark contrasting text (`#050811`).
  - `Reject / No Goal`: High-contrast slate card with red border and `card-red` typography.
- **Disciplinary Actions**: Mini trigger pills for Yellow Card, Red Card, and Substitution Approval.

### Timeline Event Stream
- **Feed Elements**: Vertical connected axis with 2px guide rail (`#1E293B`).
- **Event Chips**: High-density rows with timestamp prefix (e.g., `01:12`), event iconography (`⚽`, `❌`, `🟨`, `🔄`), bold player token, and subsequent score update badge.

### Bench & Substitution Roster
- **Active Roster (5 Players)**: Highlighted with green status indicator dot, active role badge (e.g., Captain star in gold).
- **Bench Roster (3 Players)**: Muted opacity (70%), labeled `ON BENCH - INELIGIBLE` until substitution order is authorized by referee.