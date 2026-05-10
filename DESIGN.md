# Design Brief

## Direction

Pharmaceutical field staff HR portal — light mode, clean white/slate aesthetic with blue-purple accent. Leave applications, manager approval workflows, GPS compliance, and performance dashboards integrated into role-based portals. Professional, accessible, zero decoration. New performance visualization (Doctor Visit % Trend Chart), alert severity system (Missed Visit alerts), and action button accent (Doctor Call CTA).

## Tone

Light mode primary, slate text on off-white backgrounds. Focused, efficient, high-contrast for accessibility. Pharmaceutical trust via blue-purple primary; green approval and red rejection states for operational clarity.

## Differentiation

Leave feature integrates status badges (Pending=muted, Approved=accent, Rejected=destructive), manager approval panels with action hierarchy, and discrete GPS permission indicators. **New dashboard enhancements**: Doctor Visit % Trend Chart with color-coded lines (green improving, red declining, gray neutral) for 6-month performance visibility. Missed Visit Alert cards with red (critical 30+ days overdue) and orange (warning 20–29 days) severity levels—dismiss-able with single tap. Doctor Call button in header as vibrant teal accent (distinct from purple primary) for one-tap entry. All within existing light-mode card-based structure. No new visual language introduced.

## Color Palette

| Token                    | OKLCH           | Role                                |
| ------------------------ | --------------- | ----------------------------------- |
| background               | 0.98 0.003 250  | Off-white, light enterprise         |
| foreground               | 0.18 0.025 250  | Slate text, high contrast           |
| card                     | 1 0 0           | Pure white card backgrounds         |
| primary                  | 0.45 0.18 264   | Blue-purple CTA, pharma trust       |
| accent                   | 0.45 0.18 264   | Blue-purple approved state          |
| destructive              | 0.52 0.22 30    | Red-orange, urgent/reject           |
| muted                    | 0.95 0.008 250  | Light gray pending state            |
| trend-improving          | 0.65 0.2 142    | Green trend line, upward perf       |
| trend-declining          | 0.55 0.22 30    | Red trend line, downward perf       |
| trend-neutral            | 0.65 0.08 250   | Gray trend line, flat/stable        |
| alert-critical           | 0.52 0.22 30    | Red alert text, 30+ days overdue    |
| alert-critical-bg        | 0.98 0.008 30   | Very light red card background      |
| alert-warning            | 0.58 0.2 50     | Orange alert text, 20–29 days       |
| alert-warning-bg         | 0.97 0.012 50   | Very light orange card background   |
| button-action            | 0.55 0.18 180   | Teal/cyan Doctor Call button accent |
| button-action-foreground | 0.98 0.005 180  | White text on teal button           |

## Typography

- Display: Space Grotesk — headings, role labels, dashboard titles (font-bold, tracking-tight)
- Body: DM Sans — form labels, list items, table content, descriptions
- Scale: hero `text-4xl font-bold tracking-tight`, h2 `text-2xl font-bold tracking-tight`, label `text-xs font-semibold uppercase`, body `text-sm/base`

## Elevation & Depth

Subtle card shadows via `shadow-subtle` (1px y-offset). Card depth through `bg-card` with 1px border. Section separation via `bg-background`. Chart cards use same elevation. Alert cards add left border accent (2px, `border-alert-critical` or `border-alert-warning`) for severity indication. No neon, glow, or ambient effects.

## Structural Zones

| Zone    | Background   | Border               | Notes                         |
| ------- | ------------ | -------------------- | ----------------------------- |
| Header  | `bg-card`    | `border-b border-border` | Role name, GPS badge, logout  |
| Sidebar | `bg-sidebar` | `border-r border-sidebar-border` | Portal nav, leave/approval links |
| Content | `bg-background` | —                    | Leave forms, approval panels  |
| Cards   | `bg-card`    | `border border-border` | Form sections, approval queue |
| Footer  | `bg-muted/30` | `border-t border-border` | Session info, support link    |

## Spacing & Rhythm

16px gaps between sections, 12px padding inside cards, 8px micro-spacing within form groups. Vertical form rhythm: label → input (1.5 gap) → helper text (0.5 gap). Section alternation via `bg-background` and `bg-muted/30`. Touch targets minimum 44px height on mobile.

## Component Patterns

- Buttons: `bg-primary text-primary-foreground rounded-lg px-3 py-2 text-sm font-medium`, hover via `opacity-90`
- Action Button (Doctor Call): `bg-action text-action-foreground rounded-lg px-4 py-2 text-sm font-medium`, hover via `opacity-85` — vibrant teal, positioned top-right header
- **Dashboard Action Buttons (ASM/RSM)**: `dashboard-btn` base class + color mixin (`dashboard-btn-attendance`, `dashboard-btn-locations`, etc.). Flexbox column layout, 44px+ touch targets, icon + label + subtitle, 2-column grid on mobile, badge support for pending counts. Six colors: Blue (Attendance), Green (Locations), Orange (Call Reports), Purple (Call Details), Red (Missed), Teal (Leave).
- **Doctor Call Entry**: Card-based modal with Step 1 (Station selection from master), Step 2 (scrollable doctor cards with Name/Specialization/Clinic/Category, live search filter, "No doctor found" fallback). After doctor selection: collapsible "Last 2 Visits" section showing date/products/samples/gifts/remarks. Below: multi-select product list with collapsible "Details Discussed" text inputs per product. Multi-row "Samples Given" section with product dropdown + quantity inputs + remove button. Multi-row "Gift Articles Given" section with searchable dropdown from Gift Master + quantity + remove button.
- Status badges: Pending=`bg-muted text-muted-foreground`, Approved=`bg-accent/10 text-accent`, Rejected=`bg-destructive/10 text-destructive`
- Alert cards: Critical=`bg-alert-critical-bg border-l-4 border-alert-critical`, Warning=`bg-alert-warning-bg border-l-4 border-alert-warning`, with dismiss button (text-muted, hover to text-foreground)
- Cards: `bg-card border border-border rounded-lg p-4 shadow-subtle`
- Doctor cards (Call Entry): `doctor-card` mixin — white background, border, rounded 12px, 4px padding, hover shadow, tap scale feedback
- Trend Chart: Recharts LineChart with grid (`chart-grid` stroke), three trend lines (improving=green, declining=red, neutral=gray), light bg-card background, tooltip with `chart-tooltip` styling
- Forms: `border border-input bg-card rounded-lg px-3 py-2` inputs, labels above, 1.5 vertical gap, required asterisk in destructive color
- Ticker strip: `bg-alert-critical text-white p-2 rounded-sm animate-ticker-scroll` for scrolling missed doctor names (right-to-left marquee)

## Motion

Fade-in 150ms on form load. Button hover: `opacity-90 transition-colors-fast`. Modal entrance: slide-up 200ms. Chart lines fade on load. Alert cards appear with subtle pulse (`animate-pulse-subtle`, 2s) on first view. Ticker strip animates continuously left-to-right at 20s per cycle (`animate-ticker-scroll`). **Dashboard action buttons**: scale-95 on active/tap, opacity-90 on hover, 200ms transition. Doctor card selection: tap feedback via scale-95. Badge entrance (pending count): fade-in 150ms with pulsing background. No animation loops on non-alert elements or decorative motion beyond these patterns.

## Constraints

- Light mode only (accessible, consistent with user preference)
- No gradients, no ambient effects, no illustration
- Border-radius 8px max (compact, professional)
- Card-based structure for section scanability
- Role hierarchy via color badges and layout position
- Accessibility: WCAG AA+ contrast, focus rings, 44px touch targets on mobile

## Signature Detail & Extensions

Leave application integrates seamlessly into existing light-mode portfolio. Status states (Pending/Approved/Rejected) use semantic colors mapped to leave lifecycle. GPS permission indicator in header as discrete badge, not intrusive. Manager approval panel mirrors form card style—clean, scannable, action-focused.

**Doctor Call Entry enhancements (V46+)**: Modal-driven flow with Step 1 (Station dropdown from master), Step 2 (scrollable doctor cards showing Name, Specialization, Clinic/Hospital, Category with instant search filter and "No doctor found" fallback). After doctor selection: collapsible "Last 2 Call Records" panel showing date, products discussed, samples, gifts, remarks from past visits. Below: searchable product list (checkbox per product, expands to Details Discussed text input). Multi-row "Samples Given" section with product dropdown + quantity spinner + remove button. Multi-row "Gift Articles" section with searchable lookup from Gift Master + quantity + remove. All stored as single call record on submission. Components use existing card-based structure with subtle shadows and blue-purple accents.

**ASM/RSM Dashboard redesign (V46+)**: Replaces stat widgets with 6 large action buttons in 2-column grid on mobile (stacked below greeting and territory display). Each button: distinct color (Blue/Green/Orange/Purple/Red/Teal), icon + bold label + subtitle line describing action. Attendance button shows "Checked In ✓" if already checked in today. Call Reports and Leave Approval buttons display red badge with pending count. All buttons 44px+ touch targets, scale-95 on tap, opacity-90 on hover. Full navigation preserved via hamburger sidebar. No existing functionality removed.

