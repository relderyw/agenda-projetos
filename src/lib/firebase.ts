import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyC36KWoWZuF7ZhOClb6yn0EhHX-8gaWoSE",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "agenda-lsl.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "agenda-lsl",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "agenda-lsl.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "492964184729",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:492964184729:web:6ce5aba1d33f6dc41aee08",
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
