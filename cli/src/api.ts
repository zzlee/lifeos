import axios from 'axios';
import { config } from './config';

export const api = axios.create({
  baseURL: config.get('apiUrl'),
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((req) => {
  const key = config.get('apiKey');
  if (key) {
    req.headers.Authorization = `Bearer ${key}`;
  }
  return req;
});
