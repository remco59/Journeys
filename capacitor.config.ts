import type { CapacitorConfig } from '@capacitor/cli';

// TODO: replace with the real production origin once confirmed.
const PRODUCTION_URL = 'https://journeys.example.com';

const config: CapacitorConfig = {
  appId: 'com.remcoland.journeys',
  appName: 'Journeys',
  webDir: 'public',
  server: {
    url: PRODUCTION_URL,
    androidScheme: 'https',
    allowNavigation: [new URL(PRODUCTION_URL).hostname]
  }
};

export default config;
