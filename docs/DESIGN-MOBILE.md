# Handoff: FRETBYWOOD — Mobile redesign (iOS + Android)

## Overview
A mobile‑first redesign of **FRETBYWOOD** (accordguitare) — the guitar/piano chord tool at
https://accordguitare.joefr.cloud/ (repo: github.com/joe17xe/accordguitare). The desktop app packs
six top‑nav tools (Accords, Suites, Gammes, Chansonnier, Accordeur, Métronome) plus a guitar/piano
chord‑detection engine into a two‑column layout. This redesign rethinks it for phones: a **5‑tab
bottom nav**, a **thumb‑friendly fretboard**, and a first‑class **guitar ↔ keyboard sync** flow for
composers building arrangements. The brand is **evolved, not reinvented** — same dark ground + emerald
accent + Outfit type, plus a small two‑instrument colour language and a monospace for readouts.

The chosen visual direction is **1c** ("sync studio", Material 3 / iOS). Recreate all screens in that
language.

## About the Design Files
The files in this bundle are **design references authored in HTML/CSS** — prototypes that show the
intended look, layout, copy and behaviour. **They are not production code to ship.** The task is to
**recreate these designs inside the existing app** (Vite + React 19 + TypeScript + Tailwind v4), reusing
its established components, state and music logic. Only the **UI layer** changes; the domain logic
(`src/utils/music.ts`, `src/utils/pitch.ts`, `src/utils/audio.ts`, `chordpro.ts`) stays as‑is.

Open `FRETBYWOOD Mobile.html` in a browser to view all ten screens (it needs network access for Google
Fonts). `FRETBYWOOD Mobile.dc.html` is the same markup in the authoring format — use `.html` for viewing.

> **"Will I get the same design?"** Yes. This README specifies exact hex values, type, spacing, radii and
> per‑screen layout, and the HTML files are the pixel source of truth. A developer following both will
> reproduce these screens faithfully. Where a number isn't listed, read it off the HTML.

## Fidelity
**High‑fidelity.** Final colours, typography, spacing and layout. Recreate pixel‑close using Tailwind +
your existing components. The instruments (fretboard, piano, chord diagram) are drawn as inline SVG in
the mocks; in the app, **reuse and restyle your existing `Fretboard`, `ChordDiagram`, `PianoKeyboard`
components** rather than porting the mock SVGs verbatim — the mock SVGs are static illustrations of the
target look, your components already produce the real interactive geometry.

---

## Design Tokens

### Colour
| Role | Hex | Notes |
| --- | --- | --- |
| App background (screen) | `#0A0C0B` | near‑black, slight cool‑green |
| Bg glow — guitar/emerald | `rgba(16,185,129,0.12–0.16)` | radial, top of screen |
| Bg glow — piano/amber | `rgba(240,178,75,0.07–0.09)` | radial, bottom |
| Surface (glass) | `bg rgba(255,255,255,0.045)` · `border rgba(255,255,255,0.08)` | cards, switches; lighter variants `.03`/`.055`/`.06` |
| **Emerald — base (guitar / primary)** | `#10B981` | buttons, active nav, guitar dots |
| Emerald — light | `#34D399` | chord names, scale notes, highlights on dark |
| Emerald — deep | `#059669` | gradient bottom, borders |
| Ink on emerald | `#052018` | text/icons on emerald fills |
| **Amber (piano / keys)** | `#F0B24B` | active piano keys, keys accents |
| Amber — deep (piano root) | `#E0952A` | root key |
| **Rose (tonic / muted string)** | `#FB7185` | root‑note dots, mute "X", root chips |
| Text — high | `#EAF0EC` | headings, key values |
| Text — secondary | `#C7CFCB` | chip labels |
| Text — muted | `#9BA3A0` | sublabels |
| Text — faint | `#6B726F` | inactive nav, meta, uppercase kickers |
| Piano white key | `#EDEBE4` | inactive white key |
| Piano black key | `#141414` | |
| Fretboard wood | gradient `#1c1410 → #2c211a → #1c1410` | nut `#d9d5cc`; strings `#cfcfcf→#bfbfbf`; frets `rgba(210,210,210,0.3)`; inlays `rgba(255,255,255,0.12)` |

Palette relationships: **emerald = guitar, amber = piano, rose = tonic** — apply consistently
everywhere (the sync preview, diagrams, scale degrees, tuner). Keep chroma low elsewhere; lean on the
white‑alpha surfaces and grey text ramp.

### Typography
- **Outfit** (Google Fonts, weights 300–900) — all UI text. Body 15px/500; buttons 13–15px/800;
  section titles 22px/800; chord hero 40–46px/800 (letter‑spacing −1px); big numerics (BPM 108px,
  tuner note 92px). Uppercase kickers: 9–10px/700, letter‑spacing 1–1.4px.
- **JetBrains Mono** (400–700) — numeric/technical readouts only: note names on chips, frequencies,
  BPM label, fret numbers, tab notation (e.g. `3 2 0 0 0 3`), roman numerals.

### Spacing / radii / shadow
- Screen horizontal padding **16px** (Android body) / 16–20px. Card padding 12–16px. Gaps 6–12px.
- Radii: cards **16–20px**, chips 7–10px, buttons 14–18px, nav pill 16px, segmented 9–13px, FABs 50%.
  Device screens: Android **32px**, iOS **38px**.
- Shadows: primary button `0 8px 18px -6px rgba(16,185,129,.5)`; FAB `0 10px 22px -6px rgba(16,185,129,.55)`;
  device frame `0 40px 70px -24px rgba(0,0,0,.55)`. On dark, elevation = subtle emerald glow, not grey drop‑shadow.

---

## Navigation architecture
The desktop app's **six** top tabs collapse to a **five‑item bottom tab bar**:

| Bottom tab | Maps to desktop | Icon (line, 2px stroke) |
| --- | --- | --- |
| **Accords** | Outils d'Accords (workspace + detection) | chord grid |
| **Suites** | Suites d'Accords (ChordProgressions) | layers |
| **Gammes** | Gammes (ScaleExplorer) | waveform |
| **Accordeur** | Accordeur (Tuner) | tuner gauge |
| **Plus** | overflow → **Chansonnier**, **Métronome**, Réglages | three dots |

Active tab: **emerald** (`#10B981`) — on **Android** a filled pill behind the icon
(`bg rgba(16,185,129,.18)`, radius 16px); on **iOS** a 20×3px emerald bar above the icon. Inactive:
`#6B726F`. Labels: Outfit 9px (Android) / 9.5px (iOS), 700 active / 600 inactive.

The instrument selector (**Guitare / Piano / Accord**) is **not** a nav item — it's a segmented control
inside the Accords screen (maps to `inputMode` state).

**Bilingual FR/EN:** a small `FR | EN` segmented pill lives in the top app bar of every screen (active
segment = emerald fill, ink text). All copy has FR + EN strings; the mocks show FR by default with EN
twins on 1b, 2b, 3d.

**Platform chrome:** Android = 32px status bar (punch‑hole dot centred), 52px top app bar, Material nav
+ gesture pill. iOS = 46px status bar (Dynamic Island pill), 48px header, tab bar + home indicator. In
your web app you likely render one responsive layout; use the Android treatment as the default and keep
the iOS specifics for the Capacitor iOS build if desired.

---

## Screens / Views
Ten mocked screens across three "turns". Turn 1 = three home directions to choose from (ship **1c**).
Turns 2–3 = the rest of the app in the 1c language.

### A. Accords (home / chord workspace) — maps to `App.tsx` workspace + `Fretboard`/`PianoKeyboard`/`ChordGenerator` + `ChordDiagram`/`PianoDiagram`
Three directions were explored; **1c is the chosen one**, but 1a/1b are documented for their reusable ideas.

**1c — Sync studio (RECOMMENDED).** Purpose: the composer flow — see the same chord on guitar **and**
keyboard at once and keep them in sync.
- Layout (top→bottom): status bar · app bar (`FRETBYWOOD` wordmark with emerald `OO`, subtitle
  "Studio d'arrangement", FR/EN pill) · chord readout (big emerald chord name `G` 40px + "Sol majeur ·
  Tonique **Sol**" + note chips) · **Guitar panel** (emerald‑tinted card, horizontal neck, `E A D G B E`
  label) · **sync link** chip ("SYNCHRONISÉ", link icon) straddling the two panels · **Piano panel**
  (amber‑tinted card, one‑octave keyboard strip, "Do4 — Do5") · FAB "Ajouter à la partition" · nav.
- Colours: guitar dots emerald `#34D399`, root dots rose `#FB7185`; piano active keys amber `#F0B24B`,
  root key `#E0952A`. Panels: guitar `bg rgba(16,185,129,.05)/border rgba(16,185,129,.16)`; piano
  `bg rgba(240,178,75,.05)/border rgba(240,178,75,.16)`.
- Reuse: `Fretboard` (restyle to this palette), `PianoKeyboard`, and the existing
  guitar→piano / piano→guitar sync `useEffect`s in `App.tsx`. The "SYNCHRONISÉ" chip is a visual cue for
  that existing sync.

**1a — Vertical neck.** Home with the fretboard rotated to portrait (strings vertical, frets top→bottom,
nut at top with O/X markers, finger dots labelled with pitch class). Detection hero card on top
("Moteur harmonique", chord `Am` 46px, "Basse **Mi** | Tonique **La**", note chips, "STANDARD · CAPO 0").
Segmented Guitare/Piano/Accord. Primary "Ajouter à la partition" + circular strum button. Good default if
you want one big playable input surface. Reuse `Fretboard` with a vertical layout variant.

**1b — Diagram‑first (EN twin).** Search field ("C major", note list "C E G") → large `ChordDiagram`
card ("OPEN · EASY") → alternate voicings chips (C, Cadd9, Cmaj7, C/G) → "Play & add". For the
learner/lookup use case. Reuse `ChordDiagram` + `ChordGenerator`.

Shared home components: **Tuning/Capo** control (chip "Standard · Capo 0", stepper) maps to
`tuningId`/`capo` state; **presets/favoris** row maps to `CHORD_PRESETS`.

### B. Suites d'accords — maps to `ChordProgressions.tsx`
**2a (Android) / 2b (iOS, EN twin).** Purpose: build & play a progression.
- Key/style chips ("Tonalité Sol maj.", "Style Pop", shuffle button).
- Progression strip: 4 equal chord cards **G · D · Em · C** with roman numerals **I V vi IV**; the
  playing card is emerald‑outlined (`bg rgba(16,185,129,.10)/border 1.5px rgba(16,185,129,.5)`) with a
  glowing dot; others are glass with muted roman numerals.
- "Accords suivants suggérés / Next chords": chips, first is an emerald suggested pill with a `+` (Am7),
  rest neutral (Bm, C, D7, Cmaj7).
- "Aperçu synchronisé / Synced preview": guitar tab notation `3 2 0 0 0 3` (root digits rose) + amber
  piano strip, with a sync chip.
- Transport bar: emerald play FAB (circular), "Lecture en boucle / Loop playback" + "90 BPM · 4/4"
  (mono), loop button, emerald‑tinted `+` button.
- Nav: **Suites** active.

### C. Gammes — maps to `ScaleExplorer.tsx`
**2c (Android) / 3d (iOS, EN twin "Scale explorer").** Purpose: explore a scale for improv/learning.
- Title "La mineur **pentatonique** / A minor **pentatonic**" (accent word emerald). Chips: "Tonique La /
  Root A" (rose dot), "5 notes", "Blues".
- Neck card (emerald‑tinted): horizontal fretboard with **scale‑degree dots** — root `1` in rose, others
  emerald, labelled `1 ♭3 4 5 ♭7`; open‑string notes sit left of the nut; fret numbers `0 1 2 3`.
  Legend: "Tonique/Root" (rose) · "Note de gamme/Scale note" (emerald).
- "Accords de la gamme / Scale chords" chips: Am(rose dot) C Dm Em G.
- Footer: position stepper ("Pos. 1", ‹ ›) + emerald "Jouer la gamme / Play scale".
- Nav: **Gammes** active. Reuse `ScaleExplorer`; the degree colouring maps to its existing
  root/scale‑note logic (`showRootNote`, `getScaleDegree`).

### D. Chansonnier — maps to `Songbook.tsx` + `chordpro.ts`
**3a (Android).** Purpose: chords‑over‑lyrics arrangement output.
- Song header card: title "Ma composition"; chips "Tonalité Sol" (emerald), "Capo 2", "92 BPM".
- ChordPro body: lyric lines with **chord names above words** — chords JetBrains Mono 11px emerald
  (`#34D399`), lyrics Outfit 15px `#EAF0EC`; a minor chord shown in rose (`Am`). Each word is a
  vertical [chord / lyric] stack; empty chord slots reserve 16px so baselines align.
- Footer: emerald play FAB "Défilement auto" + "Accord courant · Sol"; font‑size `A−` / `A+` buttons.
- Nav: **Plus** active (Chansonnier lives under Plus).

### E. Accordeur — maps to `Tuner.tsx` + `pitch.ts`
**3b (Android).** Purpose: mic tuner.
- App bar subtitle "Accordeur · Standard" + "Micro actif" pill (pulsing emerald dot).
- Big note **La** (92px emerald), "Corde 5 · La", "A2 · 110.3 Hz" (mono), "Juste" pill (emerald, check).
- **Cents meter:** horizontal track with centre emerald zone, tick marks at −50/−25/0/+25/+50, a glowing
  emerald needle dot near centre; labels "−50 · 0 cents · +50". (Drive from `detectPitch` → cents offset;
  turn the needle red/rose when out of tune, emerald when within ±5 cents.)
- String selector: six circles **Mi La Ré Sol Si Mi**; current (La) emerald‑filled, others glass.
- Live mic waveform: row of emerald vertical bars.
- Nav: **Accordeur** active.

### F. Métronome — maps to `Metronome.tsx`
**3c (Android).** Purpose: tempo.
- Beat indicators: 4 dots, beat 1 accented emerald + glow, rest faint.
- Big **92** (108px) + "BPM · Modéré" (emerald, tracked).
- Tempo control: `−` / slider (emerald fill + knob at 46%) / `+`.
- Time signature chips: 3/4 · **4/4** (emerald active) · 6/8.
- Big emerald "Démarrer" button (play icon).
- Nav: **Plus** active.

### G. Partition / Chord sheet — maps to `ChordSheet.tsx`
Not separately mocked (it's the printable sheet). Keep its existing behaviour; restyle to the tokens
above and reach it via the Accords "Ajouter à la partition" flow and a Plus entry.

---

## Interactions & Behaviour
Reuse the existing handlers in `App.tsx` — the redesign changes presentation, not logic:
- Fretboard edits → `handleFretboardChange` (plays the note, updates `strings`). Strum → `strumChord`.
- Piano key toggle → `handleTogglePianoNote`; play chord → `playPianoChord`.
- Detection is live via `detectGuitarChord` / `detectChordFromMidis`; alternates via `selectedChordIdx`.
- Guitar↔piano **sync** is the two `useEffect`s already in `App.tsx` — surface it with the "SYNCHRONISÉ" chip.
- "Ajouter à la partition" → `handleAddChord`; "Créer une suite" → `handleFindProgression`;
  "Gammes pour improviser" → `handleFindScales`.
- Tuning/Capo → `setTuningId` / `setCapo`; root highlight → `showRootNote`.
- Progressions play/add → `ChordProgressions` `onPlayChord` / `onAddProgressionToSheet`.
- Audio: `initAudio` on first user gesture, then `getGuitar()/getPiano()` (smplr) — unchanged.

**Transitions:** tab changes cross‑fade content (150–200ms). Active states use the emerald tint. Buttons:
`:active` scale ~0.98 + slightly deeper emerald. Pulsing "live" dots use a 1.6–1.8s opacity keyframe
(`1 → .45 → 1`). Keep the existing fret‑vibrate animation on strum.

## State management
No new global state is required beyond what `App.tsx` already holds:
`appPage` (now the active bottom tab), `inputMode` (Guitare/Piano/Accord segmented), `strings`,
`activeMidiNotes`, `selectedChordIdx`, `tuningId`, `capo`, `showRootNote`, `savedChords` (localStorage),
plus a new `lang: 'fr' | 'en'` for the FR/EN toggle (persist to localStorage; wrap copy in a small i18n
map). "Plus" needs a simple overflow route/state for Chansonnier / Métronome / Réglages.

## Responsive behaviour
Design width is a 320px phone screen (content column ~288px). Use a single fluid column; the bottom nav
is fixed. Instruments scroll horizontally when wider than the viewport (your `Fretboard` already does).
Honour `env(safe-area-inset-*)` (already in `index.css`) for notch/home‑indicator and the bottom nav.
Above ~768px you can keep the current desktop two‑column layout; below, switch to this mobile shell.

## Assets
- **Fonts:** Outfit + JetBrains Mono (Google Fonts). The current app already loads Outfit; add JetBrains
  Mono for readouts.
- **Icons:** simple line icons (chord grid, layers, waveform, tuner gauge, three dots, play, loop, plus,
  sync, sliders, chevrons) — the mocks use inline SVG paths; in the app use your `lucide-react` set
  (Search→chords, Layers, AudioLines, Mic, Timer, BookOpen, Plus, Volume2, RotateCcw, RefreshCw, etc.,
  already imported in `App.tsx`). No raster assets.
- **Instrument art** (fretboard/piano/diagram) is generated by your existing components — no image assets.

## Files
- `FRETBYWOOD Mobile.html` — **viewable** prototype of all 10 screens (open in a browser; needs network
  for fonts). Primary visual reference.
- `FRETBYWOOD Mobile.dc.html` — same markup in authoring format.
- Existing repo files to reuse (do not rewrite the logic): `src/App.tsx`, `src/components/{Fretboard,
  ChordDiagram,PianoKeyboard,PianoDiagram,ChordGenerator,ChordProgressions,ScaleExplorer,Songbook,Tuner,
  Metronome,ChordSheet}.tsx`, `src/utils/{music,pitch,audio,chordpro}.ts`, `src/index.css` (extend the
  Tailwind theme with the hexes above).

## Suggested implementation order
1. Extend Tailwind theme with the token hexes + JetBrains Mono; set app bg `#0A0C0B` + glows.
2. Build the **mobile shell**: bottom `TabBar`, top `AppBar` with FR/EN toggle, `lang` i18n map.
3. **Accords (1c)** — restyle `Fretboard` + `PianoKeyboard` to the palette, add the sync chip and FAB.
4. **Suites**, **Gammes** — restyle `ChordProgressions`, `ScaleExplorer`.
5. **Plus** overflow → **Chansonnier** (`Songbook`), **Accordeur** (`Tuner`), **Métronome** (`Metronome`).
6. QA against `FRETBYWOOD Mobile.html`, then `npm run build` → `deploy-vps.sh` (web) and
   `npx cap sync` (iOS/Android store builds).
