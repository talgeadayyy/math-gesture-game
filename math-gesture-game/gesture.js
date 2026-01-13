// ===== GESTURE RECOGNITION - THUẬT TOÁN TỐI ƯU CUỐI CÙNG =====

class GestureRecognition {
    constructor(videoElement, canvasElement, onResultsCallback) {
        console.log('🎯 GestureRecognition constructor called');
        
        this.videoElement = videoElement;
        this.canvasElement = canvasElement;
        this.canvasCtx = canvasElement.getContext('2d', {
            alpha: false,
            willReadFrequently: false
        });
        this.onResultsCallback = onResultsCallback;
        
        // Smoothing parameters
        this.fingerHistory = [];
        this.historySize = 10; // Tăng lên 10 để ổn định hơn
        
        this.lastFrameTime = 0;
        this.frameInterval = 1000 / 30; // 30 FPS
        
        console.log('🚀 Khởi tạo MediaPipe Hands...');
        this.initHands();
    }

    initHands() {
        if (typeof Hands === 'undefined') {
            console.error('❌ MediaPipe Hands SDK chưa load!');
            alert('Lỗi: MediaPipe Hands SDK chưa sẵn sàng. Vui lòng refresh trang.');
            return;
        }

        this.hands = new Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
            }
        });

        this.hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1, // Tăng lên 1 để chính xác hơn
            minDetectionConfidence: 0.7, // Tăng lên để giảm false positive
            minTrackingConfidence: 0.5,
            selfieMode: false
        });

        this.hands.onResults((results) => this.onResults(results));
        
        console.log('✅ MediaPipe Hands initialized');
        this.startCamera();
    }

    startCamera() {
        if (typeof Camera === 'undefined') {
            console.error('❌ MediaPipe Camera Utils chưa load!');
            return;
        }

        this.camera = new Camera(this.videoElement, {
            onFrame: async () => {
                const now = Date.now();
                if (now - this.lastFrameTime < this.frameInterval) {
                    return;
                }
                this.lastFrameTime = now;
                
                await this.hands.send({ image: this.videoElement });
            },
            width: 640,
            height: 480
        });

        this.camera.start();
        console.log('✅ Camera started');
    }

    onResults(results) {
        const w = this.canvasElement.width;
        const h = this.canvasElement.height;
        
        this.canvasCtx.save();
        this.canvasCtx.clearRect(0, 0, w, h);
        
        // Vẽ video (mirror)
        this.canvasCtx.save();
        this.canvasCtx.scale(-1, 1);
        this.canvasCtx.translate(-w, 0);
        this.canvasCtx.drawImage(this.videoElement, 0, 0, w, h);
        this.canvasCtx.restore();
        
        let totalFingers = 0;
        
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            for (let i = 0; i < results.multiHandLandmarks.length; i++) {
                const landmarks = results.multiHandLandmarks[i];
                
                // Vẽ tay (mirror)
                this.canvasCtx.save();
                this.canvasCtx.scale(-1, 1);
                this.canvasCtx.translate(-w, 0);
                this.drawHand(landmarks, w, h);
                this.canvasCtx.restore();
                
                // ✅ KIỂM TRA NẮM TAY TRƯỚC
                if (this.isFist(landmarks)) {
                    totalFingers = 0; // Nắm tay = 0
                    console.log('✊ Phát hiện nắm tay - Số 0');
                    break; // Dừng ngay, không đếm nữa
                }
                
                // Đếm ngón tay bình thường
                const fingerCount = this.countFingers(landmarks);
                totalFingers += fingerCount;
            }
        }
        // Nếu không phát hiện tay → 0 ngón
        
        this.canvasCtx.restore();
        
        // Smoothing với weighted average
        this.fingerHistory.push(totalFingers);
        if (this.fingerHistory.length > this.historySize) {
            this.fingerHistory.shift();
        }
        
        const smoothedCount = this.getWeightedMode(this.fingerHistory);
        
        if (this.onResultsCallback) {
            this.onResultsCallback(smoothedCount);
        }
    }

    drawHand(landmarks, w, h) {
        const ctx = this.canvasCtx;
        
        const connections = [
            [0,1],[1,2],[2,3],[3,4],
            [0,5],[5,6],[6,7],[7,8],
            [0,9],[9,10],[10,11],[11,12],
            [0,13],[13,14],[14,15],[15,16],
            [0,17],[17,18],[18,19],[19,20],
            [5,9],[9,13],[13,17]
        ];
        
        ctx.strokeStyle = '#A8E6CF';
        ctx.lineWidth = 5;
        ctx.shadowColor = 'rgba(168, 230, 207, 0.5)';
        ctx.shadowBlur = 10;
        
        connections.forEach(([start, end]) => {
            const p1 = landmarks[start];
            const p2 = landmarks[end];
            ctx.beginPath();
            ctx.moveTo(p1.x * w, p1.y * h);
            ctx.lineTo(p2.x * w, p2.y * h);
            ctx.stroke();
        });
        
        landmarks.forEach((landmark, idx) => {
            const x = landmark.x * w;
            const y = landmark.y * h;
            
            ctx.fillStyle = idx === 0 ? '#FF6B9D' : '#FFD93D';
            ctx.shadowColor = idx === 0 ? 'rgba(255, 107, 157, 0.6)' : 'rgba(255, 217, 61, 0.6)';
            ctx.shadowBlur = 15;
            
            ctx.beginPath();
            ctx.arc(x, y, idx === 0 ? 9 : 6, 0, 2 * Math.PI);
            ctx.fill();
        });
    }

    // ✅ NHẬN DIỆN NẮM TAY = SỐ 0
    isFist(landmarks) {
        const wrist = landmarks[0];
        
        // Lấy tất cả đầu ngón tay
        const fingerTips = [
            landmarks[4],  // Ngón cái
            landmarks[8],  // Ngón trỏ
            landmarks[12], // Ngón giữa
            landmarks[16], // Ngón áp út
            landmarks[20]  // Ngón út
        ];
        
        // Lấy tất cả khớp MCP (gốc ngón)
        const fingerMCPs = [
            landmarks[2],  // Ngón cái MCP
            landmarks[5],  // Ngón trỏ MCP
            landmarks[9],  // Ngón giữa MCP
            landmarks[13], // Ngón áp út MCP
            landmarks[17]  // Ngón út MCP
        ];
        
        // Tính khoảng cách trung bình từ đầu ngón đến cổ tay
        let avgTipDist = 0;
        fingerTips.forEach(tip => {
            avgTipDist += this.distance(tip, wrist);
        });
        avgTipDist /= 5;
        
        // Tính khoảng cách trung bình từ MCP đến cổ tay
        let avgMCPDist = 0;
        fingerMCPs.forEach(mcp => {
            avgMCPDist += this.distance(mcp, wrist);
        });
        avgMCPDist /= 5;
        
        // NẮM TAY: Đầu ngón GẦN cổ tay hơn (hoặc gần bằng) MCP
        // Nếu avgTipDist < avgMCPDist * 1.15 → Nắm tay
        const isFistByDistance = avgTipDist < avgMCPDist * 1.15;
        
        // Kiểm tra thêm: Tất cả ngón đều không duỗi
        let extendedCount = 0;
        
        // Kiểm tra ngón cái
        const thumbTip = landmarks[4];
        const thumbIP = landmarks[3];
        if (this.distance(thumbTip, wrist) > this.distance(thumbIP, wrist) * 1.1) {
            extendedCount++;
        }
        
        // Kiểm tra 4 ngón còn lại
        const fingers = [
            { tip: 8, pip: 6 },   // Index
            { tip: 12, pip: 10 }, // Middle
            { tip: 16, pip: 14 }, // Ring
            { tip: 20, pip: 18 }  // Pinky
        ];
        
        fingers.forEach(f => {
            const tip = landmarks[f.tip];
            const pip = landmarks[f.pip];
            
            if (tip.y < pip.y - 0.015) {
                extendedCount++;
            }
        });
        
        // NẮM TAY: Khoảng cách gần + Ít hơn 2 ngón duỗi
        return isFistByDistance && extendedCount < 2;
    }

    // ✅ THUẬT TOÁN TỐI ƯU: KẾT HỢP 2 PHƯƠNG PHÁP
    countFingers(landmarks) {
        let count = 0;
        const wrist = landmarks[0];
        
        // ===== NGÓN CÁI =====
        const thumbTip = landmarks[4];
        const thumbIP = landmarks[3];
        const thumbMCP = landmarks[2];
        
        // Phương pháp 1: Khoảng cách
        const thumbTipDist = this.distance(thumbTip, wrist);
        const thumbIPDist = this.distance(thumbIP, wrist);
        const dist1 = thumbTipDist > thumbIPDist * 1.1;
        
        // Phương pháp 2: Vị trí X
        const dist2 = Math.abs(thumbTip.x - thumbMCP.x) > 0.04;
        
        if (dist1 && dist2) count++;
        
        // ===== 4 NGÓN CÒN LẠI =====
        const fingers = [
            { tip: 8, pip: 6, mcp: 5, dip: 7 },   // Index
            { tip: 12, pip: 10, mcp: 9, dip: 11 }, // Middle
            { tip: 16, pip: 14, mcp: 13, dip: 15 }, // Ring
            { tip: 20, pip: 18, mcp: 17, dip: 19 }  // Pinky
        ];
        
        fingers.forEach(f => {
            const tip = landmarks[f.tip];
            const pip = landmarks[f.pip];
            const mcp = landmarks[f.mcp];
            const dip = landmarks[f.dip];
            
            // Phương pháp 1: Y coordinate (tip phải cao hơn pip)
            const check1 = tip.y < pip.y - 0.015;
            
            // Phương pháp 2: Khoảng cách tip-wrist
            const tipDist = this.distance(tip, wrist);
            const pipDist = this.distance(pip, wrist);
            const check2 = tipDist > pipDist * 1.05;
            
            // Phương pháp 3: Kiểm tra không gập (dip-pip vs pip-mcp)
            const dipPipDist = this.distance(dip, pip);
            const pipMcpDist = this.distance(pip, mcp);
            const check3 = dipPipDist > pipMcpDist * 0.6;
            
            // Cần ít nhất 2/3 điều kiện
            const score = [check1, check2, check3].filter(x => x).length;
            if (score >= 2) count++;
        });
        
        return count;
    }

    distance(a, b) {
        return Math.sqrt(
            Math.pow(a.x - b.x, 2) + 
            Math.pow(a.y - b.y, 2) + 
            Math.pow((a.z || 0) - (b.z || 0), 2)
        );
    }

    // Weighted mode: Ưu tiên giá trị gần đây hơn
    getWeightedMode(arr) {
        if (arr.length === 0) return 0;
        
        const frequency = {};
        
        // Tăng trọng số cho giá trị gần đây
        arr.forEach((num, idx) => {
            const weight = (idx + 1) / arr.length; // 0.1, 0.2, ..., 1.0
            frequency[num] = (frequency[num] || 0) + weight;
        });
        
        let maxFreq = 0;
        let mode = 0;
        
        for (const num in frequency) {
            if (frequency[num] > maxFreq) {
                maxFreq = frequency[num];
                mode = parseInt(num);
            }
        }
        
        return mode;
    }
}

console.log('✅ gesture.js loaded successfully');