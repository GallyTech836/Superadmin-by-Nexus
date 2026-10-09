import { useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { auth } from '../firebase/config';

// ⚠️ REEMPLAZA esto por tu correo real de Firebase Auth (el mismo con
// el que entras a AdminApp de GallyFlow, o uno nuevo que crees solo
// para esto en la consola de Firebase > Authentication).
const SUPER_ADMIN_EMAIL = 'torricogali@gmail.com';

/**
 * Guardia de acceso: verifica sesión de Firebase Auth Y que el email
 * coincida exactamente con SUPER_ADMIN_EMAIL. Cualquier otra cuenta
 * (incluido un dueño de barbería con Auth válido) queda fuera, aunque
 * el login en sí haya sido exitoso.
 */
export function useSuperAdminAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser && firebaseUser.email === SUPER_ADMIN_EMAIL) {
        setUser(firebaseUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  async function login(email, password) {
    setError('');
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      if (cred.user.email !== SUPER_ADMIN_EMAIL) {
        await signOut(auth);
        setError('Esta cuenta no tiene acceso al panel Super Admin.');
        return;
      }
    } catch (e) {
      setError('Correo o contraseña incorrectos.');
    }
  }

  function logout() {
    signOut(auth);
  }

  return { user, loading, error, login, logout };
}