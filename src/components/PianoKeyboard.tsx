import React from 'react';

interface PianoKeyboardProps {
  activeNotes: number[]; // Array of active MIDI numbers
  onToggleNote: (midi: number) => void;
}

export const PianoKeyboard: React.FC<PianoKeyboardProps> = ({ activeNotes, onToggleNote }) => {
  // Define note maps
  const whiteKeyChromas = [0, 2, 4, 5, 7, 9, 11]; // C, D, E, F, G, A, B
  const totalWhiteKeys = 21; // 3 octaves (C3 to B5)
  const baseMidi = 48; // C3 is MIDI 48

  // Generate white keys list
  const whiteKeys = Array.from({ length: totalWhiteKeys }).map((_, wIdx) => {
    const octave = Math.floor(wIdx / 7);
    const noteInOctave = wIdx % 7;
    const chroma = whiteKeyChromas[noteInOctave];
    const midi = baseMidi + octave * 12 + chroma;
    
    // Labels for Middle C and octaves
    let label = '';
    if (midi === 48) label = 'DO3';
    else if (midi === 60) label = 'DO4 (C4)';
    else if (midi === 72) label = 'DO5';

    return { wIdx, midi, label };
  });

  // Generate black keys list for 3 octaves
  const blackKeys: { x: number; midi: number }[] = [];
  for (let oct = 0; oct < 3; oct++) {
    const octaveStartWhiteIdx = oct * 7;
    
    const octaveBlackKeys = [
      { boundaryOffset: 1, chroma: 1 },  // C# / Db
      { boundaryOffset: 2, chroma: 3 },  // D# / Eb
      { boundaryOffset: 4, chroma: 6 },  // F# / Gb
      { boundaryOffset: 5, chroma: 8 },  // G# / Ab
      { boundaryOffset: 6, chroma: 10 }, // A# / Bb
    ];

    octaveBlackKeys.forEach((key) => {
      const boundary = octaveStartWhiteIdx + key.boundaryOffset;
      const x = boundary * 32 - 10; // 32px white key width, black key is 20px wide (centered: offset -10px)
      const midi = baseMidi + oct * 12 + key.chroma;
      blackKeys.push({ x, midi });
    });
  }

  return (
    <div className="w-full flex flex-col items-center select-none animate-fadeIn">
      <div className="w-full max-w-[720px] bg-zinc-950/40 p-6 rounded-2xl border border-zinc-800 shadow-xl relative backdrop-blur-md">
        <div className="flex justify-between items-center mb-4">
          <span className="text-xs uppercase font-extrabold tracking-wider text-emerald-450 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]" />
            Clavier Piano Interactif
          </span>
          <span className="text-[10px] font-mono text-zinc-500 font-bold uppercase tracking-wider">
            Do3 - Si5 (3 Octaves)
          </span>
        </div>

        {/* Keyboard SVG Container */}
        <div className="relative overflow-x-auto w-full py-1">
          <svg 
            width="672" 
            height="160" 
            viewBox="0 0 672 160" 
            className="mx-auto block rounded-xl overflow-hidden border border-zinc-950"
          >
            {/* White Keys */}
            {whiteKeys.map((key) => {
              const isActive = activeNotes.includes(key.midi);
              const x = key.wIdx * 32;
              
              return (
                <g key={key.midi} className="cursor-pointer" onClick={() => onToggleNote(key.midi)}>
                  <rect
                    x={x}
                    y={0}
                    width={31}
                    height={160}
                    rx={4}
                    className={`transition-all duration-150 ${
                      isActive 
                        ? 'fill-emerald-500 stroke-emerald-600' 
                        : 'fill-zinc-50 stroke-zinc-300 hover:fill-zinc-100'
                    }`}
                    strokeWidth="1"
                  />
                  {/* Subtle key outline details */}
                  <line 
                    x1={x + 31} 
                    y1={0} 
                    x2={x + 31} 
                    y2={160} 
                    stroke="rgba(0,0,0,0.06)" 
                    strokeWidth="1" 
                  />
                  
                  {/* Octave Labels */}
                  {key.label && (
                    <text
                      x={x + 15.5}
                      y={148}
                      textAnchor="middle"
                      className={`text-[8.5px] font-mono font-bold select-none transition-colors ${
                        isActive ? 'fill-zinc-950 font-black' : 'fill-zinc-400'
                      }`}
                    >
                      {key.label}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Black Keys (Overlayed) */}
            {blackKeys.map((key) => {
              const isActive = activeNotes.includes(key.midi);
              
              return (
                <rect
                  key={key.midi}
                  x={key.x}
                  y={0}
                  width={20}
                  height={98}
                  rx={3}
                  className={`cursor-pointer transition-all duration-150 stroke-zinc-950 ${
                    isActive 
                      ? 'fill-emerald-400 hover:fill-emerald-500 shadow-lg' 
                      : 'fill-zinc-900 hover:fill-zinc-800'
                  }`}
                  strokeWidth="1"
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent white key click
                    onToggleNote(key.midi);
                  }}
                />
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
};
