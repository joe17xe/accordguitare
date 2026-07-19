import React, { useState, useEffect } from 'react';
import { Chord } from 'tonal';
import { generateGuitarVoicings, getNoteAtFret, suggestPianoVoicing } from '../utils/music';
import type { StringState } from '../utils/music';
import { ChordDiagram } from './ChordDiagram';
import { PianoDiagram } from './PianoDiagram';
import { QualityPicker } from './QualityPicker';
import { Volume2, Plus, Check, Sparkles } from 'lucide-react';

interface ChordGeneratorProps {
  onSelectVoicing: (voicing: StringState[], name: string, root: string) => void;
  onPlayVoicing: (voicing: StringState[]) => void;
  onAddChord: (voicing: StringState[], name: string, root: string) => void;
  currentStrings: StringState[];
  showRootNote: boolean;
}

const ROOTS = [
  { pc: 'C', label: 'Do (C)' },
  { pc: 'C#', label: 'Do# (C#)' },
  { pc: 'D', label: 'Ré (D)' },
  { pc: 'D#', label: 'Ré# (D#)' },
  { pc: 'E', label: 'Mi (E)' },
  { pc: 'F', label: 'Fa (F)' },
  { pc: 'F#', label: 'Fa# (F#)' },
  { pc: 'G', label: 'Sol (G)' },
  { pc: 'G#', label: 'Sol# (G#)' },
  { pc: 'A', label: 'La (A)' },
  { pc: 'A#', label: 'La# (A#)' },
  { pc: 'B', label: 'Si (B)' },
];

export const ChordGenerator: React.FC<ChordGeneratorProps> = ({
  onSelectVoicing,
  onPlayVoicing,
  onAddChord,
  currentStrings,
  showRootNote,
}) => {
  const [selectedRoot, setSelectedRoot] = useState<string>('C');
  const [selectedSuffix, setSelectedSuffix] = useState<string>('');
  const [voicings, setVoicings] = useState<StringState[][]>([]);

  const fullChordName = `${selectedRoot}${selectedSuffix}`;

  // Recalculate voicings when chord selection changes
  useEffect(() => {
    const generated = generateGuitarVoicings(fullChordName);
    setVoicings(generated);
  }, [selectedRoot, selectedSuffix]);

  const handlePlay = (e: React.MouseEvent, voicing: StringState[]) => {
    e.stopPropagation();
    onPlayVoicing(voicing);
  };

  const handleAdd = (e: React.MouseEvent, voicing: StringState[]) => {
    e.stopPropagation();
    onAddChord(voicing, fullChordName, selectedRoot);
  };

  // Helper to determine if a voicing is currently active/selected on the main instrument
  const isVoicingActive = (v: StringState[]) => {
    return v.every((val, idx) => val === currentStrings[idx]);
  };

  // Determine chord pitch classes details
  const chordNotes = Chord.get(fullChordName).notes || [];
  const pianoNotes = suggestPianoVoicing(chordNotes);

  return (
    <div className="flex flex-col gap-6 animate-fadeIn">
      {/* 1. Configuration Panel */}
      <div className="p-6 rounded-2xl glass-panel flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-450" />
              Configurateur d'Accord
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Sélectionnez la note fondamentale et la qualité/degré de l'accord pour voir les formes de doigtés possibles.
            </p>
          </div>
        </div>

        {/* Note Fondamentale selection */}
        <div>
          <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2.5">
            Note Fondamentale (Tonique)
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {ROOTS.map((root) => {
              const isSelected = selectedRoot === root.pc;
              return (
                <button
                  key={root.pc}
                  onClick={() => setSelectedRoot(root.pc)}
                  className={`py-2 px-3 text-xs font-extrabold rounded-xl transition cursor-pointer border text-center ${
                    isSelected
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-zinc-950 border-emerald-400 shadow-md shadow-emerald-500/10 scale-102'
                      : 'bg-zinc-900/60 border-zinc-805 hover:border-zinc-700 text-zinc-300 hover:bg-zinc-800/40'
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
          <QualityPicker suffix={selectedSuffix} onChange={setSelectedSuffix} />
        </div>
      </div>

      {/* 2. Output Panel (Calculated Shapes) */}
      <div className="p-6 rounded-2xl glass-panel flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between border-b border-zinc-800 pb-4 gap-4">
          <div className="text-center sm:text-left">
            <h3 className="text-base font-bold text-zinc-150">
              Formes disponibles pour <span className="text-emerald-450 font-extrabold">{fullChordName || 'C'}</span>
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Notes : {chordNotes.join(', ') || 'N/A'} | {voicings.length} formes trouvées
            </p>
          </div>
          
          <div className="flex flex-col items-center bg-zinc-900/40 p-2.5 rounded-xl border border-zinc-800/80 shadow-inner">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Au Piano</span>
            <div className="scale-90 origin-top">
              <PianoDiagram notes={pianoNotes} lightMode={false} scale={1.0} />
            </div>
          </div>
        </div>

        {voicings.length === 0 ? (
          <div className="py-12 px-4 text-center border-2 border-dashed border-zinc-800/60 rounded-xl bg-zinc-900/10">
            <span className="text-2xl block mb-2">🤷‍♂️</span>
            <p className="text-sm font-semibold text-zinc-400">Aucun doigté standard trouvé</p>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
              L'accord est peut-être trop complexe ou nécessite des extensions impossibles à fretter physiquement dans une portée de 4 frettes.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Shapes Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              {voicings.slice(0, 6).map((voicing, index) => {
                const isActive = isVoicingActive(voicing);
                
                // Check if root note is at the bass
                let lowestPlayedStringIdx = -1;
                for (let s = 5; s >= 0; s--) {
                  if (voicing[s] !== 'X') {
                    lowestPlayedStringIdx = s;
                    break;
                  }
                }
                const isRootBass = lowestPlayedStringIdx !== -1 && 
                  getNoteAtFret(lowestPlayedStringIdx, voicing[lowestPlayedStringIdx])?.pc === selectedRoot;

                return (
                  <div
                    key={index}
                    onClick={() => onSelectVoicing(voicing, fullChordName, selectedRoot)}
                    className={`relative p-3 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col items-center hover:scale-102 select-none group
                      ${
                        isActive
                          ? 'bg-zinc-900/70 border-emerald-500/80 ring-2 ring-emerald-500/10 shadow-lg shadow-emerald-500/5'
                          : 'bg-zinc-900/30 border-zinc-850 hover:bg-zinc-900/50 hover:border-zinc-700'
                      }`}
                  >
                    {/* Header Badges */}
                    <div className="absolute top-2 left-2 flex flex-col gap-1 z-10 pointer-events-none">
                      <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                        N°{index + 1}
                      </span>
                      {isRootBass && (
                        <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-450 border border-emerald-500/20">
                          Basse Racine
                        </span>
                      )}
                    </div>

                    {/* SVG Chord Diagram */}
                    <div className="mt-6 pointer-events-none scale-95 origin-center">
                      <ChordDiagram
                        strings={voicing}
                        name={fullChordName}
                        lightMode={false}
                        rootNote={selectedRoot}
                        showRootNote={showRootNote}
                      />
                    </div>

                    {/* Interaction Actions */}
                    <div className="w-full mt-3 flex items-center justify-between border-t border-zinc-800/80 pt-3 gap-2">
                      <button
                        onClick={(e) => handlePlay(e, voicing)}
                        className="flex-1 py-1.5 px-2 rounded-lg bg-zinc-850 hover:bg-zinc-800 text-zinc-300 hover:text-emerald-455 border border-zinc-800/80 text-[10px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                        title="Écouter l'accord gratté"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        Écouter
                      </button>
                      <button
                        onClick={(e) => handleAdd(e, voicing)}
                        className="py-1.5 px-2.5 rounded-lg bg-zinc-850 hover:bg-zinc-800 text-zinc-300 hover:text-emerald-455 border border-zinc-800/80 text-[10px] font-bold transition flex items-center justify-center cursor-pointer"
                        title="Ajouter à la partition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Active Overlay Checkmark */}
                    {isActive && (
                      <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-emerald-500 text-zinc-950 flex items-center justify-center shadow-lg border-2 border-[#0c0c0e]">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
