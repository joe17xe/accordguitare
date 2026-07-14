import { useState, useEffect } from 'react';
import { 
  STRING_TUNINGS, 
  detectGuitarChord, 
  getNoteAtFret, 
  getScaleDegree, 
  detectChordFromMidis, 
  suggestGuitarVoicing, 
  suggestPianoVoicing 
} from './utils/music';
import type { StringState } from './utils/music';
import { Fretboard } from './components/Fretboard';
import { ChordDiagram } from './components/ChordDiagram';
import { PianoKeyboard } from './components/PianoKeyboard';
import { PianoDiagram } from './components/PianoDiagram';
import { ChordSheet } from './components/ChordSheet';
import type { SavedChord } from './components/ChordSheet';
import { ChordGenerator } from './components/ChordGenerator';
import { ChordProgressions } from './components/ChordProgressions';
import { Music, Plus, RotateCcw, Volume2, Sparkles, HelpCircle, Layers, Search } from 'lucide-react';
import { Chord } from 'tonal';
import { Soundfont } from 'smplr';

// Audio Context and Samplers Initialization
let audioCtx: AudioContext | null = null;
let acousticGuitar: Soundfont | null = null;
let acousticPiano: Soundfont | null = null;

export const initAudio = () => {
  if (!audioCtx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    audioCtx = new AC();
    acousticGuitar = new Soundfont(audioCtx, { instrument: 'acoustic_guitar_steel' });
    acousticPiano = new Soundfont(audioCtx, { instrument: 'acoustic_grand_piano' });
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
};

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
  const [appPage, setAppPage] = useState<'workspace' | 'progressions'>('workspace');
  const [progressionRoot, setProgressionRoot] = useState<string>('');
  const [inputMode, setInputMode] = useState<'guitar' | 'piano' | 'generator'>('guitar');

  // Guitar state: Index 0 = High E, Index 5 = Low E
  const [strings, setStrings] = useState<StringState[]>([0, 0, 0, 0, 0, 0]);
  const [playedString, setPlayedString] = useState<number | null>(null);

  // Piano state: active MIDI notes list
  const [activeMidiNotes, setActiveMidiNotes] = useState<number[]>([]);
  
  // Alternative chord index selection
  const [selectedChordIdx, setSelectedChordIdx] = useState<number>(0);
  
  // Partition list
  const [savedChords, setSavedChords] = useState<SavedChord[]>([]);

  // Global setting for root note highlighting
  const [showRootNote, setShowRootNote] = useState<boolean>(true);

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
      const tempDetection = detectChordFromMidis(activeMidiNotes);
      const chordName = tempDetection.chords[0];
      if (chordName) {
        const suggestedVoicing = suggestGuitarVoicing(chordName);
        setStrings(suggestedVoicing);
      } else {
        setStrings(['X', 'X', 'X', 'X', 'X', 'X']);
      }
    }
  }, [activeMidiNotes, inputMode]);

  // Perform detection on current state depending on mode
  const detection = inputMode === 'piano'
    ? detectChordFromMidis(activeMidiNotes)
    : detectGuitarChord(strings);

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
      rootNote: customRoot || detection.tonic
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
      if (acousticGuitar && audioCtx) {
        acousticGuitar.start({ note: midi, velocity: 85, duration: 2.5 });
      }
    } catch (e) {
      console.warn("AudioContext blocké ou non supporté :", e);
    }
  };

  // Strum the full chord (arpeggiated)
  const strumChord = (stringsToPlay = strings) => {
    try {
      initAudio();
      if (!acousticGuitar || !audioCtx) return;
      
      const currentTime = audioCtx.currentTime;
      const activeStringIndices = [5, 4, 3, 2, 1, 0];
      let delay = 0;
      
      activeStringIndices.forEach((stringIdx) => {
        const fret = stringsToPlay[stringIdx];
        if (fret === 'X') return;
        
        const midi = STRING_TUNINGS[stringIdx].midi + fret;
        
        // Pluck the string
        acousticGuitar!.start({ 
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
      if (acousticPiano && audioCtx) {
        acousticPiano.start({ note: midi, velocity: 80, duration: 2.0 });
      }
    } catch (e) {
      console.warn("AudioContext suspendu ou bloqué :", e);
    }
  };

  // Play the active piano chord notes simultaneously (plaqué chord)
  const playPianoChord = (midis = activeMidiNotes) => {
    try {
      initAudio();
      if (!acousticPiano || !audioCtx) return;
      
      const currentTime = audioCtx.currentTime;
      
      midis.forEach((midi, idx) => {
        acousticPiano!.start({ 
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
          playMidiNote(STRING_TUNINGS[i].midi + fret);
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

  return (
    <div className="w-full min-h-screen pb-16 px-4 md:px-8">
      {/* Header */}
      <header className="max-w-[1200px] mx-auto pt-8 pb-6 flex flex-col items-center justify-between border-b border-zinc-800/80 mb-8 gap-6 animate-fadeIn">
        <div className="flex flex-col md:flex-row items-center w-full justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/25 text-zinc-950 font-bold">
              <Music className="w-5.5 h-5.5" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-zinc-100 tracking-tight flex items-center gap-1.5 uppercase">
                FRETBYW00D <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">v1.2</span>
              </h1>
              <p className="text-xs text-zinc-400 font-medium">Assistant de composition & détecteur d'accords</p>
            </div>
          </div>

          {/* Main Navigation Tabs & Global Actions */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex bg-zinc-900/80 p-1 rounded-xl border border-zinc-800 shadow-xl backdrop-blur-md">
              <button
                onClick={() => setAppPage('workspace')}
                className={`flex items-center gap-2 py-2 px-6 rounded-lg font-bold text-sm transition-all cursor-pointer ${
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
                className={`flex items-center gap-2 py-2 px-6 rounded-lg font-bold text-sm transition-all cursor-pointer ${
                  appPage === 'progressions'
                    ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                <Layers className="w-4 h-4" />
                Suites d'Accords
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
        {appPage === 'workspace' && (
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

      {appPage === 'progressions' ? (
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
                    {STRING_TUNINGS.map((tuning, index) => {
                      const fret = strings[index];
                      const noteInfo = getNoteAtFret(index, fret);
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
                            Corde {tuning.stringNum} ({tuning.name})
                          </td>
                          <td className="py-2.5 px-3 text-zinc-500 font-medium">
                            {tuning.name}{tuning.octave}
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
    </div>
  );
}
