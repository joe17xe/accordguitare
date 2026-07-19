# Studio IA — architecture (chantier 2)

Module d'analyse musicale **100 % côté appareil** : importer/enregistrer un audio et en obtenir
une **grille d'accords synchronisée** (V1), puis — plus tard (V1.1) — une **transcription piano**
(MIDI → MusicXML → PDF).

## Principe fondateur
- **Aucun backend, aucune base serveur, aucun compte utilisateur.** Tout le traitement se fait
  dans le navigateur / la WebView Capacitor.
- Choix délibéré : l'app est une **PWA hors-ligne** empaquetée pour les stores ; l'audio **ne
  quitte jamais l'appareil** (aucune exposition RGPD, aucun coût serveur) ; pas de compte → pas
  d'obligation Apple de suppression de compte in-app.
- On **prépare** un traitement serveur futur via l'abstraction de provider, **sans l'implémenter**.

## Périmètre
- **V1 — Analyse d'accords** : tickets AG-IA-001 → 007.
- **V1.1 — Transcription piano** : tickets AG-IA-008 → 010 (embarque TensorFlow.js + `basic-pitch`,
  chargés en *lazy-load* et mis en cache par le service worker).

## Données locales (IndexedDB)
Base `fretbywood-studio`, **schéma versionné avec migration** (`src/studio/db.ts`, `DB_VERSION`).

| Store | Clé | Contenu |
|---|---|---|
| `projects` | `id` | métadonnées projet (titre, mode, statut, tonalité/BPM détectés, provider, erreur, dates) |
| `chordSegments` | `id` (index `projectId`) | segments temporels : début, fin, nom d'accord, confiance, corrigé, ordre |
| `artifacts` | `id` (index `projectId`) | artefacts de transcription (type, réf blob, méta) — V1.1 |
| `audioBlobs` | `id` (= `projectId`) | **blob audio** (jamais en localStorage) |
| `artifactBlobs` | `id` | blobs MIDI/MusicXML/PDF — V1.1 |
| `meta` | `key` | compteur d'usage, méta schéma |

Types dans `src/studio/types.ts`. Statuts projet : `draft · ready · decoding · analyzing · completed · failed`.
`navigator.storage.persist()` est demandé au chargement (persistance iOS/WKWebView).

## Traitement asynchrone
- Toute l'inférence tourne dans un **Web Worker** — l'UI ne gèle jamais.
- **Pas de faux pourcentages** : seulement la progression réelle rapportée par le worker, sinon
  un état indéterminé honnête.
- Le **décodage audio** (`AudioContext.decodeAudioData`) se fait sur le thread principal
  (indisponible en worker), puis le PCM est transféré au worker.

## Abstraction IA
```ts
interface MusicAnalysisProvider {
  analyzeChords(input: AudioBuffer, opts): Promise<ChordAnalysisResult>
  transcribePiano(input: AudioBuffer, opts): Promise<PianoTranscriptionResult>
}
```
Ordre d'implémentation : `MockMusicAnalysisProvider` (déterministe, valide les écrans) →
`LocalBrowserProvider` (traitement réel) → point d'extension `RemoteProvider` **documenté, non
implémenté**. Configuration surchargeable (`VITE_MUSIC_ANALYSIS_PROVIDER`, durée/taille max) avec
des défauts sûrs.

## Sécurité & droits
- Vérifier le **type MIME réel** (pas l'extension), la taille et la durée (max configurable).
- Confirmation explicite que l'utilisateur **détient les droits** sur l'audio analysé.
- Suppression **définitive** d'un projet = purge du projet **et de son blob**.
- Ne jamais laisser entendre que l'app autorise la diffusion de partitions d'œuvres protégées.
- Mention visible : « **Résultat généré par IA : vérifie et corrige avant diffusion.** »

## Intégration dans l'app
- Accès via le menu **« Plus »** (onglet nav) → `appPage === 'studio'` (pas de routeur ajouté ;
  on étend le mécanisme de navigation existant).
- Composants réutilisés : `ChordDiagram`/`PianoDiagram`, `Fretboard`/`PianoKeyboard`, moteur audio
  partagé (`src/utils/audio.ts`), nommage d'accords (`tonal`, `src/utils/music.ts`), i18n, tokens.

## Roadmap (1 PR par ticket → branche `studio-ia`)
| Ticket | Portée | Version |
|---|---|---|
| AG-IA-001 | Fondations : types, store IndexedDB versionné, entrée Studio IA, doc | V1 |
| AG-IA-002 | Écran Studio : liste projets, état vide, création | V1 |
| AG-IA-003 | Source audio : import + micro, validation, consentement droits | V1 |
| AG-IA-004 | `MusicAnalysisProvider` + `MockProvider` + Web Worker + états réels | V1 |
| AG-IA-005 | Lecteur synchronisé : grille, accord actif, diagrammes, transpose, gaucher/droitier | V1 |
| AG-IA-006 | Correction manuelle accords/timing, persistance, suppression définitive | V1 |
| AG-IA-007 | `LocalBrowserProvider` : détection d'accords réelle (chroma → tonal) | V1 |
| AG-IA-008 | Transcription piano via `basic-pitch` (worker) → MIDI | V1.1 |
| AG-IA-009 | Piano roll éditable + export MIDI | V1.1 |
| AG-IA-010 | MusicXML → PDF, tests, accessibilité, doc, release | V1.1 |
