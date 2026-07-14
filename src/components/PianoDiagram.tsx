import React from 'react';

interface PianoDiagramProps {
  notes: number[]; // Active MIDI note numbers
  lightMode?: boolean; // If true, rendering is high-contrast black-and-white for printing
  scale?: number;
}

export const PianoDiagram: React.FC<PianoDiagramProps> = ({ notes, lightMode = false, scale = 1.0 }) => {
  const whiteKeyChromas = [0, 2, 4, 5, 7, 9, 11]; // C, D, E, F, G, A, B
  const baseMidi = 60; // Start at C4 (MIDI 60)
  const totalWhiteKeys = 14; // 2 octaves (C4 to B5)

  // Build white keys data
  const whiteKeys = Array.from({ length: totalWhiteKeys }).map((_, wIdx) => {
    const octave = Math.floor(wIdx / 7);
    const noteInOctave = wIdx % 7;
    const chroma = whiteKeyChromas[noteInOctave];
    const midi = baseMidi + octave * 12 + chroma;
    return { wIdx, midi };
  });

  // Build black keys data (centered on white key boundaries)
  const blackKeys: { x: number; midi: number }[] = [];
  for (let oct = 0; oct < 2; oct++) {
    const octaveStartWhiteIdx = oct * 7;
    const octaveBlackKeys = [
      { boundaryOffset: 1, chroma: 1 },  // C#
      { boundaryOffset: 2, chroma: 3 },  // D#
      { boundaryOffset: 4, chroma: 6 },  // F#
      { boundaryOffset: 5, chroma: 8 },  // G#
      { boundaryOffset: 6, chroma: 10 }, // A#
    ];

    octaveBlackKeys.forEach((key) => {
      const boundary = octaveStartWhiteIdx + key.boundaryOffset;
      const x = boundary * 11 - 3.5; // 11px white key width, black key is 7px wide (centered: offset -3.5px)
      const midi = baseMidi + oct * 12 + key.chroma;
      blackKeys.push({ x, midi });
    });
  }

  // Color tokens
  const activeColor = lightMode ? '#059669' : '#10b981'; // emerald-600 vs emerald-500
  const whiteKeyColor = lightMode ? '#ffffff' : 'rgba(255, 255, 255, 0.08)';
  const whiteKeyStroke = lightMode ? '#18181b' : 'rgba(255, 255, 255, 0.15)';
  const blackKeyColor = lightMode ? '#18181b' : '#18181b';
  const blackKeyStroke = lightMode ? '#000000' : 'rgba(255, 255, 255, 0.2)';

  return (
    <div 
      className={`flex flex-col items-center justify-center p-2 rounded-lg ${lightMode ? 'pdf-chord-diagram-card' : 'glass-panel'} select-none transition-all`}
      style={lightMode ? { backgroundColor: '#ffffff' } : undefined}
    >
      <div className="relative" style={{ width: `${82.55 * scale}px` }}>
        <svg 
          viewBox="0 0 154 62" 
          className="w-full h-auto block"
        >
          {/* Render White Keys */}
          {whiteKeys.map((key) => {
            const isActive = notes.includes(key.midi);
            const x = key.wIdx * 11;
            
            return (
              <rect
                key={key.midi}
                x={x}
                y={0}
                width={10}
                height={62}
                rx={1}
                fill={isActive ? activeColor : whiteKeyColor}
                stroke={whiteKeyStroke}
                strokeWidth="0.5"
              />
            );
          })}

          {/* Render Black Keys (Overlayed) */}
          {blackKeys.map((key) => {
            const isActive = notes.includes(key.midi);
            
            return (
              <rect
                key={key.midi}
                x={key.x}
                y={0}
                width={7}
                height={38}
                rx={0.8}
                fill={isActive ? activeColor : blackKeyColor}
                stroke={blackKeyStroke}
                strokeWidth="0.5"
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
};
