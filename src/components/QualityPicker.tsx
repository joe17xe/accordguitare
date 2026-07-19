import React from 'react';

/**
 * Sélecteur de qualité d'accord « combinable » :
 * 1. on choisit la famille (Majeur / Mineur, puis les familles spéciales),
 * 2. on combine avec une extension (6, 7, 9, add9, 11, 13…) quand elle existe.
 * Le suffixe produit est directement compréhensible par tonal (C6, Cm9, C7sus4…).
 */

type BaseId = 'maj' | 'min' | 'sus2' | 'sus4' | 'dim' | 'aug' | 'power';

interface BaseDef {
  id: BaseId;
  label: string;
  short: string;
  special?: boolean;
}

const BASES: BaseDef[] = [
  { id: 'maj', label: 'Majeur', short: 'M' },
  { id: 'min', label: 'Mineur', short: 'm' },
  { id: 'sus2', label: 'Sus2', short: 'sus2', special: true },
  { id: 'sus4', label: 'Sus4', short: 'sus4', special: true },
  { id: 'dim', label: 'Diminué', short: 'dim', special: true },
  { id: 'aug', label: 'Augmenté', short: 'aug', special: true },
  { id: 'power', label: 'Power', short: '5', special: true },
];

interface ExtDef {
  /** identifiant stable de la colonne d'extension */
  id: string;
  /** libellé affiché sur la puce */
  label: string;
  /** suffixe concret par famille — absent = combinaison impossible */
  map: Partial<Record<BaseId, string>>;
}

// '' = triade/base seule. L'ordre = du plus courant au plus coloré.
const EXTENSIONS: ExtDef[] = [
  {
    id: 'none', label: 'Simple',
    map: { maj: '', min: 'm', sus2: 'sus2', sus4: 'sus4', dim: 'dim', aug: 'aug', power: '5' },
  },
  { id: '6', label: '6ème', map: { maj: '6', min: 'm6' } },
  { id: '7', label: '7ème', map: { maj: '7', min: 'm7', sus4: '7sus4', aug: '7#5' } },
  { id: 'maj7', label: '7 Majeure', map: { maj: 'maj7', min: 'mMaj7' } },
  { id: 'add9', label: 'Add 9', map: { maj: 'add9', min: 'madd9' } },
  { id: '9', label: '9ème', map: { maj: '9', min: 'm9', sus4: '9sus4' } },
  { id: 'maj9', label: '9 Majeure', map: { maj: 'maj9' } },
  { id: '69', label: '6/9', map: { maj: '6/9' } },
  { id: '11', label: '11ème', map: { maj: '11', min: 'm11' } },
  { id: '13', label: '13ème', map: { maj: '13', min: 'm13' } },
  { id: 'dim7', label: 'Dim 7', map: { dim: 'dim7' } },
  { id: 'm7b5', label: 'Demi-dim', map: { dim: 'm7b5' } },
];

/** Retrouve (famille, extension) depuis un suffixe existant (ex. 'm9' → Mineur + 9ème). */
function decomposeSuffix(suffix: string): { base: BaseId; ext: string } {
  for (const ext of EXTENSIONS) {
    for (const [base, s] of Object.entries(ext.map) as [BaseId, string][]) {
      if (s === suffix) return { base, ext: ext.id };
    }
  }
  return { base: 'maj', ext: 'none' };
}

interface QualityPickerProps {
  suffix: string;
  onChange: (suffix: string) => void;
  /** Puces plus denses (popover du pivot des Suites) */
  compact?: boolean;
}

export const QualityPicker: React.FC<QualityPickerProps> = ({ suffix, onChange, compact }) => {
  const { base, ext } = decomposeSuffix(suffix);

  const pickBase = (b: BaseId) => {
    // Conserve l'extension si elle existe dans la nouvelle famille, sinon retombe sur la base seule
    const keep = EXTENSIONS.find((e) => e.id === ext && e.map[b] !== undefined);
    onChange((keep ?? EXTENSIONS[0]).map[b] ?? '');
  };

  const pad = compact ? 'py-1.5 px-2.5' : 'py-1.5 px-3';

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Famille */}
      <div>
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-2">
          1 · Famille de l'accord
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {BASES.filter((b) => !b.special).map((b) => (
            <button
              key={b.id}
              onClick={() => pickBase(b.id)}
              className={`${pad} text-xs rounded-lg transition cursor-pointer border font-extrabold ${
                base === b.id
                  ? 'bg-emerald-500 text-zinc-950 border-emerald-400 shadow-md shadow-emerald-500/20'
                  : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-zinc-100'
              }`}
            >
              {b.label} <span className="text-[9px] opacity-75 font-mono">({b.short})</span>
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-zinc-800" aria-hidden />
          {BASES.filter((b) => b.special).map((b) => (
            <button
              key={b.id}
              onClick={() => pickBase(b.id)}
              className={`${pad} text-xs rounded-lg transition cursor-pointer border font-semibold ${
                base === b.id
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/45 font-bold'
                  : 'bg-zinc-900/40 border-zinc-850 hover:border-zinc-800 text-zinc-500 hover:text-zinc-200'
              }`}
            >
              {b.label} <span className="text-[9px] opacity-75 font-mono">({b.short})</span>
            </button>
          ))}
        </div>
      </div>

      {/* 2. Extension combinée */}
      <div>
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-2">
          2 · Combiner avec…
        </span>
        <div className="flex flex-wrap gap-1.5">
          {EXTENSIONS.map((e) => {
            const target = e.map[base];
            const available = target !== undefined;
            const isSelected = available && ext === e.id;
            return (
              <button
                key={e.id}
                disabled={!available}
                onClick={() => available && onChange(target)}
                title={available ? undefined : `Pas de ${e.label} en ${BASES.find((b) => b.id === base)?.label}`}
                className={`${pad} text-xs font-semibold rounded-lg transition border ${
                  isSelected
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/45 font-bold cursor-pointer'
                    : available
                      ? 'bg-zinc-900/40 border-zinc-850 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 cursor-pointer'
                      : 'bg-zinc-900/20 border-zinc-900 text-zinc-700 cursor-not-allowed'
                }`}
              >
                {e.label}
                {available && e.id !== 'none' && (
                  <span className="text-[9px] opacity-75 font-mono ml-1">({target})</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
