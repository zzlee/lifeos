import Conf from 'conf';

export const config = new Conf({
  projectName: 'lifeos-cli',
  defaults: {
    apiKey: '',
    apiUrl: 'https://lifeos-worker.zzlee-tw.workers.dev'
  }
});
