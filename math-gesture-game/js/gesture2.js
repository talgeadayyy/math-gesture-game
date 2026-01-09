// ===== GESTURE RECOGNITION với MediaPipe Hands - COMBINED VERSION =====

class GestureRecognition {
    constructor(videoElement, canvasElement, onResultsCallback) {
        console.log('🎯 GestureRecognition constructor called');
        
        this.videoElement = videoElement;
        this.canvasElement = canvasElement;
        this.canvasCtx = canvasElement.getContext('2d', {
            alpha: false,
            desynchronized: true,
            willReadFrequently: false
        });
        this.onResultsCallback = onResultsCallback;
        
        this.hands = null;
        this.isRunning = false;
        
        this.fingerHistory = [];
        this.historySize = 5;
        this.lastStableCount = 0;
        
        this.frameSkipCounter = 0;
        this.lastFrameTime = 0;
        this.targetFPS = 60;
        this.minFrameInterval = 1000 / this.targetFPS;
        
        console.log('🚀 Khởi tạo MediaPipe Hands...');
        this.initialize();
    }

    async initialize() {
        try {
            if (typeof Hands === 'undefined') {
                console.error('❌ MediaPipe Hands SDK chưa load!');
                alert('Lỗi: MediaPipe Hands SDK chưa sẵn sàng. Vui lòng refresh trang.');
                return false;
            }

            this.hands = new Hands({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
            });

            this.hands.setOptions({
                maxNumHands: 2,
                modelComplexity: 0,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });

            this.hands.onResults(results => this.onResults(results));

            await this.initCamera();

            console.log('✅ MediaPipe Hands initialized');
            return true;

        } catch (err) {
            console.error('❌ MediaPipe error:', err);
            alert('Không thể truy cập camera: ' + err.message);
            return false;
        }
    }

    async initCamera() {
        try {
            console.log('📷 Đang yêu cầu quyền truy cập camera...');

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user',
                    frameRate: { ideal: 60, max: 60 }
                }
            });

            this.videoElement.srcObject = stream;

            await new Promise(resolve => {
                this.videoElement.onloadedmetadata = () => resolve();
            });

            await this.videoElement.play();

            this.canvasElement.width = this.videoElement.videoWidth || 640;
            this.canvasElement.height = this.videoElement.videoHeight || 480;

            console.log('📷 Camera ready:', this.canvasElement.width, 'x', this.canvasElement.height);
            
            this.start();

        } catch (error) {
            console.error('❌ Camera error:', error);
            throw new Error('Không thể truy cập camera. Vui lòng cho phép quyền truy cập camera.');
        }
    }

    start() {
        if (this.isRunning) {
            console.log('⚠️ Gesture recognition đã đang chạy');
            return;
        }
        
        this.isRunning = true;
        console.log('▶️ Bắt đầu nhận diện gesture');
        this.lastFrameTime = performance.now();
        this.detectFrame();
    }

    stop() {
        this.isRunning = false;
        console.log('⏸️ Dừng nhận diện gesture');

        if (this.hands) {
            this.hands.close();
            this.hands = null;
        }
    }

    async detectFrame() {
        if (!this.isRunning || !this.hands) return;

        try {
            await this.hands.send({ image: this.videoElement });
        } catch (error) {
            console.error('❌ Lỗi detect frame:', error);
        }

        requestAnimationFrame(() => this.detectFrame());
    }

    onResults(results) {
        const ctx = this.canvasCtx;
        const w = this.canvasElement.width;
        const h = this.canvasElement.height;

        ctx.clearRect(0, 0, w, h);

        ctx.save();
        ctx.scale(-1, 1);
        ctx.translate(-w, 0);
        ctx.drawImage(this.videoElement, 0, 0, w, h);
        ctx.restore();

        let totalFingers = 0;
        let hasHand = false;

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            hasHand = true;
            for (let i = 0; i < results.multiHandLandmarks.length; i++) {
                const landmarks = results.multiHandLandmarks[i];
                
                const handedness = results.multiHandedness && results.multiHandedness[i] 
                    ? results.multiHandedness[i].label 
                    : 'Right';

                this.drawHand(landmarks, w, h);

                totalFingers += this.countFingers(landmarks, handedness);
            }
        }

        // ✅ CHỈ GỌI CALLBACK KHI CÓ TAY (kể cả nắm tay = 0 ngón)
        if (hasHand) {
            const smoothedCount = this.smoothFingerCount(totalFingers);

            if (this.onResultsCallback) {
                this.onResultsCallback(smoothedCount);
            }
        }
    }

    smoothFingerCount(count) {
        this.fingerHistory.push(count);

        if (this.fingerHistory.length > this.historySize) {
            this.fingerHistory.shift();
        }

        const freq = {};
        this.fingerHistory.forEach(c => {
            freq[c] = (freq[c] || 0) + 1;
        });

        const mode = Number(
            Object.keys(freq).reduce((a, b) => freq[a] > freq[b] ? a : b)
        );

        return mode;
    }

    drawHand(landmarks, w, h) {
        const ctx = this.canvasCtx;

        ctx.save();
        ctx.scale(-1, 1);
        ctx.translate(-w, 0);

        ctx.strokeStyle = '#A8E6CF';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = 'rgba(168,230,207,0.6)';
        ctx.shadowBlur = 8;

        const connections = [
            [0, 1], [1, 2], [2, 3], [3, 4],
            [0, 5], [5, 6], [6, 7], [7, 8],
            [0, 9], [9, 10], [10, 11], [11, 12],
            [0, 13], [13, 14], [14, 15], [15, 16],
            [0, 17], [17, 18], [18, 19], [19, 20],
            [5, 9], [9, 13], [13, 17]
        ];

        ctx.beginPath();
        connections.forEach(([start, end]) => {
            ctx.moveTo(landmarks[start].x * w, landmarks[start].y * h);
            ctx.lineTo(landmarks[end].x * w, landmarks[end].y * h);
        });
        ctx.stroke();

        landmarks.forEach((pt, index) => {
            const isFingerTip = [4, 8, 12, 16, 20].includes(index);
            const isWrist = index === 0;
            
            if (isWrist) {
                ctx.fillStyle = '#FF6B9D';
                ctx.shadowColor = 'rgba(255, 107, 157, 0.6)';
            } else if (isFingerTip) {
                ctx.fillStyle = '#FFD93D';
                ctx.shadowColor = 'rgba(255, 217, 61, 0.6)';
            } else {
                ctx.fillStyle = '#A8E6CF';
                ctx.shadowColor = 'rgba(168, 230, 207, 0.5)';
            }
            
            ctx.shadowBlur = 10;
            const radius = isWrist ? 9 : isFingerTip ? 9 : 6;
            
            ctx.beginPath();
            ctx.arc(pt.x * w, pt.y * h, radius, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.restore();
    }

    distance(a, b) {
        return Math.hypot(a.x - b.x, a.y - b.y);
    }

    angle(a, b, c) {
        const ab = { x: a.x - b.x, y: a.y - b.y };
        const cb = { x: c.x - b.x, y: c.y - b.y };

        const dot = ab.x * cb.x + ab.y * cb.y;
        const mag = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y);

        if (mag === 0) return 0;
        return Math.acos(dot / mag) * (180 / Math.PI);
    }

    countFingers(lm, handedness) {
        let count = 0;

        const wrist = lm[0];

        const thumbTip = lm[4];
        const thumbIP  = lm[3];
        const thumbMCP = lm[2];
        const indexMCP = lm[5];

        const thumbDistance = this.distance(thumbTip, thumbMCP);
        const thumbFoldedDistance = this.distance(thumbIP, thumbMCP);

        const thumbLongEnough = thumbDistance > thumbFoldedDistance * 1.15;
        const thumbAwayFromPalm = this.distance(thumbTip, indexMCP) > this.distance(thumbMCP, indexMCP) * 1.0;

        if (thumbLongEnough && thumbAwayFromPalm) {
            count++;
        }

        const fingers = [
            { tip: 8, pip: 6 },
            { tip: 12, pip: 10 },
            { tip: 16, pip: 14 },
            { tip: 20, pip: 18 }
        ];

        for (const finger of fingers) {
            const tip = lm[finger.tip];
            const pip = lm[finger.pip];

            const extended = tip.y < pip.y && this.distance(tip, pip) > 0.035;

            if (extended) count++;
        }

        return count;
    }

    destroy() {
        console.log('🧹 Destroy gesture recognition');
        
        this.stop();
        
        if (this.videoElement && this.videoElement.srcObject) {
            this.videoElement.srcObject.getTracks().forEach(track => track.stop());
            this.videoElement.srcObject = null;
        }
    }
}

window.GestureRecognition = GestureRecognition;
console.log('✅ gesture.js loaded successfully');
