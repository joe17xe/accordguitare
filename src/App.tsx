import { useState, useEffect } from 'react';
import { 
  TUNING_PRESETS, 
  detectGuitarChord, 
  getNoteAtFret, 
  getScaleDegree, 
  detectChordFromMidis, 
  suggestGuitarVoicing, 
  suggestPianoVoicing 
} from './utils/music';
import { NOTE_FR, NOTE_EN } from './utils/pitch';
import type { StringState } from './utils/music';
import { Fretboard } from './components/Fretboard';
import { ChordDiagram } from './components/ChordDiagram';
import { PianoKeyboard } from './components/PianoKeyboard';
import { PianoDiagram } from './components/PianoDiagram';
import { ChordSheet } from './components/ChordSheet';
import type { SavedChord } from './components/ChordSheet';
import { ChordGenerator } from './components/ChordGenerator';
import { ChordProgressions } from './components/ChordProgressions';
import { Tuner } from './components/Tuner';
import { Metronome } from './components/Metronome';
import { ScaleExplorer } from './components/ScaleExplorer';
import { Songbook } from './components/Songbook';
import { AppBar } from './components/AppBar';
import { TabBar } from './components/TabBar';
import type { MobileTab } from './components/TabBar';
import { MoreSheet } from './components/MoreSheet';
import type { MoreDestination } from './components/MoreSheet';
import type { Lang } from './i18n';
import { t, loadLang, saveLang } from './i18n';
import { Music, Plus, RotateCcw, Volume2, Sparkles, HelpCircle, Layers, Search, Mic, Timer, AudioLines, BookOpen } from 'lucide-react';
import { Chord } from 'tonal';
import { initAudio, getAudioCtx, getGuitar, getPiano } from './utils/audio';

// Audio Context and Samplers Initialization

// Preset definitions (from String 1 [high E] to String 6 [low E])
const CHORD_PRESETS = [
  { name: 'Do majeur (C)', strings: [0, 1, 0, 2, 3, 'X'] as StringState[] },
  { name: 'Sol majeur (G)', strings: [3, 0, 0, 0, 2, 3] as StringState[] },
  { name: 'Ré majeur (D)', strings: [2, 3, 2, 0, 'X', 'X'] as StringState[] },
  { name: 'La mineur (Am)', strings: [0, 1, 2, 2, 0, 'X'] as StringState[] },
  { name: 'Mi majeur (E)', strings: [0, 0, 1, 2, 2, 0] as StringState[] },
  { name: 'Fa majeur (F - Barré)', strings: [1, 1, 2, 3, 3, 1] as StringState[] },
  { name: 'Si mineur (Bm - Barré)', strings: [2, 3, 4, 4, 2, 'X'] as StringState[] },
];

export default function App() {
  const [appPage, setAppPage] = useState<'workspace' | 'progressions' | 'tuner' | 'metronome' | 'scales' | 'songbook'>('workspace');

  // Langue de l'interface (FR par défaut, persistée) — coquille mobile bilingue
  const [lang, setLang] = useState<Lang>(() => loadLang());
  useEffect(() => { saveLang(lang); }, [lang]);

  // Menu de débordement « Plus » (mobile)
  const [moreOpen, setMoreOpen] = useState(false);

  // Tonalité + gamme suggérée envoyées vers l'explorateur de gammes
  const [scaleTarget, setScaleTarget] = useState<{ root: string; type: string } | null>(null);
  const [progressionRoot, setProgressionRoot] = useState<string>('');
  const [inputMode, setInputMode] = useState<'guitar' | 'piano' | 'generator'>('guitar');

  // Guitar state: Index 0 = High E, Index 5 = Low E
  const [strings, setStrings] = useState<StringState[]>([0, 0, 0, 0, 0, 0]);
  const [playedString, setPlayedString] = useState<number | null>(null);

  // Piano state: active MIDI notes list
  const [activeMidiNotes, setActiveMidiNotes] = useState<number[]>([]);
  
  // Alternative chord index selection
  const [selectedChordIdx, setSelectedChordIdx] = useState<number>(0);
  
  // Partition list (persistée : la partition survit au rechargement de la page)
  const [savedChords, setSavedChords] = useState<SavedChord[]>(() => {
    try {
      const raw = localStorage.getItem('fretbywood-partition-v1');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  // Global setting for root note highlighting (persisté)
  const [showRootNote, setShowRootNote] = useState<boolean>(() => {
    try {
      return localStorage.getItem('fretbywood-show-root') !== '0';
    } catch {
      return true;
    }
  });

  // Sauvegarde automatique en localStorage
  useEffect(() => {
    try {
      localStorage.setItem('fretbywood-partition-v1', JSON.stringify(savedChords));
    } catch { /* stockage indisponible : on continue sans persistance */ }
  }, [savedChords]);

  useEffect(() => {
    try {
      localStorage.setItem('fretbywood-show-root', showRootNote ? '1' : '0');
    } catch { /* stockage indisponible */ }
  }, [showRootNote]);

  // Accordage & capo (persistés)
  const [tuningId, setTuningId] = useState<string>(() => {
    try {
      return localStorage.getItem('fretbywood-tuning') || 'standard';
    } catch {
      return 'standard';
    }
  });
  const [capo, setCapo] = useState<number>(() => {
    try {
      const c = Number(localStorage.getItem('fretbywood-capo'));
      return Number.isFinite(c) ? Math.min(9, Math.max(0, c)) : 0;
    } catch {
      return 0;
    }
  });
  useEffect(() => {
    try { localStorage.setItem('fretbywood-tuning', tuningId); } catch { /* ignore */ }
  }, [tuningId]);
  useEffect(() => {
    try { localStorage.setItem('fretbywood-capo', String(capo)); } catch { /* ignore */ }
  }, [capo]);

  const tuningPreset = TUNING_PRESETS.find((t) => t.id === tuningId) || TUNING_PRESETS[0];
  const isStandardTuning = tuningPreset.id === 'standard';
  // Accordage effectif = accordage de base décalé par le capo (les frettes restent relatives au capo)
  const effectiveMidis = tuningPreset.midis.map((m) => m + capo);
  const tuningLabel = `${tuningPreset.label}${capo > 0 ? ` · Capo ${capo}` : ''}`;

  // Automatically reset selected chord index when inputs change
  useEffect(() => {
    setSelectedChordIdx(0);
  }, [strings, activeMidiNotes]);

  // Synchronize: Guitar Fretboard -> Piano Keyboard (Database/Chord-driven voicing instead of literal note-to-note)
  useEffect(() => {
    if (inputMode === 'guitar') {
      const tempDetection = detectGuitarChord(strings);
      const chordName = tempDetection.chords[0];
      if (chordName) {
        // Strip out specific modifications for cleaner tonal note list
        const cleanChord = chordName.split('(')[0].replace(/5$/, '');
        const chordNotes = Chord.get(cleanChord).notes;
        const pianoMidis = suggestPianoVoicing(chordNotes);
        setActiveMidiNotes(pianoMidis);
      } else {
        // Fallback: If no standard chord name, group unique pitches to suggest clean layout
        if (tempDetection.notesPlayed.length > 0) {
          const pianoMidis = suggestPianoVoicing(tempDetection.notesPlayed);
          setActiveMidiNotes(pianoMidis);
        } else {
          setActiveMidiNotes([]);
        }
      }
    }
  }, [strings, inputMode]);

  // Synchronize: Piano Keyboard -> Guitar Fretboard
  useEffect(() => {
    if (inputMode === 'piano') {
      // Les formes suggérées sont pensées pour l'accordage standard (capo OK)
      if (!isStandardTuning) return;
      const tempDetection = detectChordFromMidis(activeMidiNotes);
      const chordName = tempDetection.chords[0];
      if (chordName) {
        const suggestedVoicing = suggestGuitarVoicing(chordName);
        setStrings(suggestedVoicing);
      } else {
        setStrings(['X', 'X', 'X', 'X', 'X', 'X']);
      }
    }
  }, [activeMidiNotes, inputMode, isStandardTuning]);

  // Perform detection on current state depending on mode
  const detection = inputMode === 'piano'
    ? detectChordFromMidis(activeMidiNotes)
    : detectGuitarChord(strings, effectiveMidis);

  const activeChordName = detection.chords[selectedChordIdx] || '';

  // Reset active fretboard
  const handleResetFretboard = () => {
    setStrings([0, 0, 0, 0, 0, 0]);
    setActiveMidiNotes([]);
  };

  // Load a preset and map it to both instruments
  const handleLoadPreset = (presetStrings: StringState[], presetName: string) => {
    // Extract chord name (e.g. "Do majeur (C)" -> "C")
    const start = presetName.indexOf('(');
    const end = presetName.indexOf(')');
    let cleanChord = 'C';
    if (start !== -1 && end !== -1) {
      cleanChord = presetName.substring(start + 1, end).split(' - ')[0];
    }

    setStrings(presetStrings);
    
    // Map to piano keyboard
    const notes = Chord.get(cleanChord).notes;
    const pianoMidis = suggestPianoVoicing(notes);
    setActiveMidiNotes(pianoMidis);

    if (inputMode === 'piano') {
      playPianoChord(pianoMidis);
    } else {
      strumChord(presetStrings);
    }
  };

  // Select/Apply a voicing from generator
  const handleSelectVoicing = (voicing: StringState[], chordName: string) => {
    setStrings(voicing);
    const cleanChord = chordName.split('(')[0].replace(/5$/, '');
    const chordNotes = Chord.get(cleanChord).notes;
    const pianoMidis = suggestPianoVoicing(chordNotes);
    setActiveMidiNotes(pianoMidis);
  };

  // Switch to Progressions tab and pre-fill target chord
  const handleFindProgression = () => {
    const finalName = activeChordName || detection.notesPlayed.join(', ') || 'C';
    setProgressionRoot(finalName);
    setAppPage('progressions');
  };

  // Ouvre l'explorateur de gammes sur la tonalité de l'accord détecté,
  // avec une gamme adaptée à sa couleur (mineur -> penta mineure, 7 -> mixolydien…)
  const handleFindScales = () => {
    const info = Chord.get(activeChordName);
    let suggestedType = 'major';
    if (info.type.includes('dominant')) suggestedType = 'mixolydian';
    else if (info.quality === 'Minor') suggestedType = 'minor pentatonic';
    else if (info.quality === 'Diminished') suggestedType = 'locrian';
    setScaleTarget({ root: detection.tonic || 'C', type: suggestedType });
    setAppPage('scales');
  };

  // Add the current chord to the sheet partition
  const handleAddChord = (customStrings?: StringState[], customMidis?: number[], customName?: string, customRoot?: string) => {
    const finalStrings = Array.isArray(customStrings) ? customStrings : strings;
    const finalMidis = Array.isArray(customMidis) ? customMidis : activeMidiNotes;
    
    let finalName = '';
    if (typeof customName === 'string') {
      finalName = customName;
    } else {
      finalName = activeChordName || detection.notesPlayed.join(', ') || 'Accord';
    }

    const newChord: SavedChord = {
      id: Date.now().toString(),
      type: 'chord',
      name: finalName,
      strings: [...finalStrings],
      pianoNotes: [...finalMidis],
      rootNote: customRoot || detection.tonic,
      tuningMidis: [...effectiveMidis],
      tuningLabel: isStandardTuning && capo === 0 ? undefined : tuningLabel
    };
    setSavedChords((prev) => [...prev, newChord]);
  };

  // Add text section to the sheet
  const handleAddTextSection = (text: string) => {
    const newItem: SavedChord = {
      id: Date.now().toString(),
      type: 'text',
      name: text,
      strings: [],
      pianoNotes: []
    };
    setSavedChords((prev) => [...prev, newItem]);
  };

  // Move item left or right
  const handleMoveChord = (id: string, direction: 'left' | 'right') => {
    setSavedChords((prev) => {
      const idx = prev.findIndex(c => c.id === id);
      if (idx === -1) return prev;
      
      const newArr = [...prev];
      if (direction === 'left' && idx > 0) {
        [newArr[idx - 1], newArr[idx]] = [newArr[idx], newArr[idx - 1]];
      } else if (direction === 'right' && idx < prev.length - 1) {
        [newArr[idx], newArr[idx + 1]] = [newArr[idx + 1], newArr[idx]];
      }
      return newArr;
    });
  };

  // Resize text section
  const handleChangeTextSize = (id: string, delta: number) => {
    setSavedChords((prev) => prev.map(c => {
      if (c.id === id && c.type === 'text') {
        const currentSize = c.textSize || 15;
        const newSize = Math.max(8, Math.min(48, currentSize + delta));
        return { ...c, textSize: newSize };
      }
      return c;
    }));
  };

  // Delete chord from list
  const handleDeleteChord = (id: string) => {
    setSavedChords((prev) => prev.filter((c) => c.id !== id));
  };

  // Clear partition list
  const handleClearSheet = () => {
    if (window.confirm("Voulez-vous vraiment vider toute votre partition ?")) {
      setSavedChords([]);
    }
  };

  // Play a single note using smplr acoustic guitar
  const playMidiNote = (midi: number) => {
    try {
      initAudio();
      getGuitar()?.start({ note: midi, velocity: 85, duration: 2.5 });
    } catch (e) {
      console.warn("AudioContext blocké ou non supporté :", e);
    }
  };

  // Strum the full chord (arpeggiated)
  const strumChord = (stringsToPlay = strings) => {
    try {
      initAudio();
      const guitar = getGuitar();
      const ctx = getAudioCtx();
      if (!guitar || !ctx) return;
      
      const currentTime = ctx.currentTime;
      const activeStringIndices = [5, 4, 3, 2, 1, 0];
      let delay = 0;
      
      activeStringIndices.forEach((stringIdx) => {
        const fret = stringsToPlay[stringIdx];
        if (fret === 'X') return;
        
        const midi = effectiveMidis[stringIdx] + fret;
        
        // Pluck the string
        guitar.start({ 
          note: midi, 
          velocity: 80 + Math.random() * 15, 
          time: currentTime + delay, 
          duration: 3.0 
        });
        
        // Schedule visual string vibration
        setTimeout(() => {
          setPlayedString(stringIdx);
          setTimeout(() => setPlayedString(null), 200);
        }, delay * 1000);
        
        delay += 0.045; // 45ms spread between strings
      });
    } catch (e) {
      console.warn("AudioContext blocké ou non supporté :", e);
    }
  };

  // Play a single piano note using smplr acoustic piano
  const playPianoNote = (midi: number) => {
    try {
      initAudio();
      getPiano()?.start({ note: midi, velocity: 80, duration: 2.0 });
    } catch (e) {
      console.warn("AudioContext suspendu ou bloqué :", e);
    }
  };

  // Play the active piano chord notes simultaneously (plaqué chord)
  const playPianoChord = (midis = activeMidiNotes) => {
    try {
      initAudio();
      const piano = getPiano();
      const ctx = getAudioCtx();
      if (!piano || !ctx) return;
      
      const currentTime = ctx.currentTime;
      
      midis.forEach((midi, idx) => {
        piano.start({ 
          note: midi, 
          velocity: 75 + Math.random() * 10, 
          time: currentTime + idx * 0.008, 
          duration: 2.5 
        });
      });
    } catch (e) {
      console.warn("AudioContext suspendu ou bloqué :", e);
    }
  };

  // Toggle single key note clicked on keyboard
  const handleTogglePianoNote = (midi: number) => {
    if (activeMidiNotes.includes(midi)) {
      setActiveMidiNotes(activeMidiNotes.filter((n) => n !== midi));
    } else {
      setActiveMidiNotes([...activeMidiNotes, midi]);
      playPianoNote(midi);
    }
  };

  // Play single note if user modifies a single string (handled inside Fretboard callback if needed)
  const handleFretboardChange = (newStrings: StringState[]) => {
    // Find which string changed and play its note
    for (let i = 0; i < 6; i++) {
      if (newStrings[i] !== strings[i]) {
        const fret = newStrings[i];
        if (fret !== 'X') {
          playMidiNote(effectiveMidis[i] + fret);
          setPlayedString(i);
          setTimeout(() => setPlayedString(null), 200);
        }
        break;
      }
    }
    setStrings(newStrings);
  };

  // Add an entire progression to the sheet
  const handleAddProgression = (chords: string[]) => {
    const newSavedChords: SavedChord[] = chords.map((chordName, idx) => {
      const cleanChord = chordName.split('(')[0].replace(/5$/, '');
      const notes = Chord.get(cleanChord).notes;
      const midis = suggestPianoVoicing(notes);
      const voicing = suggestGuitarVoicing(cleanChord);
      const tonic = Chord.get(cleanChord).tonic || '';
      
      return {
        id: Date.now().toString() + '-' + idx,
        type: 'chord',
        name: chordName,
        strings: [...voicing],
        pianoNotes: [...midis],
        rootNote: tonic
      };
    });
    setSavedChords((prev) => [...prev, ...newSavedChords]);
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    setAppPage('workspace');
  };

  // --- Coquille mobile : correspondance page <-> onglet de nav basse ---
  const PAGE_TO_TAB: Record<typeof appPage, MobileTab> = {
    workspace: 'chords',
    progressions: 'progressions',
    scales: 'scales',
    tuner: 'tuner',
    songbook: 'more',
    metronome: 'more',
  };
  const activeTab = PAGE_TO_TAB[appPage];
  const appBarSubtitle = t(lang, `app.subtitle.${appPage === 'workspace' ? 'chords' : appPage}`);

  const handleSelectTab = (tab: MobileTab) => {
    if (tab === 'more') { setMoreOpen(true); return; }
    setMoreOpen(false);
    if (tab === 'chords') setAppPage('workspace');
    else if (tab === 'progressions') setAppPage('progressions');
    else if (tab === 'scales') setAppPage('scales');
    else if (tab === 'tuner') setAppPage('tuner');
  };

  const handleSelectMore = (dest: MoreDestination) => {
    setAppPage(dest);
    setMoreOpen(false);
  };

  return (
    <div className="w-full min-h-screen px-4 md:px-8 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-16">
      {/* Coquille mobile : barre d'application (< 768px) */}
      <AppBar
        className="md:hidden"
        lang={lang}
        subtitle={appBarSubtitle}
        onChangeLang={setLang}
      />

      {/* Header (desktop, >= 768px) */}
      <header className="hidden md:flex max-w-[1200px] mx-auto pt-8 pb-6 flex-col items-center justify-between border-b border-zinc-800/80 mb-8 gap-6 animate-fadeIn">
        <div className="flex flex-col md:flex-row items-center w-full justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/25 text-zinc-950 font-bold">
              <Music className="w-5.5 h-5.5" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-zinc-100 tracking-tight flex items-center gap-1.5 uppercase">
                FRETBYW00D <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">v1.9</span>
              </h1>
              <p className="text-xs text-zinc-400 font-medium">Assistant de composition & détecteur d'accords</p>
            </div>
          </div>

          {/* Main Navigation Tabs & Global Actions */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex flex-wrap justify-center bg-zinc-900/80 p-1 rounded-xl border border-zinc-800 shadow-xl backdrop-blur-md">
              <button
                onClick={() => setAppPage('workspace')}
                className={`flex items-center gap-2 py-2 px-4 rounded-lg font-bold text-sm transition-all cursor-pointer ${
                  appPage === 'workspace'
                    ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                <Search className="w-4 h-4" />
                Outils d'Accords
              </button>
              <button
                onClick={() => setAppPage('progressions')}
                className={`flex items-center gap-2 py-2 px-4 rounded-lg font-bold text-sm transition-all cursor-pointer ${
                  appPage === 'progressions'
                    ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                <Layers className="w-4 h-4" />
                Suites d'Accords
              </button>
              <button
                onClick={() => setAppPage('scales')}
                className={`flex items-center gap-2 py-2 px-4 rounded-lg font-bold text-sm transition-all cursor-pointer ${
                  appPage === 'scales'
                    ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                <AudioLines className="w-4 h-4" />
                Gammes
              </button>
              <button
                onClick={() => setAppPage('songbook')}
                className={`flex items-center gap-2 py-2 px-4 rounded-lg font-bold text-sm transition-all cursor-pointer ${
                  appPage === 'songbook'
                    ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                Chansonnier
              </button>
              <button
                onClick={() => setAppPage('tuner')}
                className={`flex items-center gap-2 py-2 px-4 rounded-lg font-bold text-sm transition-all cursor-pointer ${
                  appPage === 'tuner'
                    ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                <Mic className="w-4 h-4" />
                Accordeur
              </button>
              <button
                onClick={() => setAppPage('metronome')}
                className={`flex items-center gap-2 py-2 px-4 rounded-lg font-bold text-sm transition-all cursor-pointer ${
                  appPage === 'metronome'
                    ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                <Timer className="w-4 h-4" />
                Métronome
              </button>
            </div>

            <button
              onClick={() => setShowRootNote(!showRootNote)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                showRootNote 
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/50 shadow-md shadow-rose-500/10' 
                  : 'bg-zinc-900/60 text-zinc-500 border-zinc-800 hover:text-zinc-300'
              }`}
            >
              <div className={`w-2.5 h-2.5 rounded-full ${showRootNote ? 'bg-rose-500' : 'bg-zinc-600'}`}></div>
              Tonique en rouge
            </button>
          </div>
        </div>

        {/* Presets List (only in workspace) */}
        {appPage === 'workspace' && isStandardTuning && (
          <div className="flex flex-wrap items-center gap-1.5 justify-center w-full">
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mr-1.5">Favoris :</span>
            {CHORD_PRESETS.map((preset, idx) => (
              <button
                key={idx}
                onClick={() => handleLoadPreset(preset.strings, preset.name)}
                className="py-1 px-2.5 rounded-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800 text-xs font-semibold text-zinc-300 transition cursor-pointer hover:scale-105"
              >
                {preset.name.split(' ')[0]}
              </button>
            ))}
          </div>
        )}
      </header>

      {appPage === 'tuner' ? (
        <Tuner tuningMidis={tuningPreset.midis} tuningLabel={tuningPreset.label} />
      ) : appPage === 'metronome' ? (
        <Metronome />
      ) : appPage === 'songbook' ? (
        <Songbook />
      ) : appPage === 'scales' ? (
        <ScaleExplorer
          initialRoot={scaleTarget?.root}
          initialType={scaleTarget?.type}
          onPlayNote={playMidiNote}
          tuningMidis={effectiveMidis}
          tuningLabel={tuningLabel}
        />
      ) : appPage === 'progressions' ? (
        <ChordProgressions 
          initialChord={progressionRoot} 
          onPlayChord={(chord) => {
            const midis = suggestPianoVoicing(Chord.get(chord).notes);
            playPianoChord(midis);
          }}
          onAddProgressionToSheet={handleAddProgression}
        />
      ) : (
        <>
          {/* Main Workspace Layout */}
          <main className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-8 w-full">
        
        {/* Left Area: Instrument & Educational Grid */}
        <div className="flex flex-col gap-6 min-w-0">
          
          {/* Instrument selection tabs */}
          <div className="flex gap-2 bg-zinc-900/60 p-1.5 rounded-2xl border border-zinc-850 backdrop-blur-md">
            <button
              onClick={() => setInputMode('guitar')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-extrabold text-sm transition-all duration-200 cursor-pointer ${
                inputMode === 'guitar' 
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-zinc-950 shadow-lg shadow-emerald-500/15' 
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30'
              }`}
            >
              🎸 Manche Guitare
            </button>
            <button
              onClick={() => setInputMode('piano')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-extrabold text-sm transition-all duration-200 cursor-pointer ${
                inputMode === 'piano' 
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-zinc-950 shadow-lg shadow-emerald-500/15' 
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30'
              }`}
            >
              🎹 Clavier Piano
            </button>
            <button
              onClick={() => setInputMode('generator')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-extrabold text-sm transition-all duration-200 cursor-pointer ${
                inputMode === 'generator' 
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-zinc-950 shadow-lg shadow-emerald-500/15' 
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30'
              }`}
            >
              🔍 Choisir un Accord
            </button>
          </div>

          {/* Accordage & Capo */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5 rounded-xl bg-zinc-900/60 border border-zinc-850 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Accordage</span>
              <select
                value={tuningId}
                onChange={(e) => setTuningId(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs font-bold text-zinc-200 cursor-pointer focus:outline-none focus:border-emerald-500/60"
              >
                {TUNING_PRESETS.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Capo</span>
              <button
                onClick={() => setCapo((c) => Math.max(0, c - 1))}
                className="w-6 h-6 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 font-bold text-sm hover:bg-zinc-700 transition cursor-pointer"
              >
                −
              </button>
              <span className={`w-5 text-center text-sm font-extrabold ${capo > 0 ? 'text-emerald-400' : 'text-zinc-400'}`}>{capo}</span>
              <button
                onClick={() => setCapo((c) => Math.min(9, c + 1))}
                className="w-6 h-6 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 font-bold text-sm hover:bg-zinc-700 transition cursor-pointer"
              >
                +
              </button>
            </div>
            <span className="text-xs font-semibold text-zinc-500" title="Cordes 6 à 1 (capo inclus)">
              {effectiveMidis.slice().reverse().map((m) => NOTE_FR[m % 12]).join(' · ')}
            </span>
          </div>

          {/* Instrument Card */}
          {inputMode === 'guitar' ? (
            <div className="p-6 rounded-2xl glass-panel animate-fadeIn">
              <div className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 block animate-pulse"></span>
                  <h2 className="text-lg font-bold text-zinc-100">Manche de Guitare Interactif</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => strumChord()}
                    className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-zinc-855 hover:bg-zinc-800 text-zinc-300 hover:text-emerald-450 border border-zinc-800 text-xs font-bold transition cursor-pointer"
                    title="Jouer toutes les cordes"
                  >
                    <Volume2 className="w-4 h-4" />
                    Gratter
                  </button>
                  <button
                    onClick={handleResetFretboard}
                    className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-zinc-855 hover:bg-zinc-800 text-zinc-300 hover:text-rose-450 border border-zinc-800 text-xs font-bold transition cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Réinitialiser
                  </button>
                </div>
              </div>

              {/* Fretboard component */}
              <Fretboard 
                strings={strings} 
                onChange={handleFretboardChange} 
                playedString={playedString} 
                showRootNote={showRootNote}
                rootNote={detection.tonic}
                tuningMidis={effectiveMidis}
              />
            </div>
          ) : inputMode === 'piano' ? (
            <div className="p-6 rounded-2xl glass-panel animate-fadeIn">
              <div className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 block animate-pulse"></span>
                  <h2 className="text-lg font-bold text-zinc-100">Clavier de Piano Interactif</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => playPianoChord()}
                    className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-zinc-855 hover:bg-zinc-800 text-zinc-300 hover:text-emerald-455 border border-zinc-800 text-xs font-bold transition cursor-pointer"
                    title="Jouer l'accord au piano"
                  >
                    <Volume2 className="w-4 h-4" />
                    Jouer
                  </button>
                  <button
                    onClick={() => setActiveMidiNotes([])}
                    className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-zinc-855 hover:bg-zinc-800 text-zinc-300 hover:text-rose-455 border border-zinc-800 text-xs font-bold transition cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Réinitialiser
                  </button>
                </div>
              </div>

              {/* Piano Keyboard Component */}
              <PianoKeyboard 
                activeNotes={activeMidiNotes} 
                onToggleNote={handleTogglePianoNote} 
              />
            </div>
          ) : !isStandardTuning ? (
            <div className="p-6 rounded-2xl glass-panel animate-fadeIn text-center">
              <p className="text-sm text-amber-400 font-semibold">
                Le générateur propose des positions pensées pour l'accordage standard.
              </p>
              <p className="text-xs text-zinc-500 mt-1.5">
                Repassez en Standard pour l'utiliser — le capo, lui, reste compatible. La
                génération multi-accordages viendra dans une prochaine version.
              </p>
            </div>
          ) : (
            <ChordGenerator
              onSelectVoicing={handleSelectVoicing}
              onPlayVoicing={(voicing) => strumChord(voicing)}
              onAddChord={(voicing, name, root) => {
                const cleanChord = name.split('(')[0].replace(/5$/, '');
                const notes = Chord.get(cleanChord).notes;
                const pianoMidis = suggestPianoVoicing(notes);
                handleAddChord(voicing, pianoMidis, name, root);
              }}
              currentStrings={strings}
              showRootNote={showRootNote}
            />
          )}

          {/* Education Details Panel (Scale degrees, notes) */}
          {detection.notesPlayed.length > 0 && (
            <div className="p-6 rounded-2xl glass-panel">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-emerald-400" />
                Structure Harmonique {inputMode === 'piano' ? 'du Clavier' : 'du Manche'}
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-500 font-bold uppercase">
                      <th className="py-2.5 px-3">Corde / Voie</th>
                      <th className="py-2.5 px-3">Note de Base</th>
                      <th className="py-2.5 px-3 text-center">{inputMode === 'piano' ? 'Position' : 'Frette'}</th>
                      <th className="py-2.5 px-3 text-emerald-400">Note Jouée</th>
                      <th className="py-2.5 px-3 text-emerald-400 text-center">Degré</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {effectiveMidis.map((midi, index) => {
                      const fret = strings[index];
                      const noteInfo = getNoteAtFret(index, fret, effectiveMidis);
                      const isMuted = fret === 'X';
                      
                      const degree = noteInfo && activeChordName 
                        ? getScaleDegree(noteInfo.pc, detection.tonic)
                        : '';

                      return (
                        <tr 
                          key={index} 
                          className={`hover:bg-zinc-900/40 transition ${isMuted ? 'opacity-40' : ''}`}
                        >
                          <td className="py-2.5 px-3 font-extrabold text-zinc-400">
                            Corde {index + 1} ({NOTE_EN[midi % 12]})
                          </td>
                          <td className="py-2.5 px-3 text-zinc-500 font-medium">
                            {NOTE_EN[midi % 12]}{Math.floor(midi / 12) - 1}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold">
                            {isMuted ? (
                              <span className="text-rose-500">X</span>
                            ) : (
                              <span className="text-emerald-500">{fret}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-extrabold">
                            {isMuted ? (
                              <span className="text-zinc-600 font-normal">Étouffée</span>
                            ) : (
                              <span className="text-emerald-400">{noteInfo?.name}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold">
                            {isMuted ? (
                              <span className="text-zinc-600">-</span>
                            ) : (
                              <span className="text-emerald-400 text-sm font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                                {degree || 'R'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right Area: Detection Engine Display & SVG diagram */}
        <div className="flex flex-col gap-6">
          {/* Chord Recognition Panel */}
          <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex flex-col justify-between h-full min-h-[380px]">
            <div>
              <div className="flex items-center gap-1.5 text-zinc-400 font-bold text-xs uppercase tracking-wider mb-4">
                <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                Moteur Harmonique
              </div>

              {/* Main Chord Result */}
              <div className="my-2">
                {detection.chords.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    <span className="text-4xl font-extrabold text-emerald-400 tracking-tight drop-shadow-md select-text">
                      {activeChordName}
                    </span>
                    <span className="text-xs font-semibold text-zinc-400">
                      Basse : <strong className="text-zinc-300">{detection.bassNote}</strong> | Tonique : <strong className="text-zinc-300">{detection.tonic}</strong>
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <span className="text-2xl font-bold text-zinc-400 tracking-tight">
                      {detection.notesPlayed.length > 0 ? 'Accord complexe' : 'Pas de notes'}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {detection.notesPlayed.length > 0 
                        ? 'Ajoutez plus de notes pour identifier l\'accord.'
                        : 'Cliquez sur le manche ou sur les touches du piano.'}
                    </span>
                  </div>
                )}
              </div>

              {/* Notes Played Display */}
              {detection.notesPlayed.length > 0 && (
                <div className="mt-4 pt-4 border-t border-zinc-850">
                  <div className="text-zinc-500 text-[10px] font-bold uppercase mb-2">Notes actives</div>
                  <div className="flex flex-wrap gap-1.5">
                    {detection.notesPlayed.map((note, idx) => (
                      <span
                        key={idx}
                        className="py-1 px-2.5 rounded-lg bg-zinc-950 text-emerald-400 border border-zinc-800 text-xs font-bold animate-fadeIn"
                      >
                        {note}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Alternatives List */}
              {detection.chords.length > 1 && (
                <div className="mt-4 pt-4 border-t border-zinc-850">
                  <div className="text-zinc-500 text-[10px] font-bold uppercase mb-2">Interprétations alternatives</div>
                  <div className="flex flex-wrap gap-1.5">
                    {detection.chords.map((chord, idx) => {
                      const isSelected = idx === selectedChordIdx;
                      return (
                        <button
                          key={idx}
                          onClick={() => setSelectedChordIdx(idx)}
                          className={`
                            py-1 px-2 text-xs font-bold rounded transition cursor-pointer
                            ${isSelected 
                              ? 'bg-emerald-500 text-zinc-950 shadow-md' 
                              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                            }
                          `}
                        >
                          {chord}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Current State Vector Diagram Display (matches active tab format) */}
            <div className="mt-6 flex flex-col items-center gap-4">
              {inputMode === 'piano' ? (
                <PianoDiagram 
                  notes={activeMidiNotes} 
                  lightMode={false}
                />
              ) : (
                <ChordDiagram 
                  strings={strings} 
                  name={activeChordName || (detection.notesPlayed.length > 0 ? 'Custom' : '')} 
                  lightMode={false}
                  tuningMidis={effectiveMidis}
                />
              )}

              <button
                onClick={() => handleAddChord()}
                disabled={detection.notesPlayed.length === 0}
                className="w-full py-3 px-4 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed
                  bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-zinc-950 hover:scale-102"
              >
                <Plus className="w-5 h-5 stroke-[2.5]" />
                Ajouter à la partition
              </button>

              <button
                onClick={handleFindProgression}
                disabled={detection.chords.length === 0}
                className="w-full py-3 px-4 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed
                  bg-zinc-800 hover:bg-zinc-700 text-emerald-400 border border-emerald-500/20 hover:border-emerald-500/50 hover:scale-102"
              >
                <Layers className="w-5 h-5 stroke-[2.5]" />
                Créer une suite avec cet accord
              </button>

              <button
                onClick={handleFindScales}
                disabled={detection.chords.length === 0}
                className="w-full py-3 px-4 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed
                  bg-zinc-800 hover:bg-zinc-700 text-emerald-400 border border-emerald-500/20 hover:border-emerald-500/50 hover:scale-102"
              >
                <AudioLines className="w-5 h-5 stroke-[2.5]" />
                Gammes pour improviser dessus
              </button>
            </div>
          </div>
        </div>

      </main>

      {/* Printable / Editable Partition Sheet */}
      <section className="max-w-[1200px] mx-auto mt-12 animate-fadeIn">
        <ChordSheet 
          savedChords={savedChords} 
          onDeleteChord={handleDeleteChord} 
          onClearSheet={handleClearSheet} 
          onMoveChord={handleMoveChord}
          onAddTextSection={handleAddTextSection}
          onChangeTextSize={handleChangeTextSize}
          showRootNote={showRootNote}
        />
      </section>
      </>
      )}

      {/* Coquille mobile : menu « Plus » + nav basse fixe (< 768px) */}
      {moreOpen && (
        <MoreSheet
          lang={lang}
          onSelect={handleSelectMore}
          onClose={() => setMoreOpen(false)}
        />
      )}
      <TabBar
        className="md:hidden"
        active={activeTab}
        lang={lang}
        onSelect={handleSelectTab}
      />
    </div>
  );
}
