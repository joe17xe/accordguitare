import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'cloud.joefr.fretbywood',
  appName: 'FretByW00d',
  webDir: 'dist',
  backgroundColor: '#0A0C0B',
  server: {
    androidScheme: 'https',
  },
};

export default config;
