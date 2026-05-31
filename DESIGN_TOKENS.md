# Design Tokens — AmigaHorse_Web

> Eerste UI-tokens v0.0.2-CannonFodder. Gebaseerd op Workbench 1.3 stijl (1989 Commodore). Hommage aan de originele Amiga-look, zonder skin-fetisj — modern responsive + leesbaar.

## Kleurpalet

### Workbench-stijl basis

| Token | Hex | Toepassing |
|---|---|---|
| `--wb-grey-light` | `#aaaaaa` | Achtergrond panels, dropzone idle |
| `--wb-grey-mid` | `#888888` | Dividers, borders default |
| `--wb-grey-dark` | `#555555` | Tekst secundair, disabled |
| `--wb-blue` | `#0055aa` | Primary actie, selected state, focus-ring |
| `--wb-blue-light` | `#5588dd` | Hover op primary |
| `--wb-white` | `#ffffff` | Inhoud-paneel, dropzone-actief |
| `--wb-black` | `#000000` | Tekst primair, code |
| `--wb-orange` | `#ff8800` | Waarschuwing (KS-versie-mismatch), AmigaBASIC-quirk-banner |
| `--wb-red` | `#dd0000` | Error (asset upload failed) |
| `--wb-green` | `#00aa44` | Success (Asset geladen, warm-snapshot bake klaar) |

### Modes

- **Light (default)** = Workbench 1.3 grijs/wit
- **Dark** = WB 1.3 mid-grey-omkering (v0.0.3+)
- **Hi-contrast** = pure zwart-wit voor a11y (v0.1.x)

## Typografie

| Token | Stack | Use |
|---|---|---|
| `--font-mono` | `'Topaz', 'IBM Plex Mono', ui-monospace, monospace` | BASIC-code, file-namen, emulator-overlay |
| `--font-ui` | `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif` | Buttons, headings, body |
| `--font-bitmap` | `'Topaz'` (web-font v0.0.3) | Optionele retro-modus voor hele UI |

| Size | rem | px @16 | Use |
|---|---|---|---|
| `--text-xs` | 0.75 | 12 | Captions, sub-labels |
| `--text-sm` | 0.875 | 14 | Body secundair |
| `--text-base` | 1 | 16 | Body primair |
| `--text-lg` | 1.25 | 20 | Card-headings |
| `--text-xl` | 1.5 | 24 | Page-headings |
| `--text-2xl` | 2 | 32 | Hero (landing) |
| `--text-3xl` | 3 | 48 | Quick-BASIC dropzone "Drop .bas hier" |

## Spacing

8-pixel-grid (Workbench-paradigma):

| Token | rem | px |
|---|---|---|
| `--space-1` | 0.5 | 8 |
| `--space-2` | 1 | 16 |
| `--space-3` | 1.5 | 24 |
| `--space-4` | 2 | 32 |
| `--space-6` | 3 | 48 |
| `--space-8` | 4 | 64 |

## Border / Radius

| Token | Waarde |
|---|---|
| `--border-thin` | `1px solid var(--wb-grey-mid)` |
| `--border-thick` | `2px solid var(--wb-black)` (WB-icon-paradigma) |
| `--radius-sm` | `2px` (zacht, niet rond) |
| `--radius-md` | `4px` |
| `--radius-lg` | `8px` |
| `--radius-pill` | `9999px` (alleen voor status-chips) |

## Shadows / Effects

Workbench 1.3 had geen shadows. We gebruiken ze functioneel (focus + hover) maar minimaal.

| Token | Waarde |
|---|---|
| `--shadow-card` | `0 1px 0 var(--wb-grey-dark)` (1 px alleen, retro) |
| `--shadow-focus` | `0 0 0 3px var(--wb-blue)` (a11y focus-ring) |
| `--shadow-dropzone-active` | `inset 0 0 0 3px var(--wb-blue)` |

## Breakpoints

| Token | Waarde | Use |
|---|---|---|
| `--bp-sm` | `640px` | Mobile portrait → landscape |
| `--bp-md` | `768px` | Tablet portrait |
| `--bp-lg` | `1024px` | Desktop |
| `--bp-xl` | `1280px` | Wide desktop |

**Quick-BASIC dropzone** is mobile-first (volledig scherm), Full mode is desktop-first (library + player side-by-side ≥1024px).

## Componenten — eerste set v0.0.2

| Component | Doel |
|---|---|
| `<DropZone>` | Drag-drop area met active/idle/error-states (BASIC-mode + Full mode shared) |
| `<EmulatorCanvas>` | WebGL/Canvas2D wrapper voor vAmiga framebuffer |
| `<OsdMenu>` | Pauze/save/reset overlay tijdens emulatie |
| `<TouchJoystick>` | On-screen 8-way joystick + fire (mobile, autohide bij gamepad-detect) |
| `<SetupWizard>` | 4-step (KS / WB / AmigaBASIC / bake) progress-track |
| `<CompatBanner>` | KS-versie-mismatch + AmigaBASIC-quirk info-banner |
| `<ModeSwitch>` | Header-toggle Quick BASIC ↔ Full mode |

## v0.0.3 roadmap tokens

- Topaz web-font hosten en correct gelicenseerd (Amiga Topaz reverse-engineerd, public-domain varianten beschikbaar)
- Dark mode (omgekeerd WB-grijs)
- A11y-audit (focus-rings, contrast-ratio's, screen-reader voor BASIC-prompt)
- Animations-tokens (subtle fade-in/out, geen retro-fakery)
