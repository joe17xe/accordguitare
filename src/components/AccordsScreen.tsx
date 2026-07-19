import { Guitar, Piano, Search, Volume2, RotateCcw, Plus, Layers, AudioLines, Link2 } from 'lucide-react';
import { Fretboard } from './Fretboard';
import { PianoKeyboard } from './PianoKeyboard';
import { ChordGenerator } from './ChordGenerator';
import type { StringState } from '../utils/music';
import type { Lang } from '../i18n';

type InputMode = 'guitar' | 'piano' | 'generator';

interface TuningPreset { id: string; label: string; midis: number[] }

interface Detection {
  chords: string[];
  notesPlayed: string[];
  tonic: string;
  bassNote: string;
}

export interface AccordsScreenProps {
  lang: Lang;
  detection: Detection;
  activeChordName: string;
  selectedChordIdx: number;
  onSelectChordIdx: (idx: number) => void;

  inputMode: InputMode;
  onChangeInputMode: (mode: InputMode) => void;

  // Guitare
  strings: StringState[];
  onFretboardChange: (s: StringState[]) => void;
  playedString: number | null;
  showRootNote: boolean;
  onToggleShowRoot: () => void;
  effectiveMidis: number[];
  onStrum: () => void;
  onResetGuitar: () => void;

  // Piano
  activeMidiNotes: number[];
  onTogglePianoNote: (midi: number) => void;
  onPlayPianoChord: () => void;
  onResetPiano: () => void;

  // Accordage / capo
  tuningId: string;
  onChangeTuning: (id: string) => void;
  tuningPresets: TuningPreset[];
  isStandardTuning: boolean;
  capo: number;
  onChangeCapo: (c: number) => void;
  tuningNoteNames: string[]; // du grave à l'aigu

  // Favoris
  presets: { name: string; strings: StringState[] }[];
  onLoadPreset: (s: StringState[], name: string) => void;

  // Actions partition / navigation
  onAddChord: () => void;
  onFindProgression: () => void;
  onFindScales: () => void;

  // Générateur
  onSelectVoicing: (voicing: StringState[], name: string) => void;
  onPlayVoicing: (voicing: StringState[]) => void;
  onAddGeneratedChord: (voicing: StringState[], name: string, root: string) => void;
}

const noteChipCls =
  'font-mono text-[10px] font-bold text-guitar-light bg-guitar/10 border border-guitar/20 px-2 py-[3px] rounded-md';

/**
 * Écran Accords mobile — direction 1c « studio sync ».
 * Lecture d'accord, panneau guitare (émeraude) + panneau piano (ambre) synchronisés,
 * FAB « Ajouter à la partition ». Compose les composants existants sans réécrire la logique.
 */
export function AccordsScreen(props: AccordsScreenProps) {
  const {
    detection, activeChordName, selectedChordIdx, onSelectChordIdx,
    inputMode, onChangeInputMode,
    strings, onFretboardChange, playedString, showRootNote, onToggleShowRoot, effectiveMidis,
    onStrum, onResetGuitar,
    activeMidiNotes, onTogglePianoNote, onPlayPianoChord, onResetPiano,
    tuningId, onChangeTuning, tuningPresets, isStandardTuning, capo, onChangeCapo, tuningNoteNames,
    presets, onLoadPreset,
    onAddChord, onFindProgression, onFindScales,
    onSelectVoicing, onPlayVoicing, onAddGeneratedChord,
  } = props;

  const hasChord = detection.chords.length > 0;
  const hasNotes = detection.notesPlayed.length > 0;
  const stringsLabel = tuningNoteNames.join(' ');

  const modes: { id: InputMode; label: string; Icon: typeof Guitar }[] = [
    { id: 'guitar', label: 'Guitare', Icon: Guitar },
    { id: 'piano', label: 'Piano', Icon: Piano },
    { id: 'generator', label: 'Accord', Icon: Search },
  ];

  return (
    <div className="flex flex-col gap-3 pt-1 animate-fadeIn">
      {/* Lecture d'accord */}
      <div className="flex items-center gap-4 px-1">
        <span className="font-extrabold text-[40px] leading-none tracking-[-1px] text-guitar-light">
          {activeChordName || (hasNotes ? '·' : '—')}
        </span>
        <div className="flex flex-col gap-1.5 min-w-0">
          <span className="text-[10px] font-medium text-ink-3">
            {hasChord ? (
              <>Basse <b className="text-ink-2 font-bold">{detection.bassNote}</b> · Tonique <b className="text-tonic font-bold">{detection.tonic}</b></>
            ) : hasNotes ? 'Accord complexe' : 'Choisis des notes ci-dessous'}
          </span>
          {hasNotes && (
            <div className="flex flex-wrap gap-1.5">
              {detection.notesPlayed.map((n, i) => (
                <span key={i} className={noteChipCls}>{n}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sélecteur d'instrument (inputMode) */}
      <div className="flex gap-1 rounded-2xl border border-white/8 bg-white/[0.04] p-1">
        {modes.map(({ id, label, Icon }) => {
          const active = inputMode === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChangeInputMode(id)}
              className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl py-2 text-[13px] font-extrabold transition ${
                active ? 'bg-guitar text-guitar-ink shadow-lg shadow-guitar/20' : 'text-ink-3'
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={2.4} />
              {label}
            </button>
          );
        })}
      </div>

      {/* Accordage · Capo · Tonique */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-4">Accord.</span>
          <select
            value={tuningId}
            onChange={(e) => onChangeTuning(e.target.value)}
            className="cursor-pointer rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-bold text-ink focus:border-guitar/60 focus:outline-none"
          >
            {tuningPresets.map((t) => (
              <option key={t.id} value={t.id} className="bg-zinc-900">{t.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-4">Capo</span>
          <button onClick={() => onChangeCapo(Math.max(0, capo - 1))} className="h-6 w-6 cursor-pointer rounded-md border border-white/10 bg-white/5 text-sm font-bold text-ink-2 active:scale-95">−</button>
          <span className={`w-4 text-center text-sm font-extrabold ${capo > 0 ? 'text-guitar-light' : 'text-ink-3'}`}>{capo}</span>
          <button onClick={() => onChangeCapo(Math.min(9, capo + 1))} className="h-6 w-6 cursor-pointer rounded-md border border-white/10 bg-white/5 text-sm font-bold text-ink-2 active:scale-95">+</button>
        </div>
        <button
          onClick={onToggleShowRoot}
          className={`ml-auto flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition ${
            showRootNote ? 'border-tonic/50 bg-tonic/15 text-tonic' : 'border-white/10 bg-white/5 text-ink-4'
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${showRootNote ? 'bg-tonic' : 'bg-ink-4'}`} />
          Tonique
        </button>
      </div>

      {/* Favoris */}
      {isStandardTuning && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <span className="flex-none text-[10px] font-bold uppercase tracking-wider text-ink-4">Favoris</span>
          {presets.map((p, idx) => (
            <button
              key={idx}
              onClick={() => onLoadPreset(p.strings, p.name)}
              className="flex-none cursor-pointer rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-ink-2 transition active:scale-95"
            >
              {p.name.split(' ')[0]}
            </button>
          ))}
        </div>
      )}

      {inputMode === 'generator' ? (
        // Mode « Choisir un accord »
        !isStandardTuning ? (
          <div className="rounded-2xl border border-piano/20 bg-piano/5 p-4 text-center">
            <p className="text-sm font-semibold text-piano">Le générateur est pensé pour l'accordage standard.</p>
            <p className="mt-1 text-xs text-ink-4">Repasse en Standard pour l'utiliser (le capo reste compatible).</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-guitar/16 bg-guitar/5 p-3">
            <ChordGenerator
              onSelectVoicing={onSelectVoicing}
              onPlayVoicing={onPlayVoicing}
              onAddChord={onAddGeneratedChord}
              currentStrings={strings}
              showRootNote={showRootNote}
            />
          </div>
        )
      ) : (
        <>
          {/* Panneau Guitare (émeraude) */}
          <section className="rounded-[20px] border border-guitar/16 bg-guitar/5 px-3 pt-3 pb-2">
            <div className="mb-1.5 flex items-center gap-1.5">
              <span className="h-[7px] w-[7px] rounded-full bg-guitar" />
              <span className="text-[9.5px] font-bold uppercase tracking-[1px] text-guitar-light">Guitare</span>
              <span className="ml-auto font-mono text-[9px] font-semibold text-ink-4">{stringsLabel}</span>
              <div className="flex gap-1">
                <button onClick={onStrum} title="Gratter" className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-white/10 bg-white/5 text-ink-2 active:scale-95"><Volume2 className="h-3.5 w-3.5" /></button>
                <button onClick={onResetGuitar} title="Réinitialiser" className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-white/10 bg-white/5 text-ink-2 active:scale-95"><RotateCcw className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            <div className="-mx-1">
              <Fretboard
                strings={strings}
                onChange={onFretboardChange}
                playedString={playedString}
                showRootNote={showRootNote}
                rootNote={detection.tonic}
                tuningMidis={effectiveMidis}
                compact
              />
            </div>
          </section>

          {/* Indicateur d'état (non interactif) : la synchro guitare↔piano est automatique */}
          <div className="-my-1.5 flex justify-center">
            <div className="flex items-center gap-1.5 rounded-full border border-guitar/25 bg-guitar/8 px-3 py-1" aria-live="polite">
              <span className="h-1.5 w-1.5 rounded-full bg-guitar animate-pulse" />
              <Link2 className="h-3 w-3 text-guitar-light" strokeWidth={2.2} />
              <span className="text-[9px] font-bold uppercase tracking-[0.6px] text-guitar-light">Guitare &amp; piano synchronisés</span>
            </div>
          </div>

          {/* Panneau Piano (ambre) */}
          <section className="rounded-[20px] border border-piano/16 bg-piano/5 px-3 pt-3 pb-3">
            <div className="mb-2 flex items-center gap-1.5">
              <span className="h-[7px] w-[7px] rounded-full bg-piano" />
              <span className="text-[9.5px] font-bold uppercase tracking-[1px] text-piano">Clavier</span>
              <span className="ml-auto font-mono text-[9px] font-semibold text-ink-4">Do3 — Si5</span>
              <div className="flex gap-1">
                <button onClick={onPlayPianoChord} title="Jouer" className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-white/10 bg-white/5 text-ink-2 active:scale-95"><Volume2 className="h-3.5 w-3.5" /></button>
                <button onClick={onResetPiano} title="Réinitialiser" className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-white/10 bg-white/5 text-ink-2 active:scale-95"><RotateCcw className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            <PianoKeyboard activeNotes={activeMidiNotes} onToggleNote={onTogglePianoNote} bare accent="amber" />
          </section>
        </>
      )}

      {/* Interprétations alternatives */}
      {detection.chords.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {detection.chords.map((chord, idx) => (
            <button
              key={idx}
              onClick={() => onSelectChordIdx(idx)}
              className={`cursor-pointer rounded-md px-2 py-1 text-xs font-bold transition ${
                idx === selectedChordIdx ? 'bg-guitar text-guitar-ink' : 'bg-white/6 text-ink-2'
              }`}
            >
              {chord}
            </button>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2 pt-1">
        <button
          onClick={onAddChord}
          disabled={!hasNotes}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-[18px] bg-gradient-to-b from-guitar to-guitar-deep py-3.5 text-[13px] font-extrabold text-guitar-ink shadow-lg shadow-guitar/40 transition active:scale-[0.98] disabled:opacity-40"
        >
          <Plus className="h-4.5 w-4.5" strokeWidth={2.6} />
          Ajouter à la partition
        </button>
        <div className="flex gap-2">
          <button
            onClick={onFindProgression}
            disabled={!hasChord}
            className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[14px] border border-guitar/25 bg-white/[0.04] py-2.5 text-xs font-bold text-guitar-light transition active:scale-[0.98] disabled:opacity-40"
          >
            <Layers className="h-4 w-4" strokeWidth={2.4} />
            Créer une suite
          </button>
          <button
            onClick={onFindScales}
            disabled={!hasChord}
            className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[14px] border border-guitar/25 bg-white/[0.04] py-2.5 text-xs font-bold text-guitar-light transition active:scale-[0.98] disabled:opacity-40"
          >
            <AudioLines className="h-4 w-4" strokeWidth={2.4} />
            Gammes
          </button>
        </div>
      </div>
    </div>
  );
}
