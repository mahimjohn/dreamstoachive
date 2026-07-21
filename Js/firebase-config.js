// Import Firebase Modules

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import { getAuth } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import { getFirestore } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";


// Firebase Configuration

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC-dGn8MjLA64dv6dvlSkgP-u9v34PbFVQ",
  authDomain: "christ-convent-hrms.firebaseapp.com",
  projectId: "christ-convent-hrms",
  storageBucket: "christ-convent-hrms.firebasestorage.app",
  messagingSenderId: "154549432687",
  appId: "1:154549432687:web:a3b5b9942ae6721b9af89a",
  measurementId: "G-W9SK5T8L32"
};

// Initialize Firebase

const app = initializeApp(firebaseConfig);


// Initialize Firebase Services

const auth = getAuth(app);

const db = getFirestore(app);


// Export the services

export { auth, db };