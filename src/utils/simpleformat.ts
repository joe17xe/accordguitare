import { Chord } from 'tonal';

/**
 * UX-004 — Format « simple » du chansonnier : les accords s'écrivent sur une
 * ligne AU-DESSUS des paroles, alignés au-dessus des mots (police mono).
 * Conversion bidirectionnelle avec le format ChordPro stocké — l'aperçu et la
 * transposition continuent de fonctionner à l'identique.
 */

export interface SimpleSong {
  title: string;
  artist: string;
  key: string;
  body: string;
}

// Marqueurs lisibles ↔ directives ChordPro
const MARKER_TO_DIRECTIVE: Record<string, string> = {
  '[REFRAIN]': '{soc}',
  '[/REFRAIN]': '{eoc}',
  '[PONT]': '{sob}',
  '[/PONT]': '{eob}',
  '[COUPLET]': '{sov}',
  '[/COUPLET]': '{eov}',
};
const DIRECTIVE_TO_MARKER: Record<string, string> = {
  soc: '[REFRAIN]', start_of_chorus: '[REFRAIN]',
  eoc: '[/REFRAIN]', end_of_chorus: '[/REFRAIN]',
  sob: '[PONT]', start_of_bridge: '[PONT]',
  eob: '[/PONT]', end_of_bridge: '[/PONT]',
  sov: '[COUPLET]', start_of_verse: '[COUPLET]',
  eov: '[/COUPLET]', end_of_verse: '[/COUPLET]',
};

/** Un jeton ressemble-t-il à un accord ? (Am7, F#m7b5, C/G, Bb…) */
export function isChordToken(token: string): boolean {
  const t = token.trim();
  if (!/^[A-G](#|b)?[A-Za-z0-9#b°ø+()\-Δ]*(\/[A-G](#|b)?)?$/.test(t)) return false;
  const main = t.split('/')[0];
  if (/^[A-G](#|b)?$/.test(main)) return true; // fondamentale seule
  return !Chord.get(main).empty; // valide le suffixe (rejette « Dans », « Belle »…)
}

function isChordLine(line: string): boolean {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  return tokens.length > 0 && tokens.every(isChordToken);
}

/* ---------- ChordPro → Simple ---------- */

export function chordProToSimple(content: string): SimpleSong {
  const out: string[] = [];
  let title = '';
  let artist = '';
  let key = '';

  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trimEnd();
    const directive = line.match(/^\s*\{([^:}]+)(?::\s*([^}]*))?\}\s*$/);

    if (directive) {
      const name = directive[1].trim().toLowerCase();
      const value = (directive[2] || '').trim();
      if (name === 'title' || name === 't') { title = value; continue; }
      if (name === 'artist' || name === 'subtitle' || name === 'st') { artist = value; continue; }
      if (name === 'key') { key = value; continue; }
      if (name === 'comment' || name === 'c' || name === 'ci' || name === 'cb') { out.push(`# ${value}`); continue; }
      const marker = DIRECTIVE_TO_MARKER[name];
      if (marker) { out.push(marker); continue; }
      out.push(line); // directive inconnue ({capo: 2}…) conservée telle quelle
      continue;
    }

    if (!line.includes('[')) { out.push(line); continue; }

    // Ligne avec accords : sépare paroles et ligne d'accords alignée
    const parts = line.split(/\[([^\]]*)\]/);
    let lyric = parts[0] ?? '';
    let chordLine = '';
    for (let i = 1; i < parts.length; i += 2) {
      const chord = parts[i];
      if (chord) {
        const col = Math.max(lyric.length, chordLine.length + (chordLine ? 1 : 0));
        chordLine = chordLine.padEnd(col, ' ') + chord;
      }
      lyric += parts[i + 1] ?? '';
    }
    if (chordLine) out.push(chordLine);
    if (lyric.trim() !== '' || !chordLine) out.push(lyric);
  }

  // Supprime les lignes vides de tête/queue superflues
  while (out.length && out[0].trim() === '') out.shift();
  while (out.length && out[out.length - 1].trim() === '') out.pop();

  return { title, artist, key, body: out.join('\n') };
}

/* ---------- Simple → ChordPro ---------- */

export function simpleToChordPro(song: SimpleSong): string {
  const head: string[] = [];
  if (song.title.trim()) head.push(`{title: ${song.title.trim()}}`);
  if (song.artist.trim()) head.push(`{artist: ${song.artist.trim()}}`);
  if (song.key.trim()) head.push(`{key: ${song.key.trim()}}`);

  const lines = song.body.split(/\r?\n/);
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    const trimmed = line.trim();

    const marker = MARKER_TO_DIRECTIVE[trimmed.toUpperCase()];
    if (marker) { out.push(marker); continue; }
    if (trimmed.startsWith('#')) { out.push(`{c: ${trimmed.replace(/^#\s*/, '')}}`); continue; }
    if (/^\{[^}]*\}$/.test(trimmed)) { out.push(trimmed); continue; }
    if (trimmed === '') { out.push(''); continue; }

    if (isChordLine(line)) {
      const next = i + 1 < lines.length ? lines[i + 1].trimEnd() : '';
      const nextTrim = next.trim();
      const nextIsLyric =
        nextTrim !== '' &&
        !isChordLine(next) &&
        !MARKER_TO_DIRECTIVE[nextTrim.toUpperCase()] &&
        !nextTrim.startsWith('#') &&
        !/^\{[^}]*\}$/.test(nextTrim);

      // Positions (colonne) de chaque accord dans la ligne
      const tokens: { chord: string; col: number }[] = [];
      const re = /\S+/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(line)) !== null) tokens.push({ chord: m[0], col: m.index });

      if (nextIsLyric) {
        // Insère chaque [accord] dans la ligne de paroles, à sa colonne
        let lyric = next;
        for (const { chord, col } of [...tokens].sort((a, b) => b.col - a.col)) {
          if (lyric.length < col) lyric = lyric.padEnd(col, ' ');
          lyric = lyric.slice(0, col) + `[${chord}]` + lyric.slice(col);
        }
        out.push(lyric);
        i++; // la ligne de paroles est consommée
      } else {
        out.push(tokens.map((t) => `[${t.chord}]`).join(' '));
      }
      continue;
    }

    out.push(line);
  }

  return [...head, ...(head.length ? [''] : []), ...out].join('\n') + '\n';
}
