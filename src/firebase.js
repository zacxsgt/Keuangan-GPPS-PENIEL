import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getMessaging } from 'firebase/messaging';

// ⚠️ GANTI dengan Firebase Config Anda dari Firebase Console
const firebaseConfig = {
    apiKey: "AIzaSyA3HSWbhpBMa-mGiAvbEWVs0riHL0qvee8",
    authDomain: "gpps-peniel-finances.firebaseapp.com",
    databaseURL: "https://gpps-peniel-finances-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "gpps-peniel-finances",
    storageBucket: "gpps-peniel-finances.firebasestorage.app",
    messagingSenderId: "638248588868",
    appId: "1:638248588868:web:56a3d67b85f520fc458e11",
    measurementId: "G-FF4TN2HR46"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const database = getDatabase(app);
export const messaging = getMessaging(app);

// VAPID Key dari Firebase Cloud Messaging
export const VAPID_KEY = "BCfZNGDlB8E_y_ylRf4lgQJqWKcTOx53ir8e-SdHLE7CdQ3k5m-35KQ85A9EV_vjw4PQ_QEfjTB4gxP4Ws9k20";

// Role mapping (untuk fallback jika Firebase roles belum di-set)
export const EMAIL_TO_ROLE = {
  'validasi@gpps.com': 'admin',
  'pembangunan@gpps.com': 'pembangunan',
  'diakonia@gpps.com': 'diakonia',
  'musik@gpps.com': 'musik',
  'jemaat@gpps.com': 'jemaat'
};