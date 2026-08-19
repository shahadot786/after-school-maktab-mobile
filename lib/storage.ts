import { createMMKV } from 'react-native-mmkv';
import * as SecureStore from 'expo-secure-store';

export const storage = createMMKV();

export interface Survey {
  _id?: string;
  form_no?: string;
  survey_date: string;
  surveyor: string;
  branch: string;
  status: 'submit' | 'review' | 'recommend' | 'cancel';
  student_type: string;
  student_name: string;
  age: number;
  gender: string;
  class: string;
  years: number;
  student_performance: string;
  district: string;
  thana: string;
  address: string;
  father_name: string;
  father_phone: string;
  father_job: string;
  father_job_other?: string;
  mother_status: string;
  mother_phone: string;
  family_size: number;
  earners: number;
  monthly_income: number;
  house: string;
  house_label?: string;
  land: string;
  debt: string;
  debt_label?: string;
  problems: string[];
  problems_text?: string;
  child_work: string;
  child_work_details?: string;
  other_help: string;
  other_help_org?: string;
  visited: string;
  remarks?: string;
  recommendations: string[];
  recommendations_text?: string;
  recommender_name?: string;
  recommender_identity?: string;
  score?: number;
  score_level?: string;
  saved_at?: string;
  isOfflinePending?: boolean; // Custom local UI flag
}

export interface AuthSession {
  username: string;
  role: 'admin' | 'surveyor';
  isLoggedIn: boolean;
}

// ── Auth Storage (with SecureStore backup for safety) ────────────────────────
export async function getAuthSession(): Promise<AuthSession | null> {
  try {
    const sessionStr = storage.getString('auth_session');
    if (sessionStr) {
      return JSON.parse(sessionStr);
    }
    // Fallback to SecureStore
    const secureStr = await SecureStore.getItemAsync('auth_session');
    if (secureStr) {
      storage.set('auth_session', secureStr);
      return JSON.parse(secureStr);
    }
  } catch (e) {
    console.error('Failed to get auth session', e);
  }
  return null;
}

export async function setAuthSession(session: AuthSession): Promise<void> {
  const sessionStr = JSON.stringify(session);
  storage.set('auth_session', sessionStr);
  await SecureStore.setItemAsync('auth_session', sessionStr);
}

export async function clearAuthSession(): Promise<void> {
  storage.remove('auth_session');
  await SecureStore.deleteItemAsync('auth_session');
}

// ── Survey Draft Management ──────────────────────────────────────────────────
export function getSurveyDraft(): Partial<Survey> | null {
  const draftStr = storage.getString('survey_draft');
  if (draftStr) {
    try {
      return JSON.parse(draftStr);
    } catch {
      return null;
    }
  }
  return null;
}

export function saveSurveyDraft(draft: Partial<Survey>): void {
  storage.set('survey_draft', JSON.stringify(draft));
}

export function clearSurveyDraft(): void {
  storage.remove('survey_draft');
}

// ── Offline Queue (Unsynchronized Surveys) ──────────────────────────────────
export function getOfflineQueue(): Survey[] {
  const queueStr = storage.getString('offline_queue');
  if (queueStr) {
    try {
      return JSON.parse(queueStr);
    } catch {
      return [];
    }
  }
  return [];
}

export function addToOfflineQueue(survey: Survey): void {
  const queue = getOfflineQueue();
  const targetId = survey._id || `local_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const surveyWithId = {
    ...survey,
    _id: targetId,
    isOfflinePending: true,
  };
  const existingIdx = queue.findIndex(s => s._id === targetId);
  if (existingIdx > -1) {
    queue[existingIdx] = surveyWithId;
  } else {
    queue.push(surveyWithId);
  }
  storage.set('offline_queue', JSON.stringify(queue));
}

export function removeFromOfflineQueue(id: string): void {
  const queue = getOfflineQueue();
  const filtered = queue.filter(s => s._id !== id);
  storage.set('offline_queue', JSON.stringify(filtered));
}

export function clearOfflineQueue(): void {
  storage.remove('offline_queue');
}

// ── Cached Surveys (Dashboard Cache) ─────────────────────────────────────────
export function getCachedSurveys(): Survey[] {
  const cacheStr = storage.getString('cached_surveys');
  if (cacheStr) {
    try {
      return JSON.parse(cacheStr);
    } catch {
      return [];
    }
  }
  return [];
}

export function saveCachedSurveys(surveys: Survey[]): void {
  storage.set('cached_surveys', JSON.stringify(surveys));
}

export function clearCachedSurveys(): void {
  storage.remove('cached_surveys');
}
