import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDnjfSjA_CrZFsR8PTeIDVbEzbxv4aLkgo",
  authDomain: "indoor-nav-c5227.firebaseapp.com",
  projectId: "indoor-nav-c5227",
  storageBucket: "indoor-nav-c5227.firebasestorage.app",
  messagingSenderId: "397901921965",
  appId: "1:397901921965:web:aaa4088745379a959e9024",
  measurementId: "G-353M1S3TB5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };

// Add a default export
export default { app, db }; 