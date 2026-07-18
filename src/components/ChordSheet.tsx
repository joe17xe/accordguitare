import { useRef, useState } from 'react';
import { detectBarres, getNoteAtFret } from '../utils/music';
import type { StringState } from '../utils/music';
import { ChordDiagram } from './ChordDiagram';
import { PianoDiagram } from './PianoDiagram';
import { Trash2, Download, FileText, Music, Sparkles, AlignLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { jsPDF } from 'jspdf';

export interface SavedChord {
  id: string;
  type?: 'chord' | 'text';
  name: string;
  strings: StringState[];
  pianoNotes?: number[];
  rootNote?: string;
  textSize?: number;
  tuningMidis?: number[];  // accordage effectif au moment de l'ajout (capo inclus)
  tuningLabel?: string;    // ex. "Drop D · Capo 2" si différent du standard
}

interface ChordSheetProps {
  savedChords: SavedChord[];
  onDeleteChord: (id: string) => void;
  onClearSheet: () => void;
  onMoveChord?: (id: string, direction: 'left' | 'right') => void;
  onAddTextSection?: (text: string) => void;
  onChangeTextSize?: (id: string, delta: number) => void;
  showRootNote?: boolean;
}

export const ChordSheet: React.FC<ChordSheetProps> = ({ savedChords, onDeleteChord, onClearSheet, onMoveChord, onAddTextSection, onChangeTextSize, showRootNote }) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState("Titre de la Musique");
  const [author, setAuthor] = useState("Artiste / Groupe");
  const [isExporting, setIsExporting] = useState(false);
  const [sheetFormat, setSheetFormat] = useState<'guitar' | 'piano' | 'double'>('guitar');
  const [chordScale, setChordScale] = useState<number>(1.0);

  // Convert strings state array to textual chord tabs notation (e.g., x32010)
  const formatTabNotation = (strings: StringState[]): string => {
    // Standard tab represents from low E (index 5) to high E (index 0)
    return [...strings]
      .reverse()
      .map((fret) => (fret === 'X' ? 'x' : fret.toString()))
      .join('');
  };

  const drawPdfPianoDiagram = (pdf: any, notes: number[], colCenter: number, y: number, currentScale: number) => {
    const scale = 0.78 * currentScale;
    const whiteKeyWidth = 2.0 * scale;
    const whiteKeyHeight = 12.0 * scale;
    const blackKeyWidth = 1.3 * scale;
    const blackKeyHeight = 7.5 * scale;
    const yStart = y;
    
    const totalWidth = 14 * whiteKeyWidth;
    const startX = colCenter - totalWidth / 2;
    
    const whiteKeyChromas = [0, 2, 4, 5, 7, 9, 11];
    const baseMidi = 60; // C4
    
    // Draw white keys
    pdf.setLineWidth(0.18 * scale);
    pdf.setDrawColor(161, 161, 170); // Zinc-400
    for (let wIdx = 0; wIdx < 14; wIdx++) {
      const octave = Math.floor(wIdx / 7);
      const noteInOctave = wIdx % 7;
      const chroma = whiteKeyChromas[noteInOctave];
      const midi = baseMidi + octave * 12 + chroma;
      
      const isPressed = notes.includes(midi);
      const kx = startX + wIdx * whiteKeyWidth;
      
      if (isPressed) {
        pdf.setFillColor(5, 150, 105); // emerald-600
        pdf.rect(kx, yStart, whiteKeyWidth, whiteKeyHeight, "FD");
      } else {
        pdf.setFillColor(255, 255, 255);
        pdf.rect(kx, yStart, whiteKeyWidth, whiteKeyHeight, "FD");
      }
    }

    // Draw black keys
    for (let oct = 0; oct < 2; oct++) {
      const octaveStartWhiteIdx = oct * 7;
      const blackKeyOffsets = [
        { boundary: 1, midiOffset: 1 },
        { boundary: 2, midiOffset: 3 },
        { boundary: 4, midiOffset: 6 },
        { boundary: 5, midiOffset: 8 },
        { boundary: 6, midiOffset: 10 },
      ];
      
      blackKeyOffsets.forEach((b) => {
        const boundary = octaveStartWhiteIdx + b.boundary;
        const kx = startX + boundary * whiteKeyWidth - blackKeyWidth / 2;
        const midi = baseMidi + oct * 12 + b.midiOffset;
        
        const isPressed = notes.includes(midi);
        
        if (isPressed) {
          pdf.setFillColor(5, 150, 105);
          pdf.setDrawColor(24, 24, 27);
          pdf.rect(kx, yStart, blackKeyWidth, blackKeyHeight, "FD");
        } else {
          pdf.setFillColor(24, 24, 27);
          pdf.setDrawColor(0, 0, 0);
          pdf.rect(kx, yStart, blackKeyWidth, blackKeyHeight, "FD");
        }
      });
    }
  };

  const drawPdfGuitarDiagram = (pdf: any, stringsState: StringState[], colCenter: number, rowY: number, chordRoot?: string, currentScale: number = 1.0, tuningMidis?: number[]) => {
    const scale = 0.6 * currentScale;
    const fretSpacing = 5.5 * scale;
    const stringSpacing = 5.0 * scale;
    const dotRadius = 1.4 * scale;
    const nutRadius = 0.8 * scale;

    const diagramWidth = 5 * stringSpacing;
    const startX = colCenter - diagramWidth / 2;

    const displayStrings = [...stringsState].reverse(); // Low E to High E
    
    const frettedValues = stringsState.filter((f): f is number => typeof f === 'number' && f > 0);
    const maxFret = frettedValues.length > 0 ? Math.max(...frettedValues) : 0;
    const minFret = frettedValues.length > 0 ? Math.min(...frettedValues) : 0;

    let startFret = 1;
    let numFrets = 5;

    if (maxFret > 5) {
      startFret = minFret;
      numFrets = Math.max(5, maxFret - minFret + 1);
    }

    const barres = detectBarres(stringsState, startFret, numFrets);
    const yStart = rowY + 5; // Reduced from rowY + 10 to bring diagram closer to chord name

    // Draw Frets
    for (let i = 0; i <= numFrets; i++) {
      const y = yStart + i * fretSpacing;
      const isNut = startFret === 1 && i === 0;
      
      if (isNut) {
        pdf.setLineWidth(1.1 * scale);
        pdf.setDrawColor(24, 24, 27);
      } else {
        pdf.setLineWidth(0.2 * scale);
        pdf.setDrawColor(161, 161, 170); // Zinc-400
      }
      pdf.line(startX, y, startX + 5 * stringSpacing, y);
    }

    // Starting fret label
    if (startFret > 1) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(6.5);
      pdf.setTextColor(5, 150, 105);
      pdf.text(`${startFret}fr`, startX - 2 * scale, yStart + fretSpacing / 2 + 1, { align: "right" });
    }

    // Draw Strings
    pdf.setLineWidth(0.2 * scale);
    pdf.setDrawColor(161, 161, 170);
    for (let i = 0; i < 6; i++) {
      const x = startX + i * stringSpacing;
      pdf.line(x, yStart, x, yStart + numFrets * fretSpacing);
    }

    // Draw open/muted signs
    displayStrings.forEach((fret, i) => {
      const stringIdx = 5 - i;
      const x = startX + i * stringSpacing;
      const y = yStart - 2.2 * scale;

      if (fret === 'X') {
        pdf.setDrawColor(239, 68, 68);
        pdf.setLineWidth(0.35 * scale);
        pdf.line(x - 1.0 * scale, y - 1.0 * scale, x + 1.0 * scale, y + 1.0 * scale);
        pdf.line(x + 1.0 * scale, y - 1.0 * scale, x - 1.0 * scale, y + 1.0 * scale);
      } else if (fret === 0) {
        const isRoot = showRootNote && chordRoot && chordRoot === getNoteAtFret(stringIdx, 0, tuningMidis)?.pc;
        if (isRoot) {
          pdf.setDrawColor(244, 63, 94); // rose-500
        } else {
          pdf.setDrawColor(16, 185, 129); // emerald-500
        }
        pdf.setLineWidth(0.35 * scale);
        pdf.circle(x, y, nutRadius, "S");
      }
    });

    // Draw Barrés
    barres.forEach((barre) => {
      const x1 = startX + barre.minCol * stringSpacing;
      const x2 = startX + barre.maxCol * stringSpacing;
      const fretPos = barre.fret - startFret;
      const y = yStart + fretPos * fretSpacing + fretSpacing / 2;

      const rectH = 2.4 * scale;
      const extension = 1.0 * scale;
      
      pdf.setFillColor(24, 24, 27);
      pdf.roundedRect(x1 - extension, y - rectH / 2, (x2 - x1) + extension * 2, rectH, rectH / 2, rectH / 2, "F");
    });

    // Draw pressed frets (fingers)
    displayStrings.forEach((fret, i) => {
      if (typeof fret === 'number' && fret > 0) {
        const stringIdx = 5 - i;
        const isCoveredByBarre = barres.some(
          b => b.fret === fret && i >= b.minCol && i <= b.maxCol
        );
        if (isCoveredByBarre) return;

        const fretPos = fret - startFret;
        if (fretPos >= 0 && fretPos < numFrets) {
          const x = startX + i * stringSpacing;
          const y = yStart + fretPos * fretSpacing + fretSpacing / 2;
          
          const isRoot = showRootNote && chordRoot && chordRoot === getNoteAtFret(stringIdx, fret, tuningMidis)?.pc;
          if (isRoot) {
            pdf.setFillColor(244, 63, 94); // rose-500
          } else {
            pdf.setFillColor(24, 24, 27); // zinc-900
          }
          pdf.circle(x, y, dotRadius, "F");
        }
      }
    });

    // Tab notation label
    const tabNotation = [...stringsState]
      .reverse()
      .map((fret) => (fret === 'X' ? 'x' : fret.toString()))
      .join('');

    pdf.setFont("courier", "bold");
    pdf.setFontSize(6.5);
    pdf.setTextColor(113, 113, 122);
    pdf.text(tabNotation, startX + 2.5 * stringSpacing, yStart + numFrets * fretSpacing + 4.5 * scale, { align: "center" });
  };

  const handleExportPDF = () => {
    if (savedChords.length === 0) return;

    setIsExporting(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageHeight = 297;
      const pageWidth = 210;
      const margin = 20;

      let currentChordIdx = 0;

      const isDouble = sheetFormat === 'double';
      const isPianoOnly = sheetFormat === 'piano';
      const isGuitarOnly = sheetFormat === 'guitar';

      const cols = isDouble ? 2 : 4;
      const colWidth = 170 / cols;
      
      const baseDiagramHeight = isPianoOnly ? 18 : 32;
      const diagramHeight = baseDiagramHeight * chordScale; 
      const rowHeight = diagramHeight + 8; // Tighter vertical gap for chords

      const drawHeader = (pdfInstance: any) => {
        pdfInstance.setFont("helvetica", "bold");
        pdfInstance.setFontSize(22);
        pdfInstance.setTextColor(24, 24, 27);
        pdfInstance.text(title, margin, 25);

        pdfInstance.setFont("helvetica", "normal");
        pdfInstance.setFontSize(10);
        pdfInstance.setTextColor(113, 113, 122);
        pdfInstance.text(author, margin, 31);

        pdfInstance.setFont("helvetica", "bold");
        pdfInstance.setFontSize(11);
        pdfInstance.setTextColor(5, 150, 105);
        pdfInstance.text("FRETBYW00D", pageWidth - margin, 24, { align: "right" });

        pdfInstance.setFont("helvetica", "normal");
        pdfInstance.setFontSize(8.5);
        pdfInstance.setTextColor(161, 161, 170);
        const dateStr = `Généré le ${new Date().toLocaleDateString('fr-FR')}`;
        pdfInstance.text(dateStr, pageWidth - margin, 30, { align: "right" });

        pdfInstance.setDrawColor(228, 228, 231);
        pdfInstance.setLineWidth(0.4);
        pdfInstance.line(margin, 36, pageWidth - margin, 36);
      };

      const drawFooter = (pdfInstance: any) => {
        pdfInstance.setFont("helvetica", "bold");
        pdfInstance.setFontSize(7.5);
        pdfInstance.setTextColor(161, 161, 170);
        
        const footerLabel = isPianoOnly 
          ? "Diagrammes d'Accords pour Piano (Clavier 2 Octaves)"
          : isDouble 
            ? "Diagrammes d'Accords pour Guitare & Piano"
            : "Diagrammes d'Accords pour Guitare (Accordage Standard EADGBE)";
        
        pdfInstance.text(footerLabel, margin, pageHeight - 12);
        
        pdfInstance.setFont("helvetica", "normal");
        pdfInstance.text("FRETBYW00D PDF Service", pageWidth - margin, pageHeight - 12, { align: "right" });
      };

      drawHeader(pdf);
      
      let colIdx = 0;
      let currentY = 48;

      while (currentChordIdx < savedChords.length) {
        const chord = savedChords[currentChordIdx];
        
        // Handle text block
        if (chord.type === 'text') {
          if (colIdx > 0) {
            colIdx = 0;
            currentY += diagramHeight + 4; // Advance tightly past previous chords
          }
          if (currentY + 20 > pageHeight - margin) {
            drawFooter(pdf);
            pdf.addPage();
            drawHeader(pdf);
            currentY = 48;
          }
          
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(chord.textSize || 15);
          pdf.setTextColor(5, 150, 105);
          
          currentY += 6; // Small margin before text
          pdf.text(chord.name.toUpperCase(), margin, currentY);
          
          currentY += 4; // Very tight gap after text before chords
          currentChordIdx++;
          continue;
        }

        // Handle chord block
        if (colIdx >= cols) {
          colIdx = 0;
          currentY += rowHeight;
        }

        if (currentY + rowHeight > pageHeight - margin - 15) {
          drawFooter(pdf);
          pdf.addPage();
          drawHeader(pdf);
          currentY = 48;
        }

        const colCenter = margin + colIdx * colWidth + colWidth / 2;
        const rowY = currentY;

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(12.5);
        pdf.setTextColor(24, 24, 27);

        if (isDouble) {
          pdf.text(chord.name, colCenter, rowY, { align: "center" });
          drawPdfGuitarDiagram(pdf, chord.strings, colCenter - 18 * chordScale, rowY, chord.rootNote, chordScale, chord.tuningMidis);
          drawPdfPianoDiagram(pdf, chord.pianoNotes || [], colCenter + 18 * chordScale, rowY + 6 * chordScale, chordScale);
        } else if (isGuitarOnly) {
          pdf.text(chord.name, colCenter, rowY, { align: "center" });
          drawPdfGuitarDiagram(pdf, chord.strings, colCenter, rowY, chord.rootNote, chordScale, chord.tuningMidis);
        } else if (isPianoOnly) {
          pdf.text(chord.name, colCenter, rowY, { align: "center" });
          drawPdfPianoDiagram(pdf, chord.pianoNotes || [], colCenter, rowY + 5 * chordScale, chordScale);
        }

        colIdx++;
        currentChordIdx++;
      }
      
      drawFooter(pdf);

      const fileName = `${title.toLowerCase().replace(/\s+/g, '-') || 'fiche-accords'}.pdf`;
      pdf.save(fileName);
    } catch (error: any) {
      console.error("Erreur lors de la génération du PDF :", error);
      alert("Une erreur est survenue lors de l'export en PDF : " + (error?.message || error?.toString() || "Erreur inconnue"));
    } finally {
      setIsExporting(false);
    }
  };

  const promptAddText = () => {
    const text = window.prompt("Nom de la section (ex: Couplet 1, Refrain, Pont) :");
    if (text && text.trim() && onAddTextSection) {
      onAddTextSection(text.trim());
    }
  };

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Configuration & Actions Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl glass-panel">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-100">Ma Partition ({savedChords.length} accord{savedChords.length > 1 ? 's' : ''})</h3>
            <p className="text-xs text-zinc-400">Configurez et exportez votre fiche de travail au format PDF.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Layout format segment buttons */}
          <div className="flex items-center gap-1 bg-zinc-900/60 p-1 rounded-lg border border-zinc-800 self-stretch sm:self-auto justify-center">
            <button
              onClick={() => setSheetFormat('guitar')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition cursor-pointer ${sheetFormat === 'guitar' ? 'bg-emerald-500 text-zinc-950 shadow-md' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              🎸 Guitare
            </button>
            <button
              onClick={() => setSheetFormat('piano')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition cursor-pointer ${sheetFormat === 'piano' ? 'bg-emerald-500 text-zinc-950 shadow-md' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              🎹 Piano
            </button>
            <button
              onClick={() => setSheetFormat('double')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition cursor-pointer ${sheetFormat === 'double' ? 'bg-emerald-500 text-zinc-950 shadow-md' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              🎼 Double
            </button>
          </div>

          <div className="flex items-center gap-1 bg-zinc-900/60 p-1 rounded-lg border border-zinc-800 self-stretch sm:self-auto justify-center px-3">
            <span className="text-xs font-bold text-zinc-400 mr-1 hidden sm:inline">Accords:</span>
            <button onClick={() => setChordScale(s => Math.max(0.4, s - 0.1))} className="p-1.5 rounded hover:bg-zinc-800 text-zinc-300 font-bold transition cursor-pointer">-</button>
            <span className="text-xs font-bold text-zinc-200 min-w-[3ch] text-center">{Math.round(chordScale * 100)}%</span>
            <button onClick={() => setChordScale(s => Math.min(1.5, s + 0.1))} className="p-1.5 rounded hover:bg-zinc-800 text-zinc-300 font-bold transition cursor-pointer">+</button>
          </div>

          <button
            onClick={promptAddText}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-sm transition cursor-pointer"
          >
            <AlignLeft className="w-4 h-4" />
            Texte
          </button>

          <button
            onClick={onClearSheet}
            disabled={savedChords.length === 0}
            className="flex-1 sm:flex-none py-2 px-4 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-sm transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Vider
          </button>
          <button
            onClick={handleExportPDF}
            disabled={isExporting || savedChords.length === 0}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-zinc-950 font-bold text-sm transition shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                <span>Génération...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Exporter en PDF</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Printable Sheet Preview (Screen representation resembling A4 paper) */}
      <div className="w-full flex justify-center">
        <div className="w-full max-w-[820px] overflow-x-auto p-4 bg-zinc-950/40 rounded-2xl border border-zinc-800">
            
            {/* The A4 Canvas Element */}
            <div 
              ref={sheetRef}
              id="pdf-sheet-container"
              className="w-[794px] min-h-[1123px] pdf-sheet p-16 shadow-2xl rounded-sm border mx-auto flex flex-col justify-between font-sans select-text relative"
              style={{ backgroundColor: '#ffffff', color: '#18181b', borderColor: '#e4e4e7' }}
            >
              
              {/* Header Details */}
              <div className="w-full border-b-2 border-zinc-900/10 pb-6 mb-8 flex justify-between items-start">
                <div className="flex-1 mr-4">
                  {/* Song Name Input */}
                  <div className="group/field mb-2 flex flex-col gap-0.5">
                    <span className="text-[10px] uppercase font-bold text-zinc-450 tracking-wider transition group-hover/field:text-zinc-500">Chanson / Musique</span>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full text-3xl font-extrabold pdf-sheet-title tracking-tight bg-transparent border-b border-zinc-200/50 hover:border-zinc-300 focus:border-emerald-500 focus:outline-none pb-0.5 transition"
                      style={{ color: '#18181b' }}
                      placeholder="Nom de la chanson"
                      title="Modifier le titre"
                    />
                  </div>
                  {/* Artist Name Input */}
                  <div className="group/field flex flex-col gap-0.5">
                    <span className="text-[9px] uppercase font-bold text-zinc-450 tracking-wider transition group-hover/field:text-zinc-500">Artiste / Groupe</span>
                    <input
                      type="text"
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                      className="w-full text-sm font-semibold pdf-sheet-subtitle bg-transparent border-b border-zinc-150 hover:border-zinc-300 focus:border-emerald-500 focus:outline-none pb-0.5 transition"
                      style={{ color: '#71717a' }}
                      placeholder="Nom de l'artiste"
                      title="Modifier l'artiste"
                    />
                  </div>
                </div>
                
                <div className="text-right flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1.5 pdf-sheet-brand font-extrabold text-base tracking-wider uppercase" style={{ color: '#059669' }}>
                    <Sparkles className="w-4 h-4" style={{ fill: '#10b981', stroke: '#059669' }} />
                    <span>FRETBYW00D</span>
                  </div>
                  <span className="text-[10px] pdf-sheet-date font-mono" style={{ color: '#a1a1aa' }}>
                    Généré le {new Date().toLocaleDateString('fr-FR')}
                  </span>
                </div>
              </div>

              {/* Main Chord Grid */}
              <div 
                className={`flex-1 w-full grid gap-x-6 gap-y-8 items-start content-start align-top ${sheetFormat === 'double' ? 'grid-cols-2' : 'grid-cols-4'}`}
              >
                {savedChords.length === 0 && (
                  <div className="col-span-full py-16 flex flex-col items-center justify-center text-zinc-400 border-2 border-dashed border-zinc-200/50 rounded-xl">
                    <Music className="w-8 h-8 mb-2 opacity-30 text-zinc-500" />
                    <p className="text-sm font-medium text-zinc-500">La partition est vide.</p>
                    <p className="text-xs text-zinc-400/70 mt-1">Cliquez sur le bouton "Texte" ou ajoutez des accords pour commencer.</p>
                  </div>
                )}
                {savedChords.map((chord) => {
                  if (chord.type === 'text') {
                    return (
                      <div key={chord.id} className={`relative group/card border-b-2 border-emerald-500/30 pb-2 mt-2 mb-0 flex items-center justify-between ${sheetFormat === 'double' ? 'col-span-2' : 'col-span-4'}`}>
                        <div style={{ fontSize: `${(chord.textSize || 15) * 1.3}px`, lineHeight: 1.2 }} className="font-black text-emerald-500 uppercase tracking-widest pdf-sheet-title">{chord.name}</div>
                        <div className="flex items-center gap-2 opacity-0 group-hover/card:opacity-100 transition" data-html2canvas-ignore>
                          {onChangeTextSize && (
                            <>
                              <button onClick={() => onChangeTextSize(chord.id, -2)} className="p-1.5 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-600 shadow-sm cursor-pointer"><span className="text-xs font-bold leading-none">A-</span></button>
                              <button onClick={() => onChangeTextSize(chord.id, 2)} className="p-1.5 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-600 shadow-sm cursor-pointer"><span className="text-xs font-bold leading-none">A+</span></button>
                            </>
                          )}
                          {onMoveChord && (
                            <>
                              <button onClick={() => onMoveChord(chord.id, 'left')} className="p-1.5 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-600 shadow-sm cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>
                              <button onClick={() => onMoveChord(chord.id, 'right')} className="p-1.5 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-600 shadow-sm cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
                            </>
                          )}
                          <button onClick={() => onDeleteChord(chord.id)} className="p-1.5 rounded bg-rose-500 hover:bg-rose-600 text-white shadow-sm cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div 
                      key={chord.id} 
                      className="relative flex flex-col items-center group/card transition-all"
                    >
                      {/* Movement & Delete Actions */}
                      <div className="absolute -top-3 -right-2 flex items-center gap-1 opacity-0 group-hover/card:opacity-100 transition duration-150 z-50" data-html2canvas-ignore>
                        {onMoveChord && (
                          <>
                            <button onClick={() => onMoveChord(chord.id, 'left')} className="p-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 shadow-md cursor-pointer" title="Déplacer à gauche"><ChevronLeft className="w-3.5 h-3.5" /></button>
                            <button onClick={() => onMoveChord(chord.id, 'right')} className="p-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 shadow-md cursor-pointer" title="Déplacer à droite"><ChevronRight className="w-3.5 h-3.5" /></button>
                          </>
                        )}
                        <button
                          onClick={() => onDeleteChord(chord.id)}
                          className="p-1.5 rounded-full bg-rose-500 hover:bg-rose-600 text-white shadow-md cursor-pointer"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                    {/* Format dependent layout rendering */}
                    {sheetFormat === 'guitar' && (
                      <ChordDiagram 
                        strings={chord.strings} 
                        name={chord.name} 
                        lightMode={true} 
                        rootNote={chord.rootNote}
                        tuningMidis={chord.tuningMidis}
                        showRootNote={showRootNote}
                        scale={chordScale}
                      />
                    )}
                    {sheetFormat === 'guitar' && chord.tuningLabel && (
                      <div className="text-[9px] font-bold text-amber-600 text-center leading-tight">
                        {chord.tuningLabel}
                      </div>
                    )}
                    {sheetFormat === 'piano' && (
                      <div className="flex flex-col items-center">
                        <div className="text-sm font-bold text-zinc-900 mb-1 tracking-wide">{chord.name}</div>
                        <PianoDiagram 
                          notes={chord.pianoNotes || []} 
                          lightMode={true} 
                          scale={chordScale}
                        />
                      </div>
                    )}
                    {sheetFormat === 'double' && (
                      <div className="flex flex-col items-center gap-1">
                        <div className="text-sm font-bold text-zinc-900 mb-1 tracking-wide">{chord.name}</div>
                        <div className="flex items-center gap-3">
                          <ChordDiagram 
                            strings={chord.strings} 
                            name="" 
                            lightMode={true} 
                            rootNote={chord.rootNote}
                            tuningMidis={chord.tuningMidis}
                            showRootNote={showRootNote}
                            scale={chordScale}
                          />
                          <PianoDiagram 
                            notes={chord.pianoNotes || []} 
                            lightMode={true} 
                            scale={chordScale}
                          />
                        </div>
                      </div>
                    )}

                    {/* Tab Notation text below */}
                    {sheetFormat !== 'piano' && (
                      <div className="mt-2 text-center">
                        <span className="text-[10px] font-mono pdf-sheet-tab-badge font-bold px-2 py-0.5 rounded-full border" style={{ color: '#71717a', backgroundColor: '#f4f4f5', borderColor: '#e4e4e7' }}>
                          {formatTabNotation(chord.strings)}
                        </span>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="w-full border-t pdf-sheet-footer pt-6 mt-12 flex justify-between items-center text-[10px] font-semibold tracking-wider uppercase" style={{ borderColor: '#e4e4e7', color: '#a1a1aa' }}>
                <span>
                  {sheetFormat === 'piano' 
                    ? "Diagrammes d'Accords pour Piano (Clavier 2 Octaves)" 
                    : sheetFormat === 'double'
                      ? "Diagrammes d'Accords pour Guitare & Piano"
                      : "Diagrammes d'Accords pour Guitare (Accordage Standard EADGBE)"}
                </span>
                <span>Page 1 / 1</span>
              </div>

            </div>

          </div>
        </div>
    </div>
  );
};
