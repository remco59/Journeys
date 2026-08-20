import type { CapacitorConfig } from '@capacitor/cli';

const PRODUCTION_URL = 'https://journeys.remcoland.nl';

const config: CapacitorConfig = {
  appId: 'com.remcoland.journeys',
  appName: 'Journeys',
  webDir: 'capacitor/www',
  server: {
    url: PRODUCTION_URL,
    androidScheme: 'https',
    allowNavigation: [new URL(PRODUCTION_URL).hostname],
    errorPath: 'offline.html'
  }
};

export default config;
