import { getNoteAtFret } from '../utils/music';
import type { StringState } from '../utils/music';

interface FretboardProps {
  strings: StringState[];
  onChange: (newStrings: StringState[]) => void;
  playedString: number | null; // For animation trigger
  showRootNote?: boolean;
  rootNote?: string;
  tuningMidis?: number[]; // accordage effectif (capo inclus) ; standard par défaut
}

export const Fretboard = ({ strings, onChange, playedString, showRootNote, rootNote, tuningMidis }: FretboardProps) => {
  const totalFrets = 24;

  // Handle clicking a fret cell
  const handleFretClick = (stringIndex: number, fretNum: number) => {
    const updated = [...strings];
    const currentFret = updated[stringIndex];

    if (currentFret === fretNum) {
      // Toggle off -> returns to open (0)
      updated[stringIndex] = 0;
    } else {
      // Toggle on -> set to clicked fret
      updated[stringIndex] = fretNum;
    }
    onChange(updated);
  };

  // Handle clicking the nut indicator (left side)
  const handleNutClick = (stringIndex: number) => {
    const updated = [...strings];
    const currentFret = updated[stringIndex];

    if (typeof currentFret === 'number' && currentFret > 0) {
      // If a finger was on the string, clear it and mute (X)
      updated[stringIndex] = 'X';
    } else if (currentFret === 'X') {
      // If muted, switch to open (0)
      updated[stringIndex] = 0;
    } else {
      // If open, switch to muted (X)
      updated[stringIndex] = 'X';
    }
    onChange(updated);
  };

  // Check if a fret should have an inlay dot
  const getInlayType = (fret: number): 'single' | 'double' | null => {
    if ([3, 5, 7, 9, 15, 17, 19, 21].includes(fret)) return 'single';
    if ([12, 24].includes(fret)) return 'double';
    return null;
  };

  // Get string thickness in pixels
  const getStringThickness = (stringIndex: number): number => {
    // String 0 (High E) is thin, String 5 (Low E) is thick
    const thicknesses = [1.5, 2.0, 2.5, 3.2, 4.0, 5.0];
    return thicknesses[stringIndex];
  };

  return (
    <div className="w-full overflow-x-auto py-6">
      {/* Scroll instruction for smaller screens */}
      <div className="flex md:hidden items-center justify-center gap-1 text-xs text-zinc-400 mb-2">
        <span>← Faites glisser pour voir tout le manche →</span>
      </div>

      <div className="min-w-[1500px] mx-auto px-4">
        {/* Fret number indicators */}
        <div className="grid grid-cols-[60px_repeat(24,1fr)] gap-0 text-center mb-2">
          {/* Nut column */}
          <div className="text-zinc-500 font-bold text-xs uppercase">Corde</div>
          {/* Fret columns */}
          {Array.from({ length: totalFrets }).map((_, i) => (
            <div key={i} className="text-zinc-400 text-sm font-semibold">
              {i + 1}
            </div>
          ))}
        </div>

        {/* Fretboard main board */}
        <div className="relative fretboard-wood rounded-lg border-y-2 border-emerald-950/40 select-none">
          
          {/* Fretboard background grid for layout spacing */}
          <div className="grid grid-cols-[60px_repeat(24,1fr)] gap-0 h-[260px] relative">
            
            {/* 1. Nut Column (Sillet) */}
            <div className="relative border-r-[6px] border-zinc-300/90 h-full flex flex-col justify-between py-2 bg-[#121215]/80">
              {strings.map((fret, stringIdx) => {
                const noteInfo = getNoteAtFret(stringIdx, fret, tuningMidis);
                const isOpen = fret === 0;
                const isMuted = fret === 'X';
                const isRoot = showRootNote && rootNote === noteInfo?.pc;

                return (
                  <div 
                    key={stringIdx} 
                    className="h-8 flex items-center justify-center relative z-10"
                  >
                    <button
                      onClick={() => handleNutClick(stringIdx)}
                      className={`
                        w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-md cursor-pointer
                        ${isOpen 
                          ? (isRoot ? 'bg-rose-500/20 text-rose-400 border-rose-500/50 hover:bg-rose-500/35 hover:scale-105 shadow-rose-500/10' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/35 hover:scale-105 shadow-emerald-500/10')
                          : isMuted 
                          ? 'bg-rose-500/10 text-rose-500 border border-rose-500/30 hover:bg-rose-500/20 hover:scale-105' 
                          : (isRoot ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50 hover:bg-rose-500/35 hover:scale-105 shadow-rose-500/10' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/35 hover:scale-105 shadow-emerald-500/10')
                        }
                      `}
                      title={isOpen ? "Corde jouée à vide" : isMuted ? "Corde étouffée (non jouée)" : `Corde frettée (${noteInfo?.pc})`}
                    >
                      {isOpen ? 'O' : isMuted ? 'X' : noteInfo?.pc}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* 2. Fretted Columns */}
            {Array.from({ length: totalFrets }).map((_, fretIdx) => {
              const fretNum = fretIdx + 1;
              const inlay = getInlayType(fretNum);

              return (
                <div 
                  key={fretIdx} 
                  className="relative border-r border-zinc-600/40 h-full flex flex-col justify-between py-2 group"
                >
                  {/* Fret Wire overlay for visual depth */}
                  <div className="absolute right-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-zinc-300 via-zinc-400 to-zinc-300 shadow-[1px_0_2px_rgba(0,0,0,0.5)] z-0" />

                  {/* Fretboard Inlays (Pearl dots) */}
                  {inlay === 'single' && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                      <div className="w-4 h-4 rounded-full bg-zinc-300/80 shadow-[inset_1px_1px_3px_rgba(0,0,0,0.4),0_1px_2px_rgba(255,255,255,0.2)]" />
                    </div>
                  )}
                  {inlay === 'double' && (
                    <div className="absolute inset-0 flex flex-col gap-14 items-center justify-center pointer-events-none z-0">
                      <div className="w-3.5 h-3.5 rounded-full bg-zinc-300/80 shadow-[inset_1px_1px_3px_rgba(0,0,0,0.4)]" />
                      <div className="w-3.5 h-3.5 rounded-full bg-zinc-300/80 shadow-[inset_1px_1px_3px_rgba(0,0,0,0.4)]" />
                    </div>
                  )}

                  {/* String Cells within this fret */}
                  {strings.map((fret, stringIdx) => {
                    const isFrettedHere = fret === fretNum;
                    const noteInfo = getNoteAtFret(stringIdx, fretNum, tuningMidis);

                    return (
                      <div
                        key={stringIdx}
                        onClick={() => handleFretClick(stringIdx, fretNum)}
                        className="h-8 w-full flex items-center justify-center relative cursor-pointer z-10 group/cell"
                      >
                        {/* Note Hover Preview */}
                        {!isFrettedHere && (
                          <div className="absolute opacity-0 group-hover/cell:opacity-100 transition-opacity bg-zinc-800/90 text-emerald-400 border border-emerald-500/30 text-[10px] px-1.5 py-0.5 rounded shadow z-20 pointer-events-none select-none -translate-y-1">
                            {noteInfo?.pc}
                          </div>
                        )}

                        {/* Finger Placement Circle */}
                        {isFrettedHere && (() => {
                          const isRoot = showRootNote && rootNote === noteInfo?.pc;
                          return (
                            <div 
                              className={`
                                w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-extrabold text-zinc-950 z-20 transition-all duration-150 transform scale-110 shadow-lg animate-pulse
                                ${isRoot
                                  ? 'bg-gradient-to-br from-rose-300 to-rose-500 shadow-rose-500/30 ring-4 ring-rose-500/30'
                                  : 'bg-gradient-to-br from-emerald-300 to-emerald-500 shadow-emerald-500/30 ring-4 ring-emerald-500/30'
                                }
                              `}
                            >
                              {noteInfo?.pc}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* 3. Horizontal String Overlay Lines */}
            <div className="absolute inset-0 pointer-events-none flex flex-col justify-between py-2 pl-[60px] z-0">
              {Array.from({ length: 6 }).map((_, stringIdx) => {
                const thickness = getStringThickness(stringIdx);
                const isPlayed = playedString === stringIdx;

                return (
                  <div 
                    key={stringIdx} 
                    className="h-8 flex items-center w-full"
                  >
                    <div 
                      className={`
                        w-full bg-gradient-to-b from-zinc-300 via-zinc-400 to-zinc-500 shadow-sm
                        ${isPlayed ? 'vibrate-string' : ''}
                      `}
                      style={{ 
                        height: `${thickness}px`,
                        opacity: strings[stringIdx] === 'X' ? 0.35 : 0.9,
                        // Custom silver steel texture
                        boxShadow: '0 1px 1px rgba(0,0,0,0.4)'
                      }}
                    />
                  </div>
                );
              })}
            </div>

          </div>
        </div>

        {/* Fretboard legends */}
        <div className="flex justify-between items-center mt-3 text-xs text-zinc-500 px-1">
          <div className="flex gap-4">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500/20 border border-emerald-500/50 block"></span> Corde ouverte (O)</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-500/10 border border-rose-500/30 block"></span> Corde étouffée (X)</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500/30 border border-emerald-500/50 block"></span> Note frettée</span>
          </div>
          <div>
            <span>Accordage standard : E A D G B E (du bas vers le haut)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
