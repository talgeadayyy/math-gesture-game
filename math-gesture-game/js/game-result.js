const auth = window.auth;
const db = window.db;

const params = new URLSearchParams(window.location.search);

const level = params.get('level');
const score = Number(params.get('score'));
const correct = Number(params.get('correct'));
const wrong = Number(params.get('wrong'));
const time = Number(params.get('time'));

document.getElementById('finalScore').textContent = score + '%';
document.getElementById('correct').textContent = correct;
document.getElementById('wrong').textContent = wrong;
document.getElementById('time').textContent = time;

// ⭐ Sao đánh giá
const stars = Math.round(score / 20);
document.getElementById('starRating').textContent = '⭐'.repeat(stars);

auth.onAuthStateChanged(user => {
  if (!user) return;

  saveGameResult(user.uid);
  updateHighScore(user.uid);
});

function saveGameResult(userId) {
  db.collection('gameHistory').add({
    userId,
    level,
    score,
    timeSpent: time,
    correctAnswers: correct,
    wrongAnswers: wrong,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function updateHighScore(userId) {
  const userRef = db.collection('users').doc(userId);
  const snap = await userRef.get();

  const key = `level${level}HighScore`;
  const oldScore = snap.data()?.[key] || 0;

  if (score > oldScore) {
    await userRef.update({ [key]: score });
  }
}

function replay() {
  window.location.href = `game.html?level=${level}`;
}

function goDashboard() {
  window.location.href = 'dashboard.html';
}
