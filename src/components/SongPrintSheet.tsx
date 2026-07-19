import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ParsedSong } from '../utils/chordpro';

/**
 * UX-004 — Impression / PDF d'une chanson du chansonnier.
 * A4 portrait, noir sur blanc, accords en gras au-dessus des paroles.
 * window.print() → le dialogue permet d'imprimer ou d'enregistrer en PDF.
 */

interface SongPrintSheetProps {
  song: ParsedSong;
  /** transposition appliquée à chaque accord (même fonction que l'aperçu) */
  tr: (chord: string) => string;
  transpose: number;
  onDone: () => void;
}

export function SongPrintSheet({ song, tr, transpose, onDone }: SongPrintSheetProps) {
  useEffect(() => {
    document.body.classList.add('printing-song');
    const after = () => onDone();
    window.addEventListener('afterprint', after);
    const id = window.setTimeout(() => window.print(), 150);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('afterprint', after);
      document.body.classList.remove('printing-song');
    };
  }, [onDone]);

  return createPortal(
    <div className="song-print-sheet">
      {/* Le portrait doit l'emporter sur le paysage des gammes (feuille montée en dernier) */}
      <style>{'@page { size: A4 portrait; margin: 14mm; }'}</style>

      <div style={{ borderBottom: '2px solid #000', paddingBottom: '3mm', marginBottom: '5mm' }}>
        <div style={{ fontSize: '18pt', fontWeight: 900 }}>{song.title || 'Sans titre'}</div>
        <div style={{ fontSize: '10pt', fontWeight: 600, color: '#444', marginTop: '1mm' }}>
          {song.artist || ''}
          {song.key && <span style={{ marginLeft: '5mm' }}>Clé : {tr(song.key)}</span>}
          {song.capo ? <span style={{ marginLeft: '5mm' }}>Capo {song.capo}</span> : null}
          {transpose !== 0 && (
            <span style={{ marginLeft: '5mm' }}>Transposé {transpose > 0 ? '+' : ''}{transpose}</span>
          )}
        </div>
      </div>

      {song.sections.map((section, sIdx) => (
        <div
          key={sIdx}
          style={
            section.type !== 'plain'
              ? { borderLeft: '3px solid #000', paddingLeft: '4mm', margin: '4mm 0' }
              : { margin: '2mm 0' }
          }
        >
          {section.type !== 'plain' && (
            <div style={{ fontSize: '8pt', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1mm' }}>
              {section.label}
            </div>
          )}
          {section.lines.map((line, lIdx) => {
            if (line.kind === 'empty') return <div key={lIdx} style={{ height: '4mm' }} />;
            if (line.kind === 'comment')
              return (
                <div key={lIdx} style={{ fontSize: '9pt', fontStyle: 'italic', color: '#555', margin: '1mm 0' }}>
                  {line.text}
                </div>
              );
            const hasChords = line.segments.some((s) => s.chord);
            return (
              <div key={lIdx} style={{ marginBottom: '1.5mm', breakInside: 'avoid' }}>
                {line.segments.map((seg, i) => (
                  <span key={i} style={{ display: 'inline-block', verticalAlign: 'bottom', whiteSpace: 'pre-wrap' }}>
                    {hasChords && (
                      <span
                        style={{
                          display: 'block',
                          fontFamily: 'monospace',
                          fontSize: '9pt',
                          fontWeight: 800,
                          lineHeight: '11pt',
                          height: '11pt',
                          whiteSpace: 'pre',
                        }}
                      >
                        {seg.chord ? tr(seg.chord) : ' '}
                      </span>
                    )}
                    <span style={{ fontSize: '11pt', lineHeight: '14pt' }}>{seg.text || ' '}</span>
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      ))}
    </div>,
    document.body
  );
}
