import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.prospecta.crm',
  appName: 'Prospecta GSM',
  webDir: 'build',
  android: {
    allowMixedContent: true
  }
};

export default config;
