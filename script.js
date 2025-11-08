// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyB6SLfv65FdhqUawFADZnQrPJ4E99T-cs8",
    authDomain: "handwritten-db546.firebaseapp.com",
    projectId: "handwritten-db546",
    storageBucket: "handwritten-db546.firebasestorage.app",
    messagingSenderId: "249354833881",
    appId: "1:249354833881:web:f79503f91daee79ac7d3c8",
    measurementId: "G-W4WK2KFTC3"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Stripe Configuration
const stripe = Stripe('pk_test_51QN5S1SJ9w2p6w9p8KjvR7mZ6X1Y3qA9bL4tM7nVcF2eD5gH1'); // Replace with your Stripe publishable key

// DOM Elements
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const logoutBtn = document.getElementById('logout-btn');
const authModal = document.getElementById('auth-modal');
const modalTitle = document.getElementById('modal-title');
const authForm = document.getElementById('auth-form');
const authSubmit = document.getElementById('auth-submit');
const authSwitchText = document.getElementById('auth-switch-text');
const authSwitchLink = document.getElementById('auth-switch-link');
const confirmPasswordGroup = document.getElementById('confirm-password-group');
const closeModal = document.querySelectorAll('.close');
const premiumBtn = document.getElementById('premium-btn');
const paymentModal = document.getElementById('payment-modal');
const stripePaymentBtn = document.getElementById('stripe-payment');
const razorpayPaymentBtn = document.getElementById('razorpay-payment');
const uploadArea = document.getElementById('upload-area');
const fileInput = document.getElementById('file-input');
const convertBtn = document.getElementById('convert-btn');
const previewBtn = document.getElementById('preview-btn');
const celebration = document.getElementById('celebration');
const downloadBtn = document.getElementById('download-btn');
const convertAnotherBtn = document.getElementById('convert-another-btn');
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');
const premiumOptions = document.getElementById('premium-options');
const premiumStatus = document.getElementById('premium-status');
const conversionStatus = document.getElementById('conversion-status');
const progressBar = document.querySelector('.progress');
const statusText = document.querySelector('.status-text');

// State Variables
let isLoginMode = true;
let currentUser = null;
let selectedFile = null;
let userData = {
    isPremium: false,
    conversionsUsed: 0,
    conversionsLimit: 5,
    subscriptionId: null,
    subscriptionEnd: null
};

// Event Listeners
document.addEventListener('DOMContentLoaded', initApp);
loginBtn.addEventListener('click', () => openAuthModal(true));
signupBtn.addEventListener('click', () => openAuthModal(false));
logoutBtn.addEventListener('click', handleLogout);
authSwitchLink.addEventListener('click', toggleAuthMode);
authForm.addEventListener('submit', handleAuth);
closeModal.forEach(btn => btn.addEventListener('click', closeModals));
premiumBtn.addEventListener('click', openPaymentModal);
stripePaymentBtn.addEventListener('click', handleStripePayment);
razorpayPaymentBtn.addEventListener('click', handleRazorpayPayment);
uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('dragover', handleDragOver);
uploadArea.addEventListener('drop', handleDrop);
fileInput.addEventListener('change', handleFileSelect);
convertBtn.addEventListener('click', handleConversion);
downloadBtn.addEventListener('click', handleDownload);
convertAnotherBtn.addEventListener('click', handleConvertAnother);
hamburger.addEventListener('click', toggleMobileMenu);

// Close modals when clicking outside
window.addEventListener('click', (e) => {
    if (e.target === authModal) authModal.style.display = 'none';
    if (e.target === paymentModal) paymentModal.style.display = 'none';
    if (e.target === celebration) celebration.style.display = 'none';
});

// Initialize Application
async function initApp() {
    // Check authentication state
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            await loadUserData(user);
            updateUIForUser(user);
        } else {
            currentUser = null;
            userData = {
                isPremium: false,
                conversionsUsed: 0,
                conversionsLimit: 5,
                subscriptionId: null,
                subscriptionEnd: null
            };
            updateUIForGuest();
        }
    });
    
    // Set up file upload area
    setupUploadArea();
    
    // Update usage counter
    updateUsageCounter();
}

// User Data Management
async function loadUserData(user) {
    try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists) {
            userData = { ...userData, ...userDoc.data() };
            
            // Check if subscription is still valid
            if (userData.subscriptionEnd && new Date() > new Date(userData.subscriptionEnd)) {
                userData.isPremium = false;
                await db.collection('users').doc(user.uid).update({
                    isPremium: false
                });
            }
        } else {
            // Create new user document
            await db.collection('users').doc(user.uid).set(userData);
        }
    } catch (error) {
        console.error('Error loading user data:', error);
        showNotification('Error loading user data', 'error');
    }
}

async function saveUserData() {
    if (!currentUser) return;
    
    try {
        await db.collection('users').doc(currentUser.uid).update(userData);
    } catch (error) {
        console.error('Error saving user data:', error);
    }
}

async function incrementConversionCount() {
    if (!currentUser) {
        // For guest users, use localStorage
        let guestConversions = parseInt(localStorage.getItem('guestConversions') || '0');
        guestConversions++;
        localStorage.setItem('guestConversions', guestConversions.toString());
        userData.conversionsUsed = guestConversions;
    } else {
        userData.conversionsUsed++;
        await saveUserData();
    }
    updateUsageCounter();
}

// Authentication Functions
function openAuthModal(login) {
    isLoginMode = login;
    updateAuthModal();
    authModal.style.display = 'block';
}

function updateAuthModal() {
    if (isLoginMode) {
        modalTitle.textContent = 'Login to Your Account';
        authSubmit.textContent = 'Login';
        authSwitchText.innerHTML = 'Don\'t have an account? <a href="#" id="auth-switch-link">Sign up</a>';
        confirmPasswordGroup.style.display = 'none';
    } else {
        modalTitle.textContent = 'Create an Account';
        authSubmit.textContent = 'Sign Up';
        authSwitchText.innerHTML = 'Already have an account? <a href="#" id="auth-switch-link">Login</a>';
        confirmPasswordGroup.style.display = 'block';
    }
    
    // Re-attach event listener after updating HTML
    document.getElementById('auth-switch-link').addEventListener('click', toggleAuthMode);
}

function toggleAuthMode(e) {
    e.preventDefault();
    isLoginMode = !isLoginMode;
    updateAuthModal();
}

function handleAuth(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if (isLoginMode) {
        // Login
        auth.signInWithEmailAndPassword(email, password)
            .then(() => {
                closeModals();
                showNotification('Login successful!', 'success');
            })
            .catch(error => {
                showNotification(error.message, 'error');
            });
    } else {
        // Sign up
        const confirmPassword = document.getElementById('confirm-password').value;
        
        if (password !== confirmPassword) {
            showNotification('Passwords do not match!', 'error');
            return;
        }
        
        if (password.length < 6) {
            showNotification('Password should be at least 6 characters', 'error');
            return;
        }
        
        auth.createUserWithEmailAndPassword(email, password)
            .then(() => {
                closeModals();
                showNotification('Account created successfully!', 'success');
            })
            .catch(error => {
                showNotification(error.message, 'error');
            });
    }
}

function handleLogout() {
    auth.signOut()
        .then(() => {
            showNotification('Logged out successfully!', 'success');
        })
        .catch(error => {
            showNotification(error.message, 'error');
        });
}

function updateUIForUser(user) {
    loginBtn.style.display = 'none';
    signupBtn.style.display = 'none';
    logoutBtn.style.display = 'block';
    
    // Update premium status
    if (userData.isPremium) {
        premiumBtn.style.display = 'none';
        premiumStatus.style.display = 'block';
        premiumOptions.style.display = 'block';
    } else {
        premiumBtn.style.display = 'block';
        premiumStatus.style.display = 'none';
        premiumOptions.style.display = 'none';
        premiumBtn.textContent = 'Upgrade to Premium';
    }
    
    updateUsageCounter();
}

function updateUIForGuest() {
    loginBtn.style.display = 'block';
    signupBtn.style.display = 'block';
    logoutBtn.style.display = 'none';
    premiumBtn.textContent = 'Go Premium';
    premiumOptions.style.display = 'none';
    premiumStatus.style.display = 'none';
    
    // Load guest conversion count
    const guestConversions = parseInt(localStorage.getItem('guestConversions') || '0');
    userData.conversionsUsed = guestConversions;
    updateUsageCounter();
}

function updateUsageCounter() {
    const usageCounter = document.querySelector('.usage-counter');
    if (!usageCounter) {
        // Create usage counter if it doesn't exist
        const converterBody = document.querySelector('.converter-body');
        const newUsageCounter = document.createElement('div');
        newUsageCounter.className = 'usage-counter';
        newUsageCounter.innerHTML = `
            <p>Conversions used today: <span class="count">${userData.conversionsUsed}</span> / ${userData.conversionsLimit}</p>
            ${!userData.isPremium ? '<p><small>Free users get 5 conversions per day</small></p>' : ''}
        `;
        converterBody.appendChild(newUsageCounter);
    } else {
        usageCounter.innerHTML = `
            <p>Conversions used today: <span class="count">${userData.conversionsUsed}</span> / ${userData.conversionsLimit}</p>
            ${!userData.isPremium ? '<p><small>Free users get 5 conversions per day</small></p>' : ''}
        `;
    }
}

// File Handling Functions
function setupUploadArea() {
    // Add event listeners for drag and drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, preventDefaults, false);
    });
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function handleDragOver(e) {
    e.preventDefault();
    uploadArea.style.borderColor = 'var(--primary-color)';
    uploadArea.style.backgroundColor = 'rgba(0, 243, 255, 0.05)';
}

function handleDrop(e) {
    e.preventDefault();
    uploadArea.style.borderColor = 'rgba(0, 243, 255, 0.5)';
    uploadArea.style.backgroundColor = 'transparent';
    
    const files = e.dataTransfer.files;
    if (files.length) {
        handleFiles(files[0]);
    }
}

function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length) {
        handleFiles(files[0]);
    }
}

function handleFiles(file) {
    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
        showNotification('File size must be less than 10MB', 'error');
        return;
    }
    
    // Check file type
    const allowedTypes = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.jpg', '.jpeg', '.png'];
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    
    if (!allowedTypes.includes(fileExtension)) {
        showNotification('File type not supported. Please upload PDF, Word, Excel, PowerPoint, Text, or Image files.', 'error');
        return;
    }
    
    selectedFile = file;
    
    // Update upload area to show file info
    const fileType = file.name.split('.').pop().toUpperCase();
    const fileName = file.name.length > 20 ? file.name.substring(0, 20) + '...' : file.name;
    
    uploadArea.innerHTML = `
        <div class="upload-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M14 2V8H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        </div>
        <p><strong>${fileName}</strong> (${fileType})</p>
        <p class="file-size">${formatFileSize(file.size)}</p>
        <p class="browse-link">Click to change file</p>
    `;
    
    // Enable convert button
    convertBtn.disabled = false;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Conversion Functions
async function handleConversion() {
    if (!selectedFile) {
        showNotification('Please select a file first!', 'error');
        return;
    }
    
    // Check conversion limit for free users
    if (!userData.isPremium && userData.conversionsUsed >= userData.conversionsLimit) {
        showNotification('Daily conversion limit reached. Please upgrade to Premium for unlimited conversions.', 'error');
        return;
    }
    
    // Show loading state
    convertBtn.disabled = true;
    convertBtn.textContent = 'Converting...';
    conversionStatus.style.display = 'block';
    
    // Simulate conversion process with progress
    let progress = 0;
    const interval = setInterval(() => {
        progress += 10;
        progressBar.style.width = `${progress}%`;
        
        if (progress >= 100) {
            clearInterval(interval);
            
            // Increment conversion count
            incrementConversionCount();
            
            // Show celebration animation
            showCelebration();
            
            // Reset button
            convertBtn.disabled = false;
            convertBtn.textContent = 'Convert Now';
            
            // Enable preview button
            previewBtn.disabled = false;
            
            // Hide progress
            setTimeout(() => {
                conversionStatus.style.display = 'none';
                progressBar.style.width = '0%';
            }, 1000);
        }
    }, 200);
}

function showCelebration() {
    celebration.style.display = 'flex';
    
    // Position confetti randomly
    const confettiElements = document.querySelectorAll('.confetti');
    confettiElements.forEach(confetti => {
        const left = Math.random() * 100;
        const animationDelay = Math.random() * 5;
        confetti.style.left = `${left}%`;
        confetti.style.animationDelay = `${animationDelay}s`;
    });
}

function handleDownload() {
    // In a real app, this would download the converted file
    // For demo purposes, we'll just show a notification
    showNotification('File downloaded successfully!', 'success');
    
    // Add watermark for free users
    if (!userData.isPremium) {
        showNotification('Free version - Watermark added to document', 'info');
    }
    
    celebration.style.display = 'none';
    
    // Reset file selection
    selectedFile = null;
    fileInput.value = '';
    uploadArea.innerHTML = `
        <div class="upload-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M14 2V8H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M16 13H8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M16 17H8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M10 9H9H8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        </div>
        <p>Drag & drop your file here or <span class="browse-link">browse</span></p>
    `;
    convertBtn.disabled = true;
    previewBtn.disabled = true;
}

function handleConvertAnother() {
    celebration.style.display = 'none';
}

// Payment Functions
function openPaymentModal() {
    if (!currentUser) {
        showNotification('Please create an account to upgrade to Premium', 'error');
        openAuthModal(false);
        return;
    }
    paymentModal.style.display = 'block';
}

async function handleStripePayment() {
    try {
        // Create checkout session
        const response = await fetch('/create-checkout-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: currentUser.uid,
                email: currentUser.email,
            }),
        });

        const session = await response.json();

        // Redirect to Stripe Checkout
        const result = await stripe.redirectToCheckout({
            sessionId: session.id,
        });

        if (result.error) {
            showNotification(result.error.message, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error processing payment. Please try again.', 'error');
        
        // For demo purposes, simulate successful payment
        simulateSuccessfulPayment();
    }
}

async function handleRazorpayPayment() {
    try {
        const options = {
            key: 'https://rzp.io/rzp/ggY8XrZ', // Replace with your Razorpay key
            amount: 41500, // 415 INR in paise
            currency: 'INR',
            name: 'DocConvert Pro',
            description: 'Premium Subscription',
            image: '/logo.png',
            handler: async function(response) {
                // Payment successful
                await verifyRazorpayPayment(response);
            },
            prefill: {
                name: currentUser.displayName || '',
                email: currentUser.email,
            },
            theme: {
                color: '#00f3ff'
            }
        };

        const rzp = new Razorpay(options);
        rzp.open();
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error processing payment. Please try again.', 'error');
        
        // For demo purposes, simulate successful payment
        simulateSuccessfulPayment();
    }
}

async function verifyRazorpayPayment(paymentResponse) {
    try {
        const response = await fetch('/verify-razorpay-payment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                paymentId: paymentResponse.razorpay_payment_id,
                orderId: paymentResponse.razorpay_order_id,
                signature: paymentResponse.razorpay_signature,
                userId: currentUser.uid,
            }),
        });

        const result = await response.json();

        if (result.success) {
            await activatePremium(currentUser.uid);
            showNotification('Premium subscription activated successfully!', 'success');
            paymentModal.style.display = 'none';
        } else {
            showNotification('Payment verification failed', 'error');
        }
    } catch (error) {
        console.error('Error verifying payment:', error);
        showNotification('Error verifying payment', 'error');
    }
}

async function activatePremium(userId) {
    try {
        const subscriptionEnd = new Date();
        subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1); // 1 month subscription
        
        userData.isPremium = true;
        userData.subscriptionEnd = subscriptionEnd.toISOString();
        userData.conversionsLimit = 9999; // Unlimited
        
        await db.collection('users').doc(userId).update({
            isPremium: true,
            subscriptionEnd: subscriptionEnd.toISOString(),
            conversionsLimit: 9999
        });
        
        updateUIForUser(currentUser);
        showNotification('Premium features activated!', 'success');
    } catch (error) {
        console.error('Error activating premium:', error);
        showNotification('Error activating premium features', 'error');
    }
}

// Demo function for testing
function simulateSuccessfulPayment() {
    if (currentUser) {
        activatePremium(currentUser.uid);
        paymentModal.style.display = 'none';
    }
}

// Utility Functions
function closeModals() {
    authModal.style.display = 'none';
    paymentModal.style.display = 'none';
    celebration.style.display = 'none';
}

function showNotification(message, type) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button class="notification-close">&times;</button>
    `;
    
    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 4px;
        color: white;
        font-weight: 500;
        z-index: 4000;
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-width: 300px;
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
        animation: slideIn 0.3s ease-out;
        ${type === 'success' ? 'background: var(--success-color);' : ''}
        ${type === 'error' ? 'background: var(--error-color);' : ''}
        ${type === 'info' ? 'background: var(--primary-color);' : ''}
        ${type === 'warning' ? 'background: var(--warning-color);' : ''}
    `;
    
    // Add close button event
    notification.querySelector('.notification-close').addEventListener('click', () => {
        notification.remove();
    });
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

function toggleMobileMenu() {
    hamburger.classList.toggle('active');
    navMenu.classList.toggle('active');
}

// Add CSS for notification animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    .notification-close {
        background: none;
        border: none;
        color: white;
        font-size: 20px;
        cursor: pointer;
        margin-left: 10px;
    }
`;
document.head.appendChild(style);