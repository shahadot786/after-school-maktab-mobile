import axios from 'axios';
import { getAuthSession } from './storage';

export const API_BASE_URL = 'https://after-school-maktab.getsnaptool.com';

// Automatically inject session cookie in Axios headers for Next.js auth middleware compatibility
axios.interceptors.request.use(
  async (config) => {
    try {
      const session = await getAuthSession();
      if (session && session.isLoggedIn && session.username) {
        if (config.headers) {
          if (typeof config.headers.set === 'function') {
            config.headers.set('Cookie', `session=${session.username}`);
          } else {
            config.headers['Cookie'] = `session=${session.username}`;
          }
        }
      }
    } catch (e) {
      console.error('Error attaching cookie to request:', e);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const COLORS = {
  primary: '#1a4731',       // Dark Green
  primaryLight: '#2c6b4d',  // Lighter Green for buttons/headers
  secondary: '#1a6b8a',     // Slate blue/teal
  accent: '#c9a84c',        // Gold
  background: '#f8faf9',    // Very light green/gray
  cardBg: '#ffffff',
  text: '#2c3e50',
  textLight: '#7f8c8d',
  border: '#e8f5ee',
  white: '#ffffff',
  
  // Status Colors
  submit: '#888888',
  review: '#2980b9',
  recommend: '#27ae60',
  cancel: '#c0392b',
};

export const STATUS_LABELS: Record<string, string> = {
  submit: 'সাবমিট',
  review: 'রিভিউ',
  recommend: 'সুপারিশ',
  cancel: 'বাতিল',
};

export const SURVEYORS = ['মোঃ আশিকুর রহমান', 'মোঃ দিদার আহমাদ', 'আহমাদ হোসেন', 'মোঃ মাহমুদ'];
export const BRANCHES = ['মাক্কি মসজিদ শাখা', 'মুক্তিযুদ্ধা রোড শাখা', 'অন্যান্য শাখা'];
export const JOBS = ['কৃষক', 'দিনমজুর', 'রিকশা/ভ্যান', 'ব্যবসা', 'চাকরি', 'প্রবাসী', 'অসুস্থ/অক্ষম', 'মৃত', 'অন্যান্য'];
export const PROBLEMS = ['বই কিনতে পারে না', 'পোশাক নেই', 'পুষ্টিকর খাবার পায় না', 'পড়ার আলো নেই', 'ঘন ঘন অসুস্থ', 'কাজে যেতে হয়', 'পরীক্ষার ফি নেই', 'অন্যান্য'];
export const RECS = ['মাসিক বৃত্তি', 'বই ও স্টেশনারি', 'পোশাক', 'খাদ্য সহায়তা', 'চিকিৎসা সহায়তা', 'ঈদ সহায়তা'];
