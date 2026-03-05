// Firebase configuration
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Your Firebase config - get these from Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyCQceLOpMtP8_HrmcVoiywk6QMUmXuj3wU",
  authDomain: "co-planning-howard.firebaseapp.com",
  projectId: "co-planning-howard",
  storageBucket: "co-planning-howard.firebasestorage.app",
  messagingSenderId: "740810951553",
  appId: "1:740810951553:web:d5ba9d6594ba9dd9e3b680"
};

// Initialize Firebase (avoid duplicate init)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Firestore
const db = getFirestore(app);

export { db };
