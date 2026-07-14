import { Chord } from 'tonal';
import { generateGuitarVoicings } from './src/utils/music';

const testChords = ['Cadd9', 'C6', 'Caug', 'Cdim7'];

for (const chordName of testChords) {
  const voicings = generateGuitarVoicings(chordName);
  console.log(`Chord: ${chordName}`);
  console.log(`Notes: ${Chord.get(chordName).notes.join(', ')}`);
  console.log(`Voicings found: ${voicings.length}`);
  if (voicings.length > 0) {
    console.log(`Top 3 voicings:`);
    voicings.slice(0, 3).forEach(v => console.log(JSON.stringify(v)));
  } else {
    console.log('No voicings found!');
  }
  console.log('---');
}
