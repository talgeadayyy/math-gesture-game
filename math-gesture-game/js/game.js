// ===== GAME LOGIC - ĐÃ SỬA LỖI CÚ PHÁP =====

class MathGame {
    constructor() {
        // DOM elements
        this.videoElement = document.getElementById('videoElement');
        this.canvasElement = document.getElementById('canvasElement');
        this.questionText = document.getElementById('questionText');
        this.fingerCount = document.getElementById('fingerCount');
        this.questionCounter = document.getElementById('questionCounter');
        this.timer = document.getElementById('timer');
        this.levelBadge = document.getElementById('levelBadge');
        this.progressBar = document.getElementById('progressBar');
        this.correctCount = document.getElementById('correctCount');
        this.wrongCount = document.getElementById('wrongCount');
        this.feedbackMessage = document.getElementById('feedbackMessage');
        this.feedbackContainer = document.getElementById('feedbackContainer');
        this.resultModal = document.getElementById('resultModal');

        // Game state
        this.level = 1;
        this.currentQuestionIndex = 0;
        this.totalQuestions = 16;
        this.questions = [];
        this.correctAnswers = 0;
        this.wrongAnswers = 0;
        this.startTime = null;
        this.timerInterval = null;
        this.currentFingerCount = 0;
        this.waitingForAnswer = true;
        this.userId = null;
        this.isInitialized = false;

        // Gesture
        this.gestureRecognition = null;

        // Audio
        this.audioContext = null;
        this.questionLocked = false;   // 🔒 khóa mỗi câu
        this.isGameFinished = false;  // 🏁 game đã kết thúc chưa

        this.finishBtn = document.getElementById('finishBtn');

        this.finishBtn.addEventListener('click', async () => {
    if (this.isGameFinished) return;
    if (!confirm('Bạn có chắc muốn hoàn thành bài chơi?')) return;
    await this.endGame(); // ❗ để endGame tự set isGameFinished
    // 👉 quay về chọn level sau khi lưu xong
    window.location.href = 'dashboard.html';
});
console.log('finishBtn:', this.finishBtn);

        // 🔧 FIX: trạng thái gesture ổn định & thoát
        this.lastFingerCount = null;
        this.fingerHoldStart = null;
        this.fingerHoldDuration = 800; // ms - giữ ngón tay ổn định 0.8s
        this.isExiting = false;
    }

    // ================= INIT =================
    async init() {
        if (this.isInitialized) return;

        console.log('⏳ Chờ Firebase auth...');

        auth.onAuthStateChanged(async (user) => {
            if (!user) {
                console.warn('❌ Chưa đăng nhập');
                window.location.href = 'login.html';
                return;
            }

            if (this.isInitialized) return;

            this.isInitialized = true;
            this.userId = user.uid;

            console.log('✅ Auth OK:', user.email);

            // Lấy level từ URL
            const params = new URLSearchParams(window.location.search);
            this.level = parseInt(params.get('level')) || 1;
            this.updateLevelBadge();

            // Tạo câu hỏi
            this.generateQuestions();

            // Bắt đầu game
            this.startGame();
            this.setupEventListeners();

            // 📷 Camera (LUÔN SAU CÙNG để tránh callback chạy trước khi game ready)
            await this.initGestureRecognition();
        });
    }

    async initGestureRecognition() {
        console.log('📷 Khởi tạo camera...');
        
        this.gestureRecognition = new GestureRecognition(
            this.videoElement,
            this.canvasElement,
            (count) => this.onFingerCountUpdate(count)
        );

        const success = await this.gestureRecognition.initialize();
        if (success) {
            this.gestureRecognition.start();
            console.log('✅ Camera sẵn sàng');
        } else {
            alert('Không thể khởi tạo camera. Vui lòng cho phép truy cập camera.');
        }
    }

    // ================= GAME FLOW =================
    startGame() {
        console.log('▶️ Bắt đầu game!');
        
        this.startTime = Date.now();
        this.currentQuestionIndex = 0;
        this.correctAnswers = 0;
        this.wrongAnswers = 0;

        this.resetGestureState(); // 🔧 Reset trạng thái gesture

        this.startTimer();
        this.showQuestion();
    }

    resetGestureState() { // 🔧 FIX: Reset để tránh nhận diện sai từ câu trước
        this.lastFingerCount = null;
        this.fingerHoldStart = null;
        this.waitingForAnswer = true;
        this.questionLocked = false; // 🔧 QUAN TRỌNG
}


    showQuestion() {
        if (this.currentQuestionIndex >= this.totalQuestions) {
            this.endGame();
            return;
        }

        const q = this.questions[this.currentQuestionIndex];
        this.questionText.textContent = q.question;
        this.questionCounter.textContent = `Câu ${this.currentQuestionIndex + 1}/${this.totalQuestions}`;
        this.updateProgressBar();
        this.resetGestureState(); // 🔧 Reset khi hiển thị câu mới
    }

    nextQuestion() {
        this.currentQuestionIndex++;
        this.showQuestion();
    }

    generateQuestions() {
        console.log(`📝 Tạo ${this.totalQuestions} câu hỏi cho Level ${this.level}...`);
        
        this.questions = [];
        const numCount = this.level + 1; // Level 1: 2 số, Level 2: 3 số, Level 3: 4 số

        for (let i = 0; i < this.totalQuestions; i++) {
            const numbers = [];
            
            for (let j = 0; j < numCount; j++) {
                numbers.push(Math.floor(Math.random() * 5) + 1); // Số từ 1-5
            }

            const sum = numbers.reduce((a, b) => a + b, 0);

            // Đảm bảo tổng không quá 10 (max 10 ngón tay)
            if (sum <= 10) {
                this.questions.push({
                    numbers: numbers,
                    question: numbers.join(' + ') + ' = ?',
                    answer: sum
                });
            } else {
                i--; // Thử lại
            }
        }

        console.log('✅ Câu hỏi đã tạo:', this.questions);
    }

    // ================= GESTURE CALLBACK =================
    onFingerCountUpdate(count) {
        if (this.isExiting) return; // 🔧 FIX: Dừng nhận diện khi đang thoát

        this.currentFingerCount = count;
        this.fingerCount.textContent = count;

        if (!this.waitingForAnswer) return; // Đã trả lời rồi

        const now = Date.now();

        // 🔧 FIX: Bắt buộc giữ ngón tay ổn định
        if (this.lastFingerCount !== count) {
            // Số ngón tay thay đổi → reset timer
            this.lastFingerCount = count;
            this.fingerHoldStart = now;
            return;
        }

        // Kiểm tra đã giữ đủ lâu chưa
        if (now - this.fingerHoldStart >= this.fingerHoldDuration) {
            this.waitingForAnswer = false;
            this.checkAnswer(count);
        }
    }

    checkAnswer(answer) {
    if (this.questionLocked) return; // 🔒 CHỐNG SPAM
    this.questionLocked = true;

    const q = this.questions[this.currentQuestionIndex];

    if (answer === q.answer) {
        // ✅ ĐÚNG
        this.correctAnswers++;
        this.correctCount.textContent = this.correctAnswers;
        this.showFeedback('🎉 Đúng rồi!', true);
        this.playSound(true);
    } else {
        // ❌ SAI
        this.wrongAnswers++;
        this.wrongCount.textContent = this.wrongAnswers;
        this.showFeedback('❌ Sai rồi!', false);
        this.playSound(false);
    }

    setTimeout(() => this.nextQuestion(), 1500);
}


    // ================= UI =================
    updateProgressBar() {
        const progress = ((this.currentQuestionIndex + 1) / this.totalQuestions) * 100;
        this.progressBar.style.width = progress + '%';
    }

    showFeedback(msg, correct) {
        this.feedbackMessage.textContent = msg;
        this.feedbackMessage.style.background = correct 
            ? 'rgba(56,239,125,.95)' 
            : 'rgba(255,107,107,.95)';
        this.feedbackMessage.classList.add('show');
        
        setTimeout(() => {
            this.feedbackMessage.classList.remove('show');
        }, 2000);
    }

    updateLevelBadge() {
        const levelNames = {
            1: '🟢 Dễ',
            2: '🟡 Trung Bình',
            3: '🔴 Khó'
        };
        this.levelBadge.textContent = `Level ${this.level} - ${levelNames[this.level]}`;
    }

    // ================= TIMER =================
    startTimer() {
        this.timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            this.timer.textContent = `⏱️ ${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
        }, 1000);
    }

    // ================= AUDIO =================
    playSound(isCorrect) {
        try {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            if (isCorrect) {
                // Âm thanh đúng: C5 -> E5 -> G5
                oscillator.frequency.setValueAtTime(523.25, this.audioContext.currentTime);
                oscillator.frequency.setValueAtTime(659.25, this.audioContext.currentTime + 0.1);
                oscillator.frequency.setValueAtTime(783.99, this.audioContext.currentTime + 0.2);
            } else {
                // Âm thanh sai: G4 -> F4
                oscillator.frequency.setValueAtTime(392, this.audioContext.currentTime);
                oscillator.frequency.setValueAtTime(349.23, this.audioContext.currentTime + 0.1);
            }

            gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);

            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.3);
        } catch (e) {
            console.log('Không thể phát âm thanh:', e);
        }
    }

    // ================= END GAME =================
   async endGame() {
    if (this.isGameFinished) return;
    this.isGameFinished = true;

    console.log('🏁 Kết thúc game!');

    clearInterval(this.timerInterval);
    this.timerInterval = null;

    // ===== 1️⃣ TÍNH TOÁN KẾT QUẢ =====
    const totalTime = Math.floor((Date.now() - this.startTime) / 1000);

    // ⚠️ tránh chia 0
    const score = this.totalQuestions > 0
        ? Math.round((this.correctAnswers / this.totalQuestions) * 100)
        : 0;

    // ===== 2️⃣ HIỂN THỊ KẾT QUẢ =====
    document.getElementById('finalScore').textContent = score + '%';
    document.getElementById('finalTime').textContent = totalTime + 's';
    document.getElementById('finalCorrect').textContent = this.correctAnswers;
    document.getElementById('finalWrong').textContent = this.wrongAnswers;

    // ⭐ TÍNH SAO (1–5)
    const stars = Math.max(1, Math.ceil((score / 100) * 5));
    document.getElementById('starRating').textContent = '⭐'.repeat(stars);

    // ===== 3️⃣ LƯU FIRESTORE (NGÀY 7 - BẮT BUỘC) =====
    await this.saveResult(
        score,
        totalTime,
        this.correctAnswers,
        this.wrongAnswers
    );


    // ===== 5️⃣ HIỆN MODAL =====
    this.resultModal.style.display = 'flex';

    this.cleanup();
}
async saveResult(score, time, correct, wrong) {
    try {
        // 1️⃣ Lưu lịch sử chơi
        await db.collection('gameHistory').add({
            userId: this.userId,
            level: this.level,
            score: score,
            timeSpent: time,
            correctAnswers: correct,
            wrongAnswers: wrong,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 2️⃣ Update high score (NGÀY 7)
        const userRef = db.collection('users').doc(this.userId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) return;

        const field = `level${this.level}HighScore`;
        const currentHigh = userDoc.data()[field] || 0;

        if (score > currentHigh) {
            await userRef.update({
                [field]: score
            });
            console.log('🏆 High score mới!');
        }

        console.log('💾 Kết quả đã lưu thành công');

    } catch (error) {
        console.error('❌ Lỗi lưu kết quả:', error);
    }
}

    // ================= EVENTS =================
    setupEventListeners() {
        // Nút Exit
        document.getElementById('btnExit').addEventListener('click', () => {
            if (confirm('Bạn có muốn thoát? Kết quả sẽ không được lưu.')) {
                this.cleanup();
                window.location.href = 'dashboard.html';
            }
        });

        // Nút Skip
        document.getElementById('btnSkip').addEventListener('click', () => {
           if (this.questionLocked) return;
this.questionLocked = true;

this.wrongAnswers++;
this.wrongCount.textContent = this.wrongAnswers;
this.showFeedback('⏭️ Đã bỏ qua', false);
this.playSound(false);

setTimeout(() => this.nextQuestion(), 1000);
        });

        // Nút Hint
        document.getElementById('btnHint').addEventListener('click', () => {
            const question = this.questions[this.currentQuestionIndex];
            alert(`💡 Gợi ý: Giơ ${question.answer} ngón tay lên!`);
        });

        // Nút Play Again
        document.getElementById('btnPlayAgain').addEventListener('click', () => {
            this.resultModal.style.display = 'none';
            this.generateQuestions();
            this.startGame();
        });

        // Nút Back to Dashboard
        document.getElementById('btnBackToDashboard').addEventListener('click', () => {
            this.cleanup();
            window.location.href = 'dashboard.html';
        });
    }

    // ================= CLEANUP =================
    cleanup() {
        console.log('🧹 Dọn dẹp resources...');
        
        this.isExiting = true; // 🔧 FIX: Ngăn callback gesture chạy khi đang thoát

        // Dừng gesture recognition
        if (this.gestureRecognition) {
            this.gestureRecognition.destroy();
            this.gestureRecognition = null;
        }

        // Dừng camera stream
        if (this.videoElement && this.videoElement.srcObject) {
            this.videoElement.srcObject.getTracks().forEach(track => track.stop());
            this.videoElement.srcObject = null;
        }

        // Dừng timer
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }
}

// ================= DOM READY =================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📄 DOM đã sẵn sàng');
    const game = new MathGame();
    await game.init();
});