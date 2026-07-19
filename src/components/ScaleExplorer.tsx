import { useEffect, useMemo, useState } from 'react';
import { Play, Printer } from 'lucide-react';
import { Scale, Note, Interval } from 'tonal';
import { STANDARD_MIDIS } from '../utils/music';
import { NOTE_FR, NOTE_EN } from '../utils/pitch';
import { PianoDiagram } from './PianoDiagram';
import { ScalePrintSheet } from './ScalePrintSheet';
import type { PrintMode } from './ScalePrintSheet';

interface ScaleExplorerProps {
  initialRoot?: string;
  initialType?: string;
  onPlayNote: (midi: number) => void;
  tuningMidis?: number[]; // accordage effectif (capo inclus)
  tuningLabel?: string;   // ex. "DADGAD · Capo 2"
}

const SCALE_GROUPS: { label: string; scales: { type: string; label: string }[] }[] = [
  {
    label: 'Essentielles',
    scales: [
      { type: 'major', label: 'Majeure' },
      { type: 'minor', label: 'Mineure naturelle' },
      { type: 'major pentatonic', label: 'Penta majeure' },
      { type: 'minor pentatonic', label: 'Penta mineure' },
      { type: 'blues', label: 'Blues' },
    ],
  },
  {
    label: 'Modes',
    scales: [
      { type: 'dorian', label: 'Dorien' },
      { type: 'phrygian', label: 'Phrygien' },
      { type: 'lydian', label: 'Lydien' },
      { type: 'mixolydian', label: 'Mixolydien' },
      { type: 'locrian', label: 'Locrien' },
    ],
  },
  {
    label: 'Mineures',
    scales: [
      { type: 'harmonic minor', label: 'Mineure harmonique' },
      { type: 'melodic minor', label: 'Mineure mélodique' },
    ],
  },
];

/** '1P' -> 'R', '3m' -> 'b3', '4A' -> '#4', '5P' -> '5' … */
function degreeLabel(ivl: string): string {
  const num = ivl.replace(/[^0-9]/g, '');
  const q = ivl.replace(/[0-9]/g, '');
  if (num === '1') return 'R';
  if (q === 'm' || q === 'd') return 'b' + num;
  if (q === 'A') return '#' + num;
  return num;
}

const FRET_MARKERS: Record<number, string> = { 3: '●', 5: '●', 7: '●', 9: '●', 12: '●●' };

export function ScaleExplorer({ initialRoot, initialType, onPlayNote, tuningMidis, tuningLabel }: ScaleExplorerProps) {
  const midis = tuningMidis ?? STANDARD_MIDIS;
  const [rootPc, setRootPc] = useState<number>(() => {
    const c = initialRoot ? Note.chroma(initialRoot) : 0;
    return typeof c === 'number' ? c : 0;
  });
  const [type, setType] = useState<string>(initialType || 'minor pentatonic');
  const [labelMode, setLabelMode] = useState<'degrees' | 'names'>('degrees');
  const [printMenu, setPrintMenu] = useState(false);
  const [printMode, setPrintMode] = useState<PrintMode | null>(null);

  // Suit la tonalité envoyée depuis l'atelier (« Gammes pour improviser »)
  useEffect(() => {
    if (initialRoot) {
      const c = Note.chroma(initialRoot);
      if (typeof c === 'number') setRootPc(c);
    }
    if (initialType) setType(initialType);
  }, [initialRoot, initialType]);

  const scaleInfo = useMemo(() => {
    const s = Scale.get(`${NOTE_EN[rootPc]} ${type}`);
    const semis = s.intervals.map((ivl) => Interval.semitones(ivl) ?? 0);
    const pcToDegree = new Map<number, string>();
    s.intervals.forEach((ivl, i) => {
      pcToDegree.set((rootPc + semis[i]) % 12, degreeLabel(ivl));
    });
    return { semis, pcToDegree, intervals: s.intervals };
  }, [rootPc, type]);

  // Épaisseur visuelle des cordes : plus la corde est grave, plus elle est épaisse
  const sortedDesc = useMemo(() => [...midis].sort((a, b) => b - a), [midis]);
  const gaugeFor = (midi: number) => [1, 1, 2, 2, 3, 3][sortedDesc.indexOf(midi)] || 2;

  // Notes de la gamme sur 2 octaves pour le clavier (C4 → B5)
  const pianoMidis = useMemo(() => {
    const out: number[] = [];
    for (let m = 60; m <= 83; m++) {
      if (scaleInfo.pcToDegree.has(m % 12)) out.push(m);
    }
    return out;
  }, [scaleInfo]);

  const playScale = () => {
    const lowest = Math.min(...midis);
    const rootMidi = lowest + ((rootPc - (lowest % 12) + 12) % 12);
    const seq = [...scaleInfo.semis.map((s) => rootMidi + s), rootMidi + 12];
    seq.forEach((m, i) => window.setTimeout(() => onPlayNote(m), i * 270));
  };

  const scaleNotesFr = scaleInfo.semis.map((s) => NOTE_FR[(rootPc + s) % 12]);
  const degreesSeq = scaleInfo.intervals.map(degreeLabel);
  const scaleLabel = SCALE_GROUPS.flatMap((g) => g.scales).find((s) => s.type === type)?.label ?? type;

  return (
    <main className="max-w-[1200px] mx-auto animate-fadeIn flex flex-col gap-6">
      <div className="p-6 rounded-2xl glass-panel">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5 border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 block animate-pulse"></span>
            <h2 className="text-lg font-bold text-zinc-100">Gammes & Modes sur le manche</h2>
            {tuningLabel && tuningLabel !== 'Standard' && (
              <span className="text-[10px] bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-full font-bold border border-amber-500/30">
                {tuningLabel}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={playScale}
              className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-emerald-400 border border-emerald-500/20 hover:border-emerald-500/50 text-xs font-bold transition cursor-pointer"
            >
              <Play className="w-4 h-4" />
              Écouter la gamme
            </button>
            <div className="relative">
              <button
                onClick={() => setPrintMenu(!printMenu)}
                className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg border text-xs font-bold transition cursor-pointer ${
                  printMenu
                    ? 'bg-emerald-500 text-zinc-950 border-emerald-400'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700 hover:border-emerald-500/50'
                }`}
                title="Imprimer ou enregistrer en PDF (format paysage)"
              >
                <Printer className="w-4 h-4" />
                Imprimer
              </button>
              {printMenu && (
                <div className="absolute top-full right-0 mt-2 p-2 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-50 flex flex-col gap-1 w-44 animate-fadeIn">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-2 pt-1">
                    Page paysage avec…
                  </span>
                  {([
                    ['degrees', 'Degrés (R, b3, 5…)'],
                    ['names', 'Noms des notes'],
                    ['both', 'Les deux'],
                  ] as [PrintMode, string][]).map(([m, label]) => (
                    <button
                      key={m}
                      onClick={() => { setPrintMenu(false); setPrintMode(m); }}
                      className="text-left py-1.5 px-2 rounded-lg text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-emerald-400 transition cursor-pointer"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Choix de la tonique */}
        <div className="mb-4">
          <span className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
            Tonique
          </span>
          <div className="flex flex-wrap gap-1.5">
            {NOTE_FR.map((n, pc) => (
              <button
                key={pc}
                onClick={() => setRootPc(pc)}
                className={`py-1 px-3 rounded-full border text-xs font-bold transition cursor-pointer ${
                  rootPc === pc
                    ? 'bg-emerald-500 text-zinc-950 border-emerald-500 shadow-md shadow-emerald-500/20'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Choix de la gamme */}
        <div className="flex flex-col gap-3 mb-5">
          {SCALE_GROUPS.map((group) => (
            <div key={group.label}>
              <span className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                {group.label}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {group.scales.map((s) => (
                  <button
                    key={s.type}
                    onClick={() => setType(s.type)}
                    className={`py-1 px-3 rounded-full border text-xs font-semibold transition cursor-pointer ${
                      type === s.type
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Résumé + options d'affichage */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="text-sm text-zinc-300 font-semibold">
            {scaleNotesFr.join(' · ')}
            <span className="text-zinc-500 font-medium ml-2">({degreesSeq.join(' - ')})</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 text-[11px] font-semibold text-zinc-400">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span> Tonique
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Gamme
              </span>
            </div>
            <div className="flex bg-zinc-900/80 p-0.5 rounded-lg border border-zinc-800">
              <button
                onClick={() => setLabelMode('degrees')}
                className={`py-1 px-3 rounded-md text-xs font-bold transition cursor-pointer ${
                  labelMode === 'degrees'
                    ? 'bg-emerald-500 text-zinc-950'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Degrés
              </button>
              <button
                onClick={() => setLabelMode('names')}
                className={`py-1 px-3 rounded-md text-xs font-bold transition cursor-pointer ${
                  labelMode === 'names'
                    ? 'bg-emerald-500 text-zinc-950'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Notes
              </button>
            </div>
          </div>
        </div>

        {/* Manche */}
        <div className="overflow-x-auto pb-1">
          <div className="min-w-[780px]">
            <div
              className="grid rounded-xl overflow-hidden fretboard-wood"
              style={{ gridTemplateColumns: '48px 48px repeat(12, minmax(50px, 1fr))' }}
            >
              {midis.map((openMidi, sIdx) => {
                const gauge = gaugeFor(openMidi);
                return (
                  <div key={sIdx} className="contents">
                    {/* Nom de la corde */}
                    <div className="flex items-center justify-center h-12 bg-[#0e0e12] text-[11px] font-bold text-zinc-400 border-r border-zinc-800">
                      {NOTE_FR[openMidi % 12]}
                      <span className="text-[9px] text-zinc-600 ml-0.5">{sIdx + 1}</span>
                    </div>
                    {/* Frettes 0 à 12 */}
                    {Array.from({ length: 13 }, (_, f) => {
                      const midi = openMidi + f;
                      const deg = scaleInfo.pcToDegree.get(midi % 12);
                      const isRoot = deg === 'R';
                      return (
                        <div
                          key={f}
                          className={`relative flex items-center justify-center h-12 ${
                            f === 0
                              ? 'bg-[#131318] border-r-[3px] border-zinc-300/80'
                              : 'border-r border-zinc-500/30'
                          }`}
                        >
                          <div
                            className="absolute inset-x-0 top-1/2 -translate-y-1/2 bg-zinc-400/50"
                            style={{ height: `${gauge}px` }}
                          ></div>
                          {deg && (
                            <button
                              onClick={() => onPlayNote(midi)}
                              title={`${NOTE_FR[midi % 12]} (${deg})`}
                              className={`relative z-10 w-8 h-8 rounded-full text-[10px] font-extrabold text-zinc-950 transition hover:scale-110 cursor-pointer shadow-md ${
                                isRoot
                                  ? 'bg-rose-500 shadow-rose-500/30'
                                  : 'bg-emerald-500 shadow-emerald-500/20'
                              }`}
                            >
                              {labelMode === 'degrees' ? deg : NOTE_FR[midi % 12]}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Numéros de frette + repères */}
            <div
              className="grid mt-1"
              style={{ gridTemplateColumns: '48px 48px repeat(12, minmax(50px, 1fr))' }}
            >
              <div></div>
              {Array.from({ length: 13 }, (_, f) => (
                <div key={f} className="flex flex-col items-center text-zinc-600">
                  <span className="text-[10px] font-bold">{f}</span>
                  <span className="text-[8px] leading-none text-zinc-700">
                    {FRET_MARKERS[f] || ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Même gamme sur le clavier */}
      <div className="p-6 rounded-2xl glass-panel">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 block"></span>
          <h2 className="text-lg font-bold text-zinc-100">La même gamme au piano</h2>
          <span className="text-xs text-zinc-500 font-medium ml-1">(2 octaves)</span>
        </div>
        <div className="flex justify-center overflow-x-auto py-2">
          <PianoDiagram notes={pianoMidis} scale={1.9} />
        </div>
      </div>

      {/* Feuille d'impression (invisible à l'écran, pleine page A4 paysage) */}
      {printMode && (
        <ScalePrintSheet
          title={`Gamme de ${NOTE_FR[rootPc]} — ${scaleLabel}`}
          subtitle={`${scaleNotesFr.join(' · ')}   (${degreesSeq.join(' - ')})`}
          midis={midis}
          pcToDegree={scaleInfo.pcToDegree}
          mode={printMode}
          onDone={() => setPrintMode(null)}
        />
      )}
    </main>
  );
}
