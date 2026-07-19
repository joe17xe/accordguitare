import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, Pencil, Eye, ArrowLeft, Play, X, ChevronsDown, RotateCcw, BookOpen } from 'lucide-react';
import { Chord } from 'tonal';
import { parseChordPro, transposeChordName, collectChords, prefersFlats } from '../utils/chordpro';
import type { ParsedSong } from '../utils/chordpro';
import { suggestGuitarVoicing, suggestPianoVoicing, STANDARD_MIDIS } from '../utils/music';
import { initAudio, getAudioCtx, strumGuitarAt, playPianoChordAt } from '../utils/audio';
import { ChordDiagram } from './ChordDiagram';

interface StoredSong {
  id: string;
  content: string;
  transpose: number;
  updatedAt: number;
}

const STORAGE_KEY = 'fretbywood-songs-v1';

const EXAMPLE_SONG = `{title: À la claire fontaine}
{artist: Traditionnel}
{key: G}

[G]À la claire fon[D]taine, [G]m'en allant prome[D]ner,
[G]J'ai trouvé l'eau si [C]belle que [D]je m'y suis bai[G]gné.

{soc}
Il y a [G]longtemps que je [C]t'aime,
ja[D]mais je ne t'oublie[G]rai.
{eoc}

[G]Sous les feuilles d'un [D]chêne, [G]je me suis fait sé[D]cher,
[G]sur la plus haute [C]branche, un [D]rossignol chan[G]tait.
`;

const NEW_SONG_TEMPLATE = `{title: Nouvelle chanson}
{artist: }
{key: C}

[C]Première ligne avec des [G]accords,
[Am]suite des paroles [F]ici.

{soc}
[F]Ici le re[G]frain de la chan[C]son.
{eoc}
`;

function loadSongs(): StoredSong[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** Titre/artiste extraits sans parser toute la chanson (pour la liste) */
function metaOf(content: string): { title: string; artist: string } {
  const t = content.match(/\{(?:title|t):\s*([^}]*)\}/i);
  const a = content.match(/\{(?:artist|subtitle|st):\s*([^}]*)\}/i);
  return { title: (t?.[1] || 'Sans titre').trim() || 'Sans titre', artist: (a?.[1] || '').trim() };
}

interface SongViewProps {
  song: ParsedSong;
  tr: (chord: string) => string;
  onChordClick: (chord: string) => void;
}

function SongView({ song, tr, onChordClick }: SongViewProps) {
  return (
    <div className="text-[15px]">
      {song.sections.map((section, sIdx) => (
        <div
          key={sIdx}
          className={
            section.type === 'chorus'
              ? 'border-l-2 border-emerald-500/60 bg-emerald-500/5 rounded-r-lg pl-4 py-2 my-4'
              : section.type === 'bridge'
                ? 'border-l-2 border-amber-500/50 bg-amber-500/5 rounded-r-lg pl-4 py-2 my-4'
                : 'my-3'
          }
        >
          {section.type !== 'plain' && (
            <div
              className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${
                section.type === 'bridge' ? 'text-amber-500/80' : 'text-emerald-500/80'
              }`}
            >
              {section.label}
            </div>
          )}
          {section.lines.map((line, lIdx) => {
            if (line.kind === 'empty') return <div key={lIdx} className="h-4"></div>;
            if (line.kind === 'comment')
              return (
                <div key={lIdx} className="text-xs italic text-zinc-500 my-1.5">
                  {line.text}
                </div>
              );
            const hasChords = line.segments.some((s) => s.chord);
            return (
              <div key={lIdx} className="mb-1.5">
                {line.segments.map((seg, i) => {
                  const disp = seg.chord ? tr(seg.chord) : '';
                  // Accord mineur (m sans \u00EAtre maj/M7\u2026) affich\u00E9 en rose, sinon \u00E9meraude
                  const isMinor = /m(?!aj)/.test(disp) && !/dim/.test(disp);
                  return (
                    <span key={i} className="inline-block align-bottom whitespace-pre-wrap">
                      {hasChords && (
                        <span
                          className={`block font-mono text-[11px] font-bold leading-4 h-4 whitespace-pre ${
                            seg.chord
                              ? `cursor-pointer ${isMinor ? 'text-tonic hover:text-tonic/80' : 'text-guitar-light hover:text-guitar'}`
                              : 'text-transparent select-none'
                          }`}
                          onClick={seg.chord ? () => onChordClick(disp) : undefined}
                        >
                          {seg.chord ? disp : '\u00A0'}
                        </span>
                      )}
                      <span className="text-ink">{seg.text || '\u00A0'}</span>
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function Songbook() {
  const [songs, setSongs] = useState<StoredSong[]>(loadSongs);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [focusChord, setFocusChord] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(3);
  const [filter, setFilter] = useState('');

  // Persistance (légèrement différée pour éviter d'écrire à chaque frappe)
  const saveTimer = useRef<number>(0);
  useEffect(() => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
      } catch { /* stockage indisponible */ }
    }, 300);
    return () => window.clearTimeout(saveTimer.current);
  }, [songs]);

  const selected = songs.find((s) => s.id === selectedId) || null;
  const parsed = useMemo(
    () => (selected ? parseChordPro(selected.content) : null),
    [selected]
  );
  const flats = useMemo(() => (parsed ? prefersFlats(parsed) : false), [parsed]);
  const t = selected?.transpose || 0;
  const tr = (c: string) => transposeChordName(c, t, flats);
  const palette = useMemo(
    () => (parsed ? collectChords(parsed).map((c) => transposeChordName(c, t, flats)) : []),
    [parsed, t, flats]
  );

  // Défilement automatique (pour jouer les mains prises)
  useEffect(() => {
    if (!autoScroll) return;
    const id = window.setInterval(() => window.scrollBy(0, 1), 210 - scrollSpeed * 20);
    return () => window.clearInterval(id);
  }, [autoScroll, scrollSpeed]);
  useEffect(() => {
    if (mode !== 'view' || !selectedId) setAutoScroll(false);
  }, [mode, selectedId]);

  const playChord = (name: string) => {
    initAudio();
    const ctx = getAudioCtx();
    if (!ctx) return;
    const shape = suggestGuitarVoicing(name);
    const midis: number[] = [];
    for (let i = 5; i >= 0; i--) {
      const f = shape[i];
      if (f !== 'X') midis.push(STANDARD_MIDIS[i] + f);
    }
    if (midis.length > 0) {
      strumGuitarAt(midis, ctx.currentTime + 0.02);
    } else {
      const notes = Chord.get(name).notes;
      if (notes.length > 0) playPianoChordAt(suggestPianoVoicing(notes), ctx.currentTime + 0.02);
    }
    setFocusChord(name);
  };

  const createSong = (content: string, openEdit: boolean) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    setSongs((prev) => [{ id, content, transpose: 0, updatedAt: Date.now() }, ...prev]);
    setSelectedId(id);
    setMode(openEdit ? 'edit' : 'view');
  };

  const deleteSong = (id: string) => {
    if (!window.confirm('Supprimer cette chanson ?')) return;
    setSongs((prev) => prev.filter((s) => s.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const updateContent = (value: string) => {
    if (!selectedId) return;
    setSongs((prev) =>
      prev.map((s) => (s.id === selectedId ? { ...s, content: value, updatedAt: Date.now() } : s))
    );
  };

  const nudgeTranspose = (delta: number) => {
    if (!selectedId) return;
    setSongs((prev) =>
      prev.map((s) =>
        s.id === selectedId
          ? { ...s, transpose: Math.max(-11, Math.min(11, (delta === 0 ? 0 : s.transpose + delta))) }
          : s
      )
    );
  };

  /* ---------- Bibliothèque ---------- */
  if (!selected) {
    const list = songs
      .filter((s) => {
        if (!filter.trim()) return true;
        const m = metaOf(s.content);
        return (m.title + ' ' + m.artist).toLowerCase().includes(filter.toLowerCase());
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);

    return (
      <main className="max-w-[900px] mx-auto animate-fadeIn">
        <div className="p-6 rounded-2xl glass-panel">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5 border-b border-zinc-800 pb-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 block"></span>
              <h2 className="text-lg font-bold text-zinc-100">Chansonnier</h2>
              <span className="text-xs text-zinc-500 font-medium">
                {songs.length} chanson{songs.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => createSong(EXAMPLE_SONG, false)}
                className="flex items-center gap-1.5 py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 text-xs font-bold transition cursor-pointer"
              >
                <BookOpen className="w-4 h-4" />
                Exemple
              </button>
              <button
                onClick={() => createSong(NEW_SONG_TEMPLATE, true)}
                className="flex items-center gap-1.5 py-2 px-4 rounded-xl font-extrabold text-xs bg-gradient-to-r from-emerald-500 to-emerald-600 text-zinc-950 shadow-lg shadow-emerald-500/15 hover:scale-105 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Nouvelle chanson
              </button>
            </div>
          </div>

          {songs.length > 3 && (
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Rechercher un titre ou un artiste…"
              className="w-full mb-4 bg-zinc-950/70 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50"
            />
          )}

          {list.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm text-zinc-400 font-semibold">
                {songs.length === 0
                  ? 'Aucune chanson pour le moment.'
                  : 'Aucun résultat pour cette recherche.'}
              </p>
              {songs.length === 0 && (
                <p className="text-xs text-zinc-600 mt-1.5">
                  Créez votre première chanson au format ChordPro, ou chargez l'exemple pour voir
                  la syntaxe.
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {list.map((s) => {
                const m = metaOf(s.content);
                return (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-emerald-500/30 transition group"
                  >
                    <button
                      onClick={() => {
                        setSelectedId(s.id);
                        setMode('view');
                      }}
                      className="flex-1 text-left cursor-pointer min-w-0"
                    >
                      <div className="font-bold text-zinc-100 truncate">{m.title}</div>
                      <div className="text-xs text-zinc-500 truncate">
                        {m.artist || '—'}
                        {s.transpose !== 0 && (
                          <span className="text-emerald-500 ml-2">
                            transposé {s.transpose > 0 ? '+' : ''}
                            {s.transpose}
                          </span>
                        )}
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        setSelectedId(s.id);
                        setMode('edit');
                      }}
                      className="p-2 rounded-lg bg-zinc-900 text-zinc-400 hover:text-emerald-400 border border-zinc-800 transition cursor-pointer"
                      title="Modifier"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteSong(s.id)}
                      className="p-2 rounded-lg bg-zinc-900 text-zinc-400 hover:text-rose-400 border border-zinc-800 transition cursor-pointer"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    );
  }

  /* ---------- Chanson ouverte ---------- */
  return (
    <main className="max-w-[900px] mx-auto animate-fadeIn">
      {/* Barre de contrôle */}
      <div className="sticky top-2 z-30 p-3 rounded-2xl glass-panel border border-zinc-800 mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedId(null)}
            className="p-2 rounded-lg bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800 transition cursor-pointer shrink-0"
            title="Retour à la bibliothèque"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-zinc-100 truncate text-sm">
              {parsed?.title || 'Sans titre'}
            </div>
            {parsed?.artist && (
              <div className="text-[11px] text-zinc-500 truncate">{parsed.artist}</div>
            )}
          </div>
          <div className="flex bg-zinc-900/80 p-0.5 rounded-lg border border-zinc-800 shrink-0">
            <button
              onClick={() => setMode('view')}
              className={`flex items-center gap-1 py-1 px-2.5 rounded-md text-xs font-bold transition cursor-pointer ${
                mode === 'view' ? 'bg-emerald-500 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Aperçu
            </button>
            <button
              onClick={() => setMode('edit')}
              className={`flex items-center gap-1 py-1 px-2.5 rounded-md text-xs font-bold transition cursor-pointer ${
                mode === 'edit' ? 'bg-emerald-500 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Pencil className="w-3.5 h-3.5" />
              Éditer
            </button>
          </div>
          <button
            onClick={() => deleteSong(selected.id)}
            className="p-2 rounded-lg bg-zinc-900 text-zinc-400 hover:text-rose-400 border border-zinc-800 transition cursor-pointer shrink-0"
            title="Supprimer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {mode === 'view' && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 pt-3 border-t border-zinc-800/70">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                Transposer
              </span>
              <button
                onClick={() => nudgeTranspose(-1)}
                className="w-6 h-6 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 font-bold text-xs hover:bg-zinc-800 transition cursor-pointer"
              >
                −
              </button>
              <span
                className={`w-8 text-center text-sm font-extrabold ${
                  t !== 0 ? 'text-emerald-400' : 'text-zinc-400'
                }`}
              >
                {t > 0 ? '+' : ''}
                {t}
              </span>
              <button
                onClick={() => nudgeTranspose(1)}
                className="w-6 h-6 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 font-bold text-xs hover:bg-zinc-800 transition cursor-pointer"
              >
                +
              </button>
              {t !== 0 && (
                <button
                  onClick={() => nudgeTranspose(0)}
                  className="p-1 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
                  title="Revenir à la tonalité d'origine"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
              {parsed?.key && (
                <span className="text-xs font-semibold text-zinc-500 ml-1">
                  Clé : <span className="text-zinc-300">{tr(parsed.key)}</span>
                </span>
              )}
              {parsed?.capo ? (
                <span className="text-xs font-semibold text-zinc-500">Capo {parsed.capo}</span>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setAutoScroll(!autoScroll)}
                className={`flex items-center gap-1.5 py-1 px-2.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                  autoScroll
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                    : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-zinc-300'
                }`}
              >
                <ChevronsDown className="w-3.5 h-3.5" />
                Défilement
              </button>
              {autoScroll && (
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={scrollSpeed}
                  onChange={(e) => setScrollSpeed(Number(e.target.value))}
                  className="w-20 accent-emerald-500 cursor-pointer"
                  title="Vitesse de défilement"
                />
              )}
            </div>

            {palette.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 w-full">
                {palette.map((c) => (
                  <button
                    key={c}
                    onClick={() => playChord(c)}
                    className="py-0.5 px-2.5 rounded-full bg-zinc-900 border border-zinc-800 hover:border-emerald-500/50 hover:bg-zinc-800 text-xs font-bold text-emerald-400 transition cursor-pointer"
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Contenu */}
      {mode === 'edit' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <p className="text-[11px] text-zinc-500 mb-2 leading-relaxed">
              <span className="font-bold text-zinc-400">Syntaxe ChordPro :</span> accords entre
              crochets dans les paroles <span className="text-emerald-500">[Am7]</span> ·
              directives <span className="text-emerald-500">{'{title: …}'}</span>{' '}
              <span className="text-emerald-500">{'{artist: …}'}</span>{' '}
              <span className="text-emerald-500">{'{key: …}'}</span>{' '}
              <span className="text-emerald-500">{'{c: commentaire}'}</span> · refrain entre{' '}
              <span className="text-emerald-500">{'{soc}'}</span> et{' '}
              <span className="text-emerald-500">{'{eoc}'}</span>, pont entre{' '}
              <span className="text-emerald-500">{'{sob}'}</span> et{' '}
              <span className="text-emerald-500">{'{eob}'}</span>.
            </p>
            <textarea
              value={selected.content}
              onChange={(e) => updateContent(e.target.value)}
              spellCheck={false}
              className="w-full min-h-[440px] bg-zinc-950/80 border border-zinc-800 rounded-xl p-4 font-mono text-[13px] leading-relaxed text-zinc-200 resize-y focus:outline-none focus:border-emerald-500/50"
            />
          </div>
          <div className="p-5 rounded-2xl glass-panel overflow-x-auto">
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-3">
              Aperçu en direct
            </div>
            {parsed && <SongView song={parsed} tr={tr} onChordClick={playChord} />}
          </div>
        </div>
      ) : (
        <div className="p-6 md:p-8 rounded-2xl glass-panel">
          {parsed && <SongView song={parsed} tr={tr} onChordClick={playChord} />}
        </div>
      )}

      {/* Accord en focus : diagramme flottant */}
      {focusChord && (
        <div className="fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:bottom-4 z-40 p-3 rounded-2xl glass-panel border border-emerald-500/30 shadow-2xl animate-fadeIn flex flex-col items-center gap-1">
          <div className="flex items-center justify-between w-full gap-3">
            <span className="font-extrabold text-emerald-400 text-sm">{focusChord}</span>
            <button
              onClick={() => setFocusChord(null)}
              className="p-1 rounded-md text-zinc-500 hover:text-zinc-200 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <ChordDiagram
            strings={suggestGuitarVoicing(focusChord)}
            name=""
            lightMode={false}
            rootNote={Chord.get(focusChord).tonic || undefined}
            showRootNote={true}
            scale={0.85}
          />
          <button
            onClick={() => playChord(focusChord)}
            className="flex items-center gap-1 py-1 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-emerald-400 border border-emerald-500/20 text-xs font-bold transition cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            Réécouter
          </button>
        </div>
      )}
    </main>
  );
}
