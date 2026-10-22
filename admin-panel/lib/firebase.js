import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Public client config for Firebase project mentorlink-67926 (not secret).
const config = {
  apiKey: 'AIzaSyBhVOB4SWXMMxmVf8yECF2UBG9DOqAwTOQ',
  authDomain: 'mentorlink-67926.firebaseapp.com',
  projectId: 'mentorlink-67926',
  storageBucket: 'mentorlink-67926.firebasestorage.app',
  messagingSenderId: '766994609429',
  appId: '1:766994609429:web:47beeec6097e05fff9e51c',
};
export const app = getApps().length ? getApps()[0] : initializeApp(config);
export const auth = getAuth(app);
