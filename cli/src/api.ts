import axios from 'axios';
import { getApiKey, getApiUrl } from './config';

export const api = axios.create({
  baseURL: getApiUrl(),
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((req) => {
  const key = getApiKey();
  if (key) {
    req.headers.Authorization = `Bearer ${key}`;
  }
  return req;
});
