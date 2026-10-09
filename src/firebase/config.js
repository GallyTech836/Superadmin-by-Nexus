import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Mismo proyecto de Firebase que GallyFlow — misma base de datos real,
// misma colección `negocios`. Esta app solo AGREGA una vista distinta
// sobre los mismos datos, no crea un proyecto de Firebase separado.
const firebaseConfig = {
  apiKey: "AIzaSyDioxAn9-8TbZsONAQV9XrTX4krbCBbED4",
  authDomain: "gally-flow.firebaseapp.com",
  projectId: "gally-flow",
  storageBucket: "gally-flow.firebasestorage.app",
  messagingSenderId: "1034377267475",
  appId: "1:1034377267475:web:ecb0f071d1bc630e0132e6"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);