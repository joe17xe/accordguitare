import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { NOTE_FR } from '../utils/pitch';

/**
 * UX-003 — Feuille d'impression des gammes.
 * Rendu noir sur blanc en SVG, pleine page A4 paysage via @page (src/index.css).
 * Invisible à l'écran ; window.print() est déclenché au montage — le dialogue
 * d'impression du navigateur permet aussi d'« Enregistrer en PDF ».
 */

export type PrintMode = 'degrees' | 'names' | 'both';

interface ScalePrintSheetProps {
  /** ex. « Gamme de La — Penta mineure » */
  title: string;
  /** notes de la gamme, ex. « La · Do · Ré · Mi · Sol » */
  subtitle: string;
  /** midis des cordes à vide, ordre identique à l'écran (aiguë → grave) */
  midis: number[];
  /** classe de hauteur → étiquette de degré (R, b3, 5…) */
  pcToDegree: Map<number, string>;
  mode: PrintMode;
  onDone: () => void;
}

const FRET_MARKERS: Record<number, string> = { 3: '●', 5: '●', 7: '●', 9: '●', 12: '●●' };

function FretboardSVG({
  midis, pcToDegree, showDegrees, heightMm,
}: { midis: number[]; pcToDegree: Map<number, string>; showDegrees: boolean; heightMm: number }) {
  const CELL = 84;   // largeur d'une case
  const ROW = 58;    // hauteur d'une corde
  const LEFT = 64;   // colonne des noms de corde
  const TOP = 14;
  const BOT = 46;    // numéros de frette + repères
  const width = LEFT + 13 * CELL;
  const height = TOP + midis.length * ROW + BOT;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: '100%', height: `${heightMm}mm` }}
    >
      {/* Cordes (plus graves = plus épaisses) */}
      {midis.map((openMidi, sIdx) => {
        const y = TOP + sIdx * ROW + ROW / 2;
        return (
          <g key={sIdx}>
            <text x={LEFT - 10} y={y + 5} textAnchor="end" fontSize="17" fontWeight="700" fill="#000">
              {NOTE_FR[openMidi % 12]}
            </text>
            <line x1={LEFT} y1={y} x2={width} y2={y} stroke="#000" strokeWidth={1 + sIdx * 0.35} />
          </g>
        );
      })}

      {/* Frettes (le sillet après la case 0, plus épais) */}
      {Array.from({ length: 13 }, (_, f) => {
        const x = LEFT + (f + 1) * CELL;
        return (
          <line
            key={f}
            x1={x} y1={TOP} x2={x} y2={TOP + midis.length * ROW}
            stroke="#000" strokeWidth={f === 0 ? 5 : 1}
          />
        );
      })}
      <line x1={LEFT} y1={TOP} x2={LEFT} y2={TOP + midis.length * ROW} stroke="#999" strokeWidth={1} />

      {/* Notes de la gamme */}
      {midis.map((openMidi, sIdx) =>
        Array.from({ length: 13 }, (_, f) => {
          const midi = openMidi + f;
          const deg = pcToDegree.get(midi % 12);
          if (!deg) return null;
          const cx = LEFT + f * CELL + CELL / 2;
          const cy = TOP + sIdx * ROW + ROW / 2;
          const isRoot = deg === 'R';
          const label = showDegrees ? deg : NOTE_FR[midi % 12];
          return (
            <g key={`${sIdx}-${f}`}>
              <circle
                cx={cx} cy={cy} r={21}
                fill={isRoot ? '#000' : '#fff'}
                stroke="#000" strokeWidth={isRoot ? 0 : 2}
              />
              <text
                x={cx} y={cy + 5} textAnchor="middle"
                fontSize={label.length > 2 ? 13 : 16} fontWeight="800"
                fill={isRoot ? '#fff' : '#000'}
              >
                {label}
              </text>
            </g>
          );
        })
      )}

      {/* Numéros de frette + repères */}
      {Array.from({ length: 13 }, (_, f) => {
        const x = LEFT + f * CELL + CELL / 2;
        const y = TOP + midis.length * ROW;
        return (
          <g key={f}>
            <text x={x} y={y + 20} textAnchor="middle" fontSize="15" fontWeight="700" fill="#000">{f}</text>
            {FRET_MARKERS[f] && (
              <text x={x} y={y + 38} textAnchor="middle" fontSize="12" fill="#666">{FRET_MARKERS[f]}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function ScalePrintSheet({ title, subtitle, midis, pcToDegree, mode, onDone }: ScalePrintSheetProps) {
  useEffect(() => {
    document.body.classList.add('printing-scale');
    const after = () => onDone();
    window.addEventListener('afterprint', after);
    // Laisse le DOM se peindre avant d'ouvrir le dialogue d'impression
    const id = window.setTimeout(() => window.print(), 150);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('afterprint', after);
      document.body.classList.remove('printing-scale');
    };
  }, [onDone]);

  const both = mode === 'both';

  return createPortal(
    <div className="scale-print-sheet">
      <div style={{ textAlign: 'center', marginBottom: '4mm' }}>
        <div style={{ fontSize: '22pt', fontWeight: 900, color: '#000' }}>{title}</div>
        <div style={{ fontSize: '11pt', fontWeight: 600, color: '#333', marginTop: '1mm' }}>
          {subtitle}
          <span style={{ marginLeft: '6mm', color: '#555' }}>● = tonique</span>
        </div>
      </div>

      {both ? (
        <>
          <div style={{ fontSize: '10pt', fontWeight: 800, color: '#000', margin: '0 0 1mm 2mm', textTransform: 'uppercase', letterSpacing: '1px' }}>Degrés</div>
          <FretboardSVG midis={midis} pcToDegree={pcToDegree} showDegrees heightMm={72} />
          <div style={{ fontSize: '10pt', fontWeight: 800, color: '#000', margin: '3mm 0 1mm 2mm', textTransform: 'uppercase', letterSpacing: '1px' }}>Notes</div>
          <FretboardSVG midis={midis} pcToDegree={pcToDegree} showDegrees={false} heightMm={72} />
        </>
      ) : (
        <FretboardSVG midis={midis} pcToDegree={pcToDegree} showDegrees={mode === 'degrees'} heightMm={158} />
      )}
    </div>,
    document.body
  );
}
