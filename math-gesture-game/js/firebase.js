// ===================================
// FIREBASE CONFIGURATION - CENTRAL
// ===================================

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCPi1m_Jv81VgSJUviaHRwed98XW4mHU0g",
    authDomain: "math-gesture-game.firebaseapp.com",
    projectId: "math-gesture-game",
    storageBucket: "math-gesture-game.firebasestorage.app",
    messagingSenderId: "242950399384",
    appId: "1:242950399384:web:29a158edaf93b450c9b7ed",
    measurementId: "G-LC89JCQXXJ"
};

// ===================================
// INIT FIREBASE (CHỈ 1 LẦN)
// ===================================

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    console.log("🔥 Firebase đã khởi tạo thành công");
} else {
    console.log("ℹ️ Firebase đã được khởi tạo trước đó");
}

// ===================================
// EXPORT GLOBAL VARIABLES
// ===================================

window.auth = firebase.auth();
window.db = firebase.firestore();

// Firestore settings (tăng tính ổn định)
window.db.settings({
    ignoreUndefinedProperties: true
});

console.log("✅ Firebase config loaded - auth & db ready");