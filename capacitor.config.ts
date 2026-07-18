import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'cloud.joefr.fretbywood',
  appName: 'FretByW00d',
  webDir: 'dist',
  backgroundColor: '#0c0c0e',
  server: {
    androidScheme: 'https',
  },
};

export default config;
