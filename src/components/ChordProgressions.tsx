import React, { useState, useEffect } from 'react';
import { Play, Plus, ChevronRight, X, Layers, Settings2, CheckCircle2, Repeat } from 'lucide-react';
import { ProgressionPlayer } from './ProgressionPlayer';
import { QualityPicker } from './QualityPicker';
import { Chord, Progression, RomanNumeral, Note, Interval } from 'tonal';
import { PROGRESSION_PRESETS, STYLES } from '../data/progressions';
import type { StyleId } from '../data/progressions';

interface ChordProgressionsProps {
  initialChord: string;
  onPlayChord: (chordName: string) => void;
  onAddProgressionToSheet: (chords: string[]) => void;
}

type ScaleMode = 'Majeur' | 'Mineur' | 'Jazz Majeur' | 'Jazz Mineur' | 'Dominant' | 'Suspendu' | 'Diminué' | 'Augmenté';

const ROOTS = [
  { pc: 'C', label: 'Do (C)' }, { pc: 'C#', label: 'Do# (C#)' }, { pc: 'D', label: 'Ré (D)' },
  { pc: 'D#', label: 'Ré# (D#)' }, { pc: 'E', label: 'Mi (E)' }, { pc: 'F', label: 'Fa (F)' },
  { pc: 'F#', label: 'Fa# (F#)' }, { pc: 'G', label: 'Sol (G)' }, { pc: 'G#', label: 'Sol# (G#)' },
  { pc: 'A', label: 'La (A)' }, { pc: 'A#', label: 'La# (A#)' }, { pc: 'B', label: 'Si (B)' },
];

// Orthographe enharmonique lisible : Db (5 bémols) plutôt que C# (7 dièses)…
// Un musicien n'écrit jamais E#m7 ou B#m7b5.
const SPELL_MAJ: Record<string, string> = { 'C#': 'Db', 'D#': 'Eb', 'G#': 'Ab', 'A#': 'Bb' };
const SPELL_MIN: Record<string, string> = { 'D#': 'Eb', 'A#': 'Bb' };

// Fondamentales théoriques mais imprononçables → équivalent courant (usage tablatures)
const READABLE: Record<string, string> = { 'E#': 'F', 'B#': 'C', 'Cb': 'B', 'Fb': 'E' };
function readableChord(name: string): string {
  const tonic = Chord.get(name).tonic;
  if (!tonic) return name;
  const pc = Note.get(tonic).pc;
  const better =
    READABLE[pc] ?? (pc.includes('##') || pc.includes('bb') ? Note.enharmonic(pc) : undefined);
  return better ? better + name.slice(tonic.length) : name;
}

// Diatonic scales definitions
const DIATONIC_DEGREES = {
  'Majeur': {
    simple: ['I', 'IIm', 'IIIm', 'IV', 'V', 'VIm', 'VIIdim'],
    enriched: ['Imaj7', 'IIm7', 'IIIm7', 'IVmaj7', 'V7', 'VIm7', 'VIIm7b5']
  },
  'Mineur': {
    simple: ['Im', 'IIdim', 'bIII', 'IVm', 'Vm', 'bVI', 'bVII'],
    enriched: ['Im7', 'IIm7b5', 'bIIImaj7', 'IVm7', 'Vm7', 'bVImaj7', 'bVII7']
  }
};

export const ChordProgressions: React.FC<ChordProgressionsProps> = ({ 
  initialChord, 
  onPlayChord, 
  onAddProgressionToSheet 
}) => {
  // Advanced pivot chord state
  const [activeRoot, setActiveRoot] = useState<string>('C');
  const [activeSuffix, setActiveSuffix] = useState<string>('');
  const activeChordName = `${activeRoot}${activeSuffix}`;
  
  const [scaleType, setScaleType] = useState<ScaleMode>('Majeur');
  
  // New Toggles & Filters
  const [isEnriched, setIsEnriched] = useState<boolean>(true);
  const [lengthFilter, setLengthFilter] = useState<'Toutes' | '3' | '4' | '5-6' | '7+'>('Toutes');
  const [styleFilter, setStyleFilter] = useState<'Tous' | StyleId>('Tous');
  const [customProgression, setCustomProgression] = useState<string[]>([]);
  const [isEditingTonic, setIsEditingTonic] = useState<boolean>(false);

  // Boucle d'entraînement (lecteur avec tempo)
  const [looper, setLooper] = useState<{ title: string; chords: string[] } | null>(null);

  // Sequencer Logic
  const [isPlayingSeq, setIsPlayingSeq] = useState<boolean>(false);
  const isPlayingRef = React.useRef(false);

  useEffect(() => {
    return () => { isPlayingRef.current = false; };
  }, []);

  const handlePlaySequence = async (chords: string[]) => {
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;
    setIsPlayingSeq(true);
    for (let i = 0; i < chords.length; i++) {
      if (!isPlayingRef.current) break;
      onPlayChord(chords[i]);
      // small delay to let the previous chord ring out and simulate a measure
      await new Promise(r => setTimeout(r, 1400));
    }
    isPlayingRef.current = false;
    setIsPlayingSeq(false);
  };

  // Sync with initial chord prop ONLY on mount or when it changes from outside
  useEffect(() => {
    if (initialChord) {
      const cleanChord = initialChord.split('(')[0].replace(/5$/, '');
      const parsed = Chord.get(cleanChord);
      if (parsed && parsed.tonic) {
        setActiveRoot(parsed.tonic);
        // Find the suffix by removing the tonic from the chord name
        const suffix = cleanChord.slice(parsed.tonic.length);
        setActiveSuffix(suffix);
      }
    }
  }, [initialChord]);

  // Recalculate mode when the custom active chord changes
  useEffect(() => {
    const parsed = Chord.get(activeChordName);
    if (parsed && parsed.tonic) {
      const aliases = parsed.aliases;
      const q = parsed.quality;

      if (aliases.includes('maj7') || aliases.includes('maj9') || aliases.includes('6') || aliases.includes('add9')) {
        setScaleType('Jazz Majeur');
      } else if (aliases.includes('m7') || aliases.includes('m9') || aliases.includes('m11') || aliases.includes('m6')) {
        setScaleType('Jazz Mineur');
      } else if (aliases.includes('7') || aliases.includes('9') || aliases.includes('13')) {
        setScaleType('Dominant');
      } else if (q === 'Diminished' || aliases.includes('dim') || aliases.includes('m7b5')) {
        setScaleType('Diminué');
      } else if (q === 'Augmented' || aliases.includes('aug')) {
        setScaleType('Augmenté');
      } else if (aliases.includes('sus2') || aliases.includes('sus4') || aliases.includes('sus')) {
        setScaleType('Suspendu');
      } else if (q === 'Minor' || aliases.includes('m')) {
        setScaleType('Mineur');
      } else {
        setScaleType('Majeur');
      }
    }
  }, [activeChordName]);

  // Generate the 7 diatonic chords for the grid based on current pivot tonic
  const baseModeForGrid = (scaleType.includes('Mineur') || scaleType === 'Diminué') ? 'Mineur' : 'Majeur';

  // Un accord de dominante (C#9, G7…) est le V7 de sa tonalité : l'alphabet juste
  // est celui de la tonalité une quarte au-dessus (C#9 → F# majeur).
  const isDominantPivot = scaleType === 'Dominant';
  const alphabetRootRaw = isDominantPivot
    ? Note.simplify(Note.transpose(activeRoot, '4P')) || activeRoot
    : activeRoot;
  const alphabetRoot =
    (baseModeForGrid === 'Majeur' ? SPELL_MAJ : SPELL_MIN)[alphabetRootRaw] ?? alphabetRootRaw;

  const diatonicScaleDegrees = [...DIATONIC_DEGREES[baseModeForGrid][isEnriched ? 'enriched' : 'simple']];
  const diatonicChords = Progression.fromRomanNumerals(alphabetRoot, diatonicScaleDegrees).map(readableChord);

  // Place l'accord pivot exact sur SON degré (même fondamentale), sinon en tête
  if (!diatonicChords.includes(activeChordName)) {
    const pivotChroma = Note.chroma(activeRoot);
    let pivotIdx = diatonicChords.findIndex(
      (c) => Note.chroma(Chord.get(c).tonic ?? '') === pivotChroma
    );
    if (pivotIdx === -1) pivotIdx = 0;
    diatonicChords[pivotIdx] = activeChordName;
    diatonicScaleDegrees[pivotIdx] = `${diatonicScaleDegrees[pivotIdx]} · Pivot`;
  }

  // Filtres des suites préfabriquées (style + longueur)
  const filteredProgressions = PROGRESSION_PRESETS.filter((p) => {
    if (styleFilter !== 'Tous' && p.style !== styleFilter) return false;
    const n = p.degrees.length;
    if (lengthFilter === '3') return n === 3;
    if (lengthFilter === '4') return n === 4;
    if (lengthFilter === '5-6') return n === 5 || n === 6;
    if (lengthFilter === '7+') return n >= 7;
    return true;
  });
  const styleGroups = STYLES
    .map((s) => ({ style: s, items: filteredProgressions.filter((p) => p.style === s.id) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="w-full max-w-[1200px] mx-auto animate-fadeIn pb-12 space-y-8">
      {looper && (
        <ProgressionPlayer
          key={looper.title + looper.chords.join('|')}
          title={looper.title}
          chords={looper.chords}
          onClose={() => setLooper(null)}
        />
      )}

      {/* HEADER SECTION */}
      <div className="bg-zinc-900/60 p-6 md:p-8 rounded-3xl border border-zinc-850 backdrop-blur-md shadow-2xl relative z-20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/25">
              <Layers className="w-6 h-6 text-zinc-950" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-zinc-100 tracking-tight">Studio de Composition</h2>
              <p className="text-sm text-zinc-400">Générez des progressions et créez vos propres suites.</p>
            </div>
          </div>
          <div className="relative">
            <div className="flex items-center gap-3 bg-zinc-950/50 p-2 rounded-xl border border-zinc-800">
              <span className="text-xs font-bold text-zinc-500 px-2">Accord Pivot :</span>
              <button 
                onClick={() => setIsEditingTonic(!isEditingTonic)}
                className="text-lg font-black text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-4 py-1.5 rounded-lg border border-emerald-500/20 hover:border-emerald-400 transition-all cursor-pointer"
              >
                {activeChordName}
              </button>
            </div>
            
            {/* Popover FULL CONFIGURATOR */}
            {isEditingTonic && (
              <div className="absolute top-full right-0 mt-2 p-5 bg-zinc-900 border border-zinc-700 shadow-2xl rounded-2xl z-50 animate-fadeIn w-full sm:w-[600px] md:w-[700px] max-h-[80vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-800">
                  <span className="text-sm font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                    <Settings2 className="w-4 h-4" /> Configurer l'Accord Pivot
                  </span>
                  <button onClick={() => setIsEditingTonic(false)} className="text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 p-1.5 rounded-lg transition-all">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                {/* Note Fondamentale */}
                <div className="mb-6">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2.5">
                    Note Fondamentale (Tonique)
                  </label>
                  <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                    {ROOTS.map((root) => {
                      const isSelected = activeRoot === root.pc;
                      return (
                        <button
                          key={root.pc}
                          onClick={() => setActiveRoot(root.pc)}
                          className={`py-2 px-2 text-[10px] sm:text-xs font-extrabold rounded-xl transition cursor-pointer border text-center ${
                            isSelected
                              ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-zinc-950 border-emerald-400 shadow-md shadow-emerald-500/10 scale-102'
                              : 'bg-zinc-950 border-zinc-800 hover:border-emerald-500/50 text-zinc-300 hover:bg-zinc-800'
                          }`}
                        >
                          {root.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Qualité combinable : famille puis extension */}
                <div className="border-t border-zinc-800/80 pt-4">
                  <QualityPicker suffix={activeSuffix} onChange={setActiveSuffix} compact />
                </div>

              </div>
            )}
          </div>
        </div>

        {/* DIATONIC GRID SECTION */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-emerald-500" />
              L'Alphabet de votre Tonalité ({alphabetRoot} {baseModeForGrid})
            </h3>
            <div className="flex items-center gap-2 bg-zinc-950 rounded-lg p-1 border border-zinc-800">
              <button
                onClick={() => setIsEnriched(false)}
                className={`py-1.5 px-3 rounded-md text-xs font-bold transition-all ${
                  !isEnriched ? 'bg-zinc-800 text-zinc-100 shadow' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Simples (Triades)
              </button>
              <button
                onClick={() => setIsEnriched(true)}
                className={`py-1.5 px-3 rounded-md text-xs font-bold transition-all ${
                  isEnriched ? 'bg-zinc-800 text-emerald-400 shadow border border-emerald-500/20' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Enrichis (7èmes)
              </button>
            </div>
          </div>
          
          {isDominantPivot && (
            <p className="text-xs text-zinc-500 mb-3 -mt-2">
              Votre <span className="text-emerald-400 font-bold">{activeChordName}</span> est le
              V7 (dominante) de <span className="text-zinc-300 font-bold">{alphabetRoot} majeur</span> —
              voici ses compagnons naturels.
            </p>
          )}

          <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
            {diatonicChords.map((chord, idx) => (
              <div
                key={idx}
                className="group relative flex flex-col items-center justify-center p-4 bg-zinc-850 hover:bg-zinc-800 border border-zinc-800 hover:border-emerald-500/50 rounded-2xl transition-all overflow-hidden"
              >
                {/* Play Only Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlayChord(chord);
                  }}
                  className="absolute top-2 right-2 w-6 h-6 rounded-md bg-zinc-950 border border-zinc-700 text-zinc-400 hover:bg-emerald-500 hover:text-zinc-950 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shadow-lg z-20 cursor-pointer"
                  title="Écouter sans ajouter"
                >
                  <Play className="w-3 h-3" />
                </button>
                
                {/* Main Add & Play Button overlay */}
                <button
                  onClick={() => {
                    onPlayChord(chord);
                    setCustomProgression([...customProgression, chord]);
                  }}
                  className="absolute inset-0 w-full h-full cursor-pointer z-10"
                  aria-label={`Ajouter ${chord}`}
                />

                <span className="text-[10px] font-mono font-bold text-zinc-500 mb-1 group-hover:text-emerald-500 transition-colors pointer-events-none relative z-0">
                  {diatonicScaleDegrees[idx]}
                </span>
                <span className="text-lg font-black text-zinc-200 group-hover:text-white transition-colors pointer-events-none relative z-0">
                  {chord}
                </span>
                <div className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform bg-emerald-500 text-zinc-950 text-[10px] font-bold py-1 text-center pointer-events-none z-0">
                  Ajouter à la suite
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CUSTOM BUILDER SECTION */}
        {customProgression.length > 0 && (
          <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-5 mb-8 animate-fadeIn">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Votre Suite Personnalisée
              </h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setCustomProgression([])}
                  className="p-2 rounded-lg bg-zinc-900 text-zinc-400 hover:text-rose-400 border border-zinc-800 hover:border-rose-500/50 transition-all cursor-pointer"
                  title="Vider"
                >
                  <X className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setLooper({ title: 'Ma suite personnalisée', chords: [...customProgression] });
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg font-bold text-xs bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-zinc-950 border border-emerald-500/20 hover:border-emerald-500 transition-all cursor-pointer"
                  title="Travailler en boucle avec tempo"
                >
                  <Repeat className="w-4 h-4" />
                  Boucler
                </button>
                <button
                  onClick={() => handlePlaySequence(customProgression)}
                  disabled={isPlayingSeq}
                  className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                    isPlayingSeq 
                      ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                      : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-zinc-950 border border-emerald-500/20 hover:border-emerald-500'
                  }`}
                >
                  <Play className="w-4 h-4" />
                  Jouer
                </button>
                <button
                  onClick={() => onAddProgressionToSheet(customProgression)}
                  className="flex items-center gap-1.5 py-1.5 px-4 rounded-lg bg-emerald-500 text-zinc-950 font-bold text-xs hover:bg-emerald-400 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Exporter vers partition
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              {customProgression.map((chord, idx) => (
                <React.Fragment key={idx}>
                  <div className="group relative flex items-center">
                    <button
                      onClick={() => onPlayChord(chord)}
                      className="w-20 h-16 rounded-xl bg-zinc-900 border border-emerald-500/50 hover:bg-emerald-500 hover:text-zinc-950 flex items-center justify-center transition-all cursor-pointer overflow-hidden"
                    >
                      <span className="text-lg font-extrabold transition-colors">{chord}</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCustomProgression(customProgression.filter((_, i) => i !== idx));
                      }}
                      className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-lg"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  {idx < customProgression.length - 1 && <ChevronRight className="w-4 h-4 text-emerald-500/50" />}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* PRESETS SECTION */}
      <div className="bg-zinc-900/60 p-6 md:p-8 rounded-3xl border border-zinc-850 backdrop-blur-md shadow-2xl relative z-10">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
          <div>
            <h3 className="text-xl font-black text-zinc-100 tracking-tight mb-2">Suites Préfabriquées</h3>
            <p className="text-sm text-zinc-400">Classées par couleur harmonique.</p>
          </div>
          
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Style</label>
              <div className="flex flex-wrap gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                {(['Tous', ...STYLES.map((s) => s.id)] as ('Tous' | StyleId)[]).map((id) => (
                  <button
                    key={id}
                    onClick={() => setStyleFilter(id)}
                    className={`py-1.5 px-3 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                      styleFilter === id
                        ? 'bg-emerald-500 text-zinc-950 shadow-md'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                    }`}
                  >
                    {id === 'Tous' ? 'Tous' : STYLES.find((s) => s.id === id)?.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Nombre d'accords</label>
              <div className="flex gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                {(['Toutes', '3', '4', '5-6', '7+'] as const).map(len => (
                  <button
                    key={len}
                    onClick={() => setLengthFilter(len)}
                    className={`py-1.5 px-3 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                      lengthFilter === len
                        ? 'bg-zinc-700 text-zinc-100 shadow'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                    }`}
                  >
                    {len}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {styleGroups.length === 0 && (
            <div className="text-center py-12 border-2 border-dashed border-zinc-800 rounded-2xl">
              <p className="text-zinc-500 text-sm font-medium">Aucune progression trouvée pour ces filtres.</p>
            </div>
          )}
          {styleGroups.map((group) => (
            <div key={group.style.id}>
              <h4 className="flex items-center gap-2 mb-3">
                <span className="text-sm font-black text-emerald-400 uppercase tracking-wider">{group.style.label}</span>
                <span className="text-[10px] font-mono text-zinc-600">
                  {group.items.length} suite{group.items.length > 1 ? 's' : ''}
                </span>
                <span className="flex-1 h-px bg-zinc-800" aria-hidden />
              </h4>
              <div className="space-y-4">
          {group.items.map((prog, idx) => {
            const pivotRn = RomanNumeral.get(prog.pivotDegree || prog.degrees[0]);
            let progressionTonic = Note.simplify(Note.transpose(activeRoot, Interval.invert(pivotRn.interval || '1P'))) || activeRoot;
            progressionTonic = (prog.base === 'Majeur' ? SPELL_MAJ : SPELL_MIN)[progressionTonic] ?? progressionTonic;
            const chords = Progression.fromRomanNumerals(progressionTonic, prog.degrees).map(readableChord);

            return (
              <div key={idx} className="bg-zinc-850 border border-zinc-800 rounded-2xl p-5 transition-all hover:border-emerald-500/30 hover:bg-zinc-800/80 group">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                  <div>
                    <h4 className="text-lg font-bold text-zinc-100 flex flex-wrap items-center gap-2">
                      {prog.name}
                      <span className="text-[10px] font-mono bg-zinc-950 text-zinc-500 px-2 py-0.5 rounded border border-zinc-800">
                        Clé de {progressionTonic} {prog.base}
                      </span>
                      <span className="text-[10px] font-mono bg-zinc-950 text-zinc-500 px-2 py-0.5 rounded border border-zinc-800">
                        {prog.degrees.length} accords
                      </span>
                    </h4>
                    {prog.hint && (
                      <p className="text-xs text-zinc-500 mt-1">{prog.hint}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setLooper({ title: prog.name, chords });
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl font-bold text-sm border bg-zinc-800/50 text-emerald-400 border-emerald-500/20 hover:border-emerald-500 hover:bg-emerald-500 hover:text-zinc-950 transition-all cursor-pointer"
                      title="Travailler en boucle avec tempo"
                    >
                      <Repeat className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handlePlaySequence(chords)}
                      disabled={isPlayingSeq}
                      className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl font-bold text-sm border transition-all cursor-pointer ${
                        isPlayingSeq 
                          ? 'bg-zinc-800 text-zinc-500 border-zinc-700 cursor-not-allowed' 
                          : 'bg-zinc-800/50 text-emerald-400 border-emerald-500/20 hover:border-emerald-500 hover:bg-emerald-500 hover:text-zinc-950'
                      }`}
                      title="Jouer la suite"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onAddProgressionToSheet(chords)}
                      className="flex items-center justify-center gap-1.5 py-1.5 px-4 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-zinc-950 font-bold text-sm border border-emerald-500/20 hover:border-emerald-500 transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      Exporter
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {chords.map((chord, cIdx) => {
                    const isPivot = prog.degrees[cIdx] === prog.pivotDegree;
                    return (
                      <div key={cIdx} className="flex items-center">
                        <button
                          onClick={() => onPlayChord(chord)}
                          className={`group/btn relative w-20 h-16 rounded-xl flex flex-col items-center justify-center transition-all overflow-hidden cursor-pointer border ${
                            isPivot 
                              ? 'bg-emerald-950/40 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.15)] hover:bg-emerald-500' 
                              : 'bg-zinc-900 border-zinc-700 hover:border-emerald-500 hover:bg-zinc-950'
                          }`}
                        >
                          <span className={`text-[9px] font-mono mb-0.5 z-10 ${isPivot ? 'text-emerald-400 group-hover/btn:text-zinc-800' : 'text-zinc-500 group-hover/btn:text-emerald-500/50'}`}>
                            {prog.degrees[cIdx]}
                          </span>
                          <span className={`text-base font-extrabold z-10 transition-colors ${
                            isPivot ? 'text-emerald-400 group-hover/btn:text-zinc-950' : 'text-zinc-200 group-hover/btn:text-emerald-400'
                          }`}>
                            {chord}
                          </span>
                          <Play className={`w-4 h-4 absolute bottom-1.5 transition-opacity z-10 opacity-0 group-hover/btn:opacity-100 ${
                            isPivot ? 'text-zinc-950' : 'text-emerald-400'
                          }`} />
                        </button>
                        {cIdx < chords.length - 1 && (
                          <ChevronRight className="w-4 h-4 text-zinc-700 mx-1" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
