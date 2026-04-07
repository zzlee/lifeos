import Conf from 'conf';

const envApiKey = process.env.LIFEOS_API_KEY;
const envApiUrl = process.env.LIFEOS_API_URL;

export const config = new Conf({
  projectName: 'lifeos-cli',
  defaults: {
    apiKey: envApiKey || '',
    apiUrl: envApiUrl || 'https://lifeos-worker.zzlee-tw.workers.dev'
  }
});

export function getApiKey(): string {
  return envApiKey || config.get('apiKey') as string;
}

export function getApiUrl(): string {
  return envApiUrl || config.get('apiUrl') as string;
}
