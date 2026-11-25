import axios from 'axios';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
export const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL || '/api' });
api.interceptors.request.use(config => { const token = localStorage.getItem('hyundai_token'); if (token) config.headers.Authorization = `Bearer ${token}`; return config; });
api.interceptors.response.use(r => r, err => { if (err.response?.status === 401 && !location.pathname.startsWith('/login')) { localStorage.removeItem('hyundai_token'); location.href = '/login'; } return Promise.reject(err); });
export function errorText(err: unknown): string { if (axios.isAxiosError(err)) { const message = err.response?.data?.message; return Array.isArray(message) ? message.join(', ') : message || err.message; } return err instanceof Error ? err.message : 'Something went wrong'; }
export type Document = { _id: string; fileName: string; vehicleModel: string; processingStatus: 'Pending'|'Processing'|'Completed'|'Failed'; totalPages: number; totalChunks: number; errorMessage: string; createdAt: string };
export type Source = { documentId: string; fileName: string; vehicleModel: string; pageNumber: number; section: string; excerpt: string };
export type Message = { _id: string; role: 'user'|'assistant'; content: string; sources?: Source[]; createdAt: string };
export type Conversation = { _id: string; title: string; updatedAt: string };
