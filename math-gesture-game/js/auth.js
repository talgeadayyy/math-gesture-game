// ================================
// BIẾN TOÀN CỤC
// ================================

// Kiểm tra xem đang ở chế độ đăng ký hay đăng nhập
let isRegisterMode = false;

// Lấy các elements từ HTML
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirmPassword');
const confirmPasswordGroup = document.getElementById('confirmPasswordGroup');
const authButton = document.getElementById('authButton');
const authSubtitle = document.getElementById('auth-subtitle');
const toggleLink = document.getElementById('toggleLink');
const toggleText = document.getElementById('toggleText');
const errorMessage = document.getElementById('errorMessage');
const successMessage = document.getElementById('successMessage');

// ================================
// KHỞI TẠO KHI TRANG LOAD
// ================================

document.addEventListener('DOMContentLoaded', function() {
    // Kiểm tra URL có ?register=true không
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('register') === 'true') {
        switchToRegisterMode();
    }

    // Kiểm tra user đã đăng nhập chưa
    checkAuthState();
});

// ================================
// KIỂM TRA TRẠNG THÁI ĐĂNG NHẬP
// ================================

function checkAuthState() {
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            // User đã đăng nhập → chuyển đến dashboard
            console.log('User đã đăng nhập:', user.email);
            window.location.href = 'dashboard.html';
        }
    });
}

// ================================
// CHUYỂN ĐỔI GIỮA LOGIN VÀ REGISTER
// ================================

// Khi click vào link "Đăng ký ngay" hoặc "Đăng nhập"
toggleLink.addEventListener('click', function(e) {
    e.preventDefault();
    
    if (isRegisterMode) {
        switchToLoginMode();
    } else {
        switchToRegisterMode();
    }
});

// Chuyển sang chế độ đăng ký
function switchToRegisterMode() {
    isRegisterMode = true;
    
    // Thay đổi text
    authSubtitle.textContent = 'Tạo tài khoản mới';
    authButton.textContent = 'Đăng Ký';
    toggleText.innerHTML = 'Đã có tài khoản? <a href="#" id="toggleLink">Đăng nhập</a>';
    
    // Hiện field nhập lại mật khẩu
    confirmPasswordGroup.style.display = 'block';
    confirmPasswordInput.required = true;
    
    // Reset messages
    hideMessages();
    
    // Re-attach event listener cho toggle link mới
    document.getElementById('toggleLink').addEventListener('click', function(e) {
        e.preventDefault();
        switchToLoginMode();
    });
}

// Chuyển sang chế độ đăng nhập
function switchToLoginMode() {
    isRegisterMode = false;
    
    // Thay đổi text
    authSubtitle.textContent = 'Đăng nhập để bắt đầu';
    authButton.textContent = 'Đăng Nhập';
    toggleText.innerHTML = 'Chưa có tài khoản? <a href="#" id="toggleLink">Đăng ký ngay</a>';
    
    // Ẩn field nhập lại mật khẩu
    confirmPasswordGroup.style.display = 'none';
    confirmPasswordInput.required = false;
    
    // Reset messages
    hideMessages();
    
    // Re-attach event listener cho toggle link mới
    document.getElementById('toggleLink').addEventListener('click', function(e) {
        e.preventDefault();
        switchToRegisterMode();
    });
}

// ================================
// XỬ LÝ SUBMIT FORM
// ================================

loginForm.addEventListener('submit', function(e) {
    e.preventDefault(); // Ngăn form reload trang
    
    // Lấy giá trị input
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    
    // Validate
    if (!email || !password) {
        showError('Vui lòng điền đầy đủ thông tin');
        return;
    }
    
    if (password.length < 6) {
        showError('Mật khẩu phải có ít nhất 6 ký tự');
        return;
    }
    
    // Nếu đang ở chế độ đăng ký
    if (isRegisterMode) {
        // Kiểm tra mật khẩu khớp
        if (password !== confirmPassword) {
            showError('Mật khẩu không khớp');
            return;
        }
        
        // Gọi hàm đăng ký
        registerUser(email, password);
    } else {
        // Gọi hàm đăng nhập
        loginUser(email, password);
    }
});

// ================================
// ĐĂNG KÝ USER MỚI
// ================================

function registerUser(email, password) {
    // Disable button để tránh click nhiều lần
    authButton.disabled = true;
    authButton.textContent = 'Đang xử lý...';
    
    hideMessages();
    
    // Gọi Firebase Auth để tạo user
    firebase.auth().createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Đăng ký thành công
            const user = userCredential.user;
            console.log('Đăng ký thành công:', user.email);
            
            // Tạo document user trong Firestore
            return createUserDocument(user.uid, email);
        })
        .then(() => {
            // Tạo document thành công
            showSuccess('Đăng ký thành công! Đang chuyển hướng...');
            
            // Chờ 1.5 giây rồi chuyển đến dashboard
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);
        })
        .catch((error) => {
            // Xử lý lỗi
            console.error('Lỗi đăng ký:', error);
            handleAuthError(error);
            
            // Enable lại button
            authButton.disabled = false;
            authButton.textContent = 'Đăng Ký';
        });
}

// ================================
// ĐĂNG NHẬP USER
// ================================

function loginUser(email, password) {
    // Disable button
    authButton.disabled = true;
    authButton.textContent = 'Đang đăng nhập...';
    
    hideMessages();
    
    // Gọi Firebase Auth để đăng nhập
    firebase.auth().signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Đăng nhập thành công
            const user = userCredential.user;
            console.log('Đăng nhập thành công:', user.email);
            
            showSuccess('Đăng nhập thành công! Đang chuyển hướng...');
            
            // Chờ 1 giây rồi chuyển đến dashboard
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);
        })
        .catch((error) => {
            // Xử lý lỗi
            console.error('Lỗi đăng nhập:', error);
            handleAuthError(error);
            
            // Enable lại button
            authButton.disabled = false;
            authButton.textContent = 'Đăng Nhập';
        });
}

// ================================
// TẠO USER DOCUMENT TRONG FIRESTORE
// ================================

function createUserDocument(userId, email) {
    // Tạo document trong collection 'users'
    return firebase.firestore().collection('users').doc(userId).set({
        email: email,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        displayName: email.split('@')[0], // Lấy phần trước @ làm tên hiển thị
        level1HighScore: 0,
        level2HighScore: 0,
        level3HighScore: 0
    });
}

// ================================
// XỬ LÝ LỖI FIREBASE
// ================================

function handleAuthError(error) {
    let message = 'Đã có lỗi xảy ra';
    
    // Các mã lỗi phổ biến từ Firebase
    switch(error.code) {
        case 'auth/email-already-in-use':
            message = 'Email này đã được sử dụng';
            break;
        case 'auth/invalid-email':
            message = 'Email không hợp lệ';
            break;
        case 'auth/weak-password':
            message = 'Mật khẩu quá yếu (tối thiểu 6 ký tự)';
            break;
        case 'auth/user-not-found':
            message = 'Không tìm thấy tài khoản với email này';
            break;
        case 'auth/wrong-password':
            message = 'Mật khẩu không đúng';
            break;
        case 'auth/too-many-requests':
            message = 'Quá nhiều lần thử. Vui lòng thử lại sau';
            break;
        case 'auth/network-request-failed':
            message = 'Lỗi kết nối mạng. Vui lòng kiểm tra internet';
            break;
        default:
            message = error.message;
    }
    
    showError(message);
}

// ================================
// HIỂN THỊ THÔNG BÁO
// ================================

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    successMessage.style.display = 'none';
}

function showSuccess(message) {
    successMessage.textContent = message;
    successMessage.style.display = 'block';
    errorMessage.style.display = 'none';
}

function hideMessages() {
    errorMessage.style.display = 'none';
    successMessage.style.display = 'none';
}