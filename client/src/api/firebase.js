import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, FacebookAuthProvider, signInWithPopup } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDk3P6dc8Pdy5iDC0owxf3Ip1h6O4IjEMI",
  authDomain: "tnq-fashion-store.firebaseapp.com",
  projectId: "tnq-fashion-store",
  storageBucket: "tnq-fashion-store.firebasestorage.app",
  messagingSenderId: "950850893755",
  appId: "1:950850893755:web:1ad1eae8a87b884fb3369e",
  measurementId: "G-0HDKWM2W68"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const facebookProvider = new FacebookAuthProvider();

export const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
export const loginWithFacebook = () => signInWithPopup(auth, facebookProvider);
