# BASIC mode — AmigaHorse_Web

> Implementatie van **P-AMH-09 (BASIC as first-class use-case)** voor AmigaHorse_Web v0.0.2-CannonFodder. Dit document beschrijft de flow, de afhankelijkheden, de bekende quirks en de v0.0.3-roadmap.

## Doel

Geef Amiga-liefhebbers die zelf `.bas`-programma's hebben geschreven (of nog willen schrijven) een pad van **drop → RUN in ~1-2 seconden**, zonder eerst een hele Workbench-omgeving handmatig op te bouwen.

## Doelgroep

- Iemand die in 1989 op zijn Amiga 500 een AmigaBASIC-game schreef en die `.bas`-files nog ergens heeft
- Iemand die nu een `.bas` schrijft in een teksteditor en hem snel wil testen
- Iemand die les wil geven in Amiga-historie en BASIC-programmering wil demonstreren

## Historische context AmigaBASIC

- **Microsoft AmigaBASIC** (Bob Doyle, Charles Petzold), eerste release 1985 op de Amiga 1000
- Geleverd met Workbench 1.1, 1.2, 1.3 (Microsoft-licentie verviel rond 1989 → Commodore verving het door **AmigaBASIC** in 1.3, ABasiC, en stopte uiteindelijk met bundelen)
- **Werkt NIET op Kickstart 2.0+** — Commodore's nieuwe Kickstart 2.0 brak de assumpties van AmigaBASIC (geheugenmanagement + libcall-conventies); dit is een bekende Commodore-bug die nooit officieel gefixt is
- Tokenized binary format + ASCII export beide ondersteund
- Bekende quirks:
  - Sprite-corruptie bij overlappende COLLISION-events op late hardware-versies
  - Geen 68020+ support (alleen 68000/68010 stack-frame-conventies)
  - Geen support voor extra-half-bright of HAM-modus
  - `LIBRARY`-statement (toegevoegd in latere updates) is buggy

## Stack-keuze v0.0.2

| Component | Versie | Bron |
|---|---|---|
| Hardware-model | A500 OCS | Vast (P-AMH-09 lockt UI hierop in BASIC-mode) |
| Kickstart | 1.3 (rev 34.005) | User-supplied via `/basic/setup` |
| Workbench | 1.3 ADF | User-supplied via `/basic/setup` |
| BASIC-interpreter | Microsoft AmigaBASIC 1.x | User-supplied via `/basic/setup` |
| Emulator-core | vAmiga via vAmigaWeb-fork | GitHub: vAmigaWeb/vAmigaWeb (GPL-3.0 → AGPL-3.0) |

## Flow detail

### Eenmalige Asset-Setup (`/basic/setup`)

Drie-stap-wizard. Elke upload doorloopt SHA-256 en wordt met label in IndexedDB opgeslagen.

```
[Step 1/4]  Drop kick13.rom  (verwacht ~256 KB)
            ├─ Validate SHA-256 tegen bekende-hashes-lijst (waarschuwing bij mismatch — geen blokkering)
            ├─ Store: amigahorse-kickstart / label: kick13
            └─ Toon "✓ Kickstart 1.3 geladen"

[Step 2/4]  Drop wb13.adf    (verwacht 880 KB exact)
            ├─ Validate file-grootte
            ├─ Store: amigahorse-disks / label: wb13-master
            └─ Toon "✓ Workbench 1.3 geladen"

[Step 3/4]  Drop AmigaBASIC binary  (verwacht ~100 KB)
            ├─ Of: gebruik "AmigaBASIC" file van wb13.adf direct
            ├─ Store: amigahorse-kickstart / label: amigabasic-bin
            └─ Toon "✓ AmigaBASIC geladen"

[Step 4/4]  Bake warm-snapshot  (eenmalig, ~10 sec)
            ├─ vAmiga.start(kick13)
            ├─ vAmiga.loadADF(wb13.adf, df=0)
            ├─ Wait for Workbench boot (~4 sec)
            ├─ Open AmigaBASIC via simulated double-click
            ├─ Wait for BASIC-prompt (Ready)
            ├─ vAmiga.saveState() → IndexedDB amigahorse-states / label: basic-env-snapshot
            └─ Redirect naar / (Quick BASIC dropzone)
```

### Per-`.bas` Quick-launch (`/`)

```
[1]  User drops .bas op dropzone
     └─ FileReader leest content (ASCII of tokenized)

[2]  Schrijf naar Emscripten MEMFS
     └─ FS.writeFile('/dh1/launch.bas', content)

[3]  Restore warm-snapshot
     └─ vAmiga.restoreState(basic-env-snapshot)  (~100 ms)
     └─ Amiga staat nu in BASIC-prompt ("Ready")

[4]  Mount hostfs als DH1:
     └─ vAmiga.mountDH('/dh1')   (vAmigaWeb-API te verifieren; fallback = ADF-rebuild)

[5]  Inject keyboard
     └─ injectKey('LOAD "DH1:launch.bas"<CR>')   (~200 ms typing rate)

[6]  Auto-RUN (default) of stop in prompt (toggle)
     └─ Auto-RUN: injectKey('RUN<CR>')
     └─ Toggle stop: laat user zelf RUN/LIST typen via emulator-keyboard

[7]  Klaar — programma draait
     └─ Total cold: ~1.5 sec
     └─ Total warm-cache: ~500 ms
```

## File-injection-mechanisme

**Voorkeur:** Emscripten MEMFS gekoppeld aan vAmiga's `mountDH` API (hostfs).

Te verifieren in v0.0.2.x: ondersteunt vAmigaWeb dit out-of-the-box? Indien nee:

**Fallback A:** Pre-allocated leeg HDF (e.g. 1 MB), bij elke launch overschrijven we het bestand-deel met de nieuwe `.bas`. Vereist FFS-aware schrijfroutine.

**Fallback B:** On-the-fly ADF-rebuild. Per launch een nieuwe `df1.adf` genereren met `launch.bas` erin → `mountADF(adf, df=1)`. Trager (~500 ms image-build extra) maar betrouwbaar.

## UI-tokens (Amiga-stijl)

Zie `DESIGN_TOKENS.md`. Workbench-grijs (`#a0a0a0` 1.3-versie), Topaz-font (8/11 pixel-bitmap), blauw selectie (`#0055aa`). Dropzone-stijl = WB 1.3 disk-icoon-paradigma.

## Bekende quirks (gedocumenteerd in UI als info-banner)

- **AmigaBASIC werkt niet op KS 2.0+** — als user later KS 2.05/3.1 selecteert in Full mode, blokkeren we BASIC-mode met een uitleg
- **Sprite-bugs** in AmigaBASIC bij snelle COLLISION → niet onze bug, documenteer in info-banner
- **Geen 68020+ stack-frames** — vAmiga emuleert A500 (68000), geen issue
- **Tokenized `.bas`-bestanden:** AmigaBASIC herkent zowel ASCII als tokenized; geen verschil voor onze flow
- **Bestandsnamen met spaties** → Amiga-FS verbiedt sommige tekens; we sanitizen `launch.bas` als veilige naam

## Niet-scope BASIC-mode v0.0.2

- BASIC-edit-modus (alleen run; voor edit gebruik Full mode + open AmigaBASIC handmatig)
- Multi-file BASIC-projecten (alleen single-file `.bas`)
- BASIC → executable compilatie
- AMOS / HiSoft / Blitz BASIC (alleen Microsoft AmigaBASIC)
- AmigaBASIC op KS 2.0+ (Commodore-bug; lockt UI)
- Save/load van running BASIC-state (alleen warm-start vanaf prompt)

## v0.0.3+ roadmap

- **AMOS support** — eigen runtime (AMOS Professional ROM is closed; AMOS source is GPL beschikbaar)
- **`amigahorse-basic-bundle.zip`** — één-file asset-upload i.p.v. 3 pickers
- **BASIC-edit-modus** — open in AmigaBASIC zonder auto-RUN, klaar voor LIST/EDIT
- **Multi-file** — bestanden in een dir komen samen op DH1:
- **CHIP-share** — deelbare URLs `/share?bas=<hash>` (alleen hash, niet content)
- **Mobile-touch** — virtual keyboard speciaal voor BASIC-prompt typing
