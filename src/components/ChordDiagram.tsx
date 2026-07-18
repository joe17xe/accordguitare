import { detectBarres, getNoteAtFret } from '../utils/music';
import type { StringState } from '../utils/music';

interface ChordDiagramProps {
  strings: StringState[]; // Index 0: High E, Index 5: Low E
  name: string;
  lightMode?: boolean; // For printing/PDF export (black on white)
  rootNote?: string;
  showRootNote?: boolean;
  scale?: number;
  tuningMidis?: number[]; // accordage utilisé au moment de la sauvegarde de l'accord
}

export const ChordDiagram: React.FC<ChordDiagramProps> = ({ strings, name, lightMode = false, rootNote, showRootNote = false, scale = 1.0, tuningMidis }) => {
  // 1. Map to layout array: Standard vertical diagrams are Low E (string 6) on the left to High E (string 1) on the right.
  // So we reverse the strings state array.
  const displayStrings = [...strings].reverse();

  // Find frets played
  const frettedValues = strings.filter((f): f is number => typeof f === 'number' && f > 0);
  const maxFret = frettedValues.length > 0 ? Math.max(...frettedValues) : 0;
  const minFret = frettedValues.length > 0 ? Math.min(...frettedValues) : 0;

  // Determine starting fret and height
  let startFret = 1;
  let numFrets = 5;

  if (maxFret > 5) {
    startFret = minFret;
    numFrets = Math.max(5, maxFret - minFret + 1);
  }

  // Detect barres in current grid window
  const barres = detectBarres(strings, startFret, numFrets);

  // Dimension settings
  const width = 160;
  const height = 160;
  
  const xStart = 30;
  const xSpacing = 20; // 5 intervals of 20 = 100px width
  const yStart = 25;
  const ySpacing = 22; // 5 frets of 22 = 110px height

  // Colors based on theme
  const textColor = lightMode ? 'text-zinc-900' : 'text-zinc-100';
  const gridColor = lightMode ? '#a1a1aa' : '#52525b';
  const nutColor = lightMode ? '#18181b' : '#e4e4e7';
  const dotColor = lightMode ? '#18181b' : '#10b981'; // Emerald glow on dark, solid black on light
  const dotStroke = lightMode ? '#18181b' : '#059669';

  const checkRoot = (displayIdx: number, fret: number) => {
    if (!showRootNote || !rootNote) return false;
    const stringIdx = 5 - displayIdx; // displayIdx 0 is Low E (stringIdx 5)
    const note = getNoteAtFret(stringIdx, fret, tuningMidis);
    return note?.pc === rootNote;
  };

  return (
    <div 
      className={`flex flex-col items-center justify-center p-2 rounded-lg ${lightMode ? 'pdf-chord-diagram-card' : 'glass-panel'} select-none transition-all`}
      style={lightMode ? { backgroundColor: '#ffffff' } : undefined}
    >
      {/* Chord Name */}
      <div 
        className={`text-base font-bold truncate max-w-full mb-1 tracking-wide ${lightMode ? 'pdf-chord-diagram-name' : textColor}`}
        style={lightMode ? { color: '#18181b' } : undefined}
      >
        {name || 'Accord'}
      </div>

      {/* SVG Diagram wrapped in scaled container */}
      <div style={{ width: `${90.72 * scale}px` }}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${width} ${height}`} className="w-full h-auto block">
        {/* Draw Frets (Horizontal lines) */}
        {Array.from({ length: numFrets + 1 }).map((_, i) => {
          const y = yStart + i * ySpacing;
          const isNut = startFret === 1 && i === 0;

          return (
            <line
              key={i}
              x1={xStart}
              y1={y}
              x2={xStart + 5 * xSpacing}
              y2={y}
              stroke={isNut ? nutColor : gridColor}
              strokeWidth={isNut ? 5 : 1.5}
            />
          );
        })}

        {/* Starting fret number indicator on the left */}
        {startFret > 1 && (
          <text
            x={xStart - 12}
            y={yStart + ySpacing / 2 + 3}
            fontSize="10"
            fontWeight="bold"
            fill={lightMode ? '#18181b' : '#10b981'}
            textAnchor="middle"
          >
            {startFret}fr
          </text>
        )}

        {/* Draw Strings (Vertical lines) */}
        {Array.from({ length: 6 }).map((_, i) => {
          const x = xStart + i * xSpacing;
          return (
            <line
              key={i}
              x1={x}
              y1={yStart}
              x2={x}
              y2={yStart + numFrets * ySpacing}
              stroke={gridColor}
              strokeWidth={1.5}
            />
          );
        })}

        {/* Draw Nut status indicators (O and X) */}
        {displayStrings.map((fret, i) => {
          const x = xStart + i * xSpacing;
          const y = yStart - 10;

          if (fret === 'X') {
            // Draw a neat 'X'
            return (
              <g key={i}>
                <line
                  x1={x - 4}
                  y1={y - 4}
                  x2={x + 4}
                  y2={y + 4}
                  stroke={lightMode ? '#ef4444' : '#f87171'}
                  strokeWidth="2"
                />
                <line
                  x1={x + 4}
                  y1={y - 4}
                  x2={x - 4}
                  y2={y + 4}
                  stroke={lightMode ? '#ef4444' : '#f87171'}
                  strokeWidth="2"
                />
              </g>
            );
          } else if (fret === 0) {
            // Draw a neat 'O'
            const isRoot = checkRoot(i, 0);
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="4.5"
                fill="none"
                stroke={isRoot ? '#ef4444' : (lightMode ? '#10b981' : '#34d399')}
                strokeWidth="2"
              />
            );
          }
          return null;
        })}

        {/* Draw Barrés */}
        {barres.map((barre, idx) => {
          const minX = xStart + barre.minCol * xSpacing;
          const fretPos = barre.fret - startFret;
          const y = yStart + fretPos * ySpacing + ySpacing / 2;

          return (
            <rect
              key={idx}
              x={minX - 5}
              y={y - 5.5}
              width={(barre.maxCol - barre.minCol) * xSpacing + 10}
              height="11"
              rx="5.5"
              fill={dotColor}
              stroke={dotStroke}
              strokeWidth="0.8"
            />
          );
        })}

        {/* Draw Pressed Frets (Fingers) */}
        {displayStrings.map((fret, i) => {
          if (typeof fret === 'number' && fret > 0) {
            // Check if this fret position is covered by a barre
            const isCoveredByBarre = barres.some(
              b => b.fret === fret && i >= b.minCol && i <= b.maxCol
            );
            if (isCoveredByBarre) return null;

            const x = xStart + i * xSpacing;
            // Map fret to dynamic range position
            const fretPos = fret - startFret;
            if (fretPos >= 0 && fretPos < numFrets) {
              const y = yStart + fretPos * ySpacing + ySpacing / 2;
              const isRoot = checkRoot(i, fret as number);
              const currentDotColor = isRoot ? '#ef4444' : dotColor;
              const currentDotStroke = isRoot ? (lightMode ? '#18181b' : '#b91c1c') : dotStroke;

              return (
                <g key={i}>
                  <circle
                    cx={x}
                    cy={y}
                    r="6.5"
                    fill={currentDotColor}
                    stroke={currentDotStroke}
                    strokeWidth="1"
                    className={lightMode ? '' : 'shadow-glow'}
                  />
                  {/* Subtle white center for screen theme, solid for light */}
                  {!lightMode && (
                    <circle
                      cx={x}
                      cy={y}
                      r="1.5"
                      fill="#ffffff"
                    />
                  )}
                </g>
              );
            }
          }
          return null;
        })}
        </svg>
      </div>
    </div>
  );
};
