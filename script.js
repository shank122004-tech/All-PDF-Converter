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
let convertedFileUrl = null;
let convertedFileName = '';
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
    console.log('Initializing application...');
    
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
    
    // Add demo premium button listener
    const demoPremiumBtn = document.getElementById('demo-premium');
    if (demoPremiumBtn) {
        demoPremiumBtn.addEventListener('click', activateDemoPremium);
    }
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
    const switchLink = document.getElementById('auth-switch-link');
    if (switchLink) {
        switchLink.addEventListener('click', toggleAuthMode);
    }
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
    let usageCounter = document.querySelector('.usage-counter');
    if (!usageCounter) {
        // Create usage counter if it doesn't exist
        const converterBody = document.querySelector('.converter-body');
        usageCounter = document.createElement('div');
        usageCounter.className = 'usage-counter';
        converterBody.appendChild(usageCounter);
    }
    
    usageCounter.innerHTML = `
        <p>Conversions used today: <span class="count">${userData.conversionsUsed}</span> / ${userData.conversionsLimit}</p>
        ${!userData.isPremium ? '<p><small>Free users get 5 conversions per day</small></p>' : ''}
    `;
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
    console.log('File selected:', file);
    
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
    console.log('Convert button enabled');
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
    console.log('Conversion started...');
    
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
    statusText.textContent = 'Converting your file...';
    
    // Get conversion options
    const fromFormat = document.getElementById('from-format').value;
    const toFormat = document.getElementById('to-format').value;
    
    console.log(`Converting from ${fromFormat} to ${toFormat}`);
    
    // Simulate conversion process with progress
    let progress = 0;
    const interval = setInterval(() => {
        progress += 10;
        progressBar.style.width = `${progress}%`;
        statusText.textContent = `Converting... ${progress}%`;
        
        if (progress >= 100) {
            clearInterval(interval);
            
            // Create converted file
            createConvertedFile(fromFormat, toFormat);
            
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
            
            console.log('Conversion completed successfully');
        }
    }, 200);
}

function createConvertedFile(fromFormat, toFormat) {
    console.log('Creating converted file...');
    
    const originalName = selectedFile.name;
    const baseName = originalName.substring(0, originalName.lastIndexOf('.'));
    
    // Generate converted file name
    convertedFileName = `${baseName}_converted.${toFormat}`;
    
    // Create file content based on format
    let content = '';
    let mimeType = 'text/plain';
    
    switch(toFormat) {
        case 'pdf':
            content = `PDF Document - Converted from ${fromFormat}\n\n`;
            mimeType = 'application/pdf';
            break;
        case 'doc':
        case 'docx':
            content = `Word Document - Converted from ${fromFormat}\n\n`;
            mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            break;
        case 'xls':
        case 'xlsx':
            content = `Excel Spreadsheet - Converted from ${fromFormat}\n\n`;
            mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            break;
        case 'ppt':
        case 'pptx':
            content = `PowerPoint Presentation - Converted from ${fromFormat}\n\n`;
            mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
            break;
        case 'jpg':
        case 'png':
            content = `Image File - Converted from ${fromFormat}\n\n`;
            mimeType = 'image/jpeg';
            break;
        default:
            content = `Text File - Converted from ${fromFormat}\n\n`;
            mimeType = 'text/plain';
    }
    
    content += `Original file: ${originalName}\n`;
    content += `Original format: ${fromFormat}\n`;
    content += `Target format: ${toFormat}\n`;
    content += `Converted on: ${new Date().toLocaleString()}\n`;
    content += `File size: ${formatFileSize(selectedFile.size)}\n\n`;
    
    if (!userData.isPremium) {
        content += '--- Converted with DocConvert Pro (Free Version) ---\n';
        content += 'WATERMARK: This document contains a watermark from the free version.\n';
        content += 'Upgrade to Premium for watermark-free conversions!\n';
    } else {
        content += '--- Converted with DocConvert Pro (Premium Version) ---\n';
        content += 'Premium Feature: No watermark, high quality conversion\n';
    }
    
    content += '\nThank you for using DocConvert Pro!\n';
    
    // Create blob and URL
    const blob = new Blob([content], { type: mimeType });
    convertedFileUrl = URL.createObjectURL(blob);
    
    console.log('Converted file created:', convertedFileName);
}

function showCelebration() {
    console.log('Showing celebration modal');
    
    celebration.style.display = 'flex';
    
    // Position confetti randomly
    const confettiElements = document.querySelectorAll('.confetti');
    confettiElements.forEach((confetti, index) => {
        const left = Math.random() * 100;
        const animationDelay = Math.random() * 5;
        confetti.style.left = `${left}%`;
        confetti.style.animationDelay = `${animationDelay}s`;
    });
    
    // Update download button text based on premium status
    if (!userData.isPremium) {
        downloadBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" style="margin-right: 8px;"><path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 10L12 15L17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> Download File (With Watermark)';
    } else {
        downloadBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" style="margin-right: 8px;"><path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 10L12 15L17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> Download File (Premium)';
    }
}

function handleDownload() {
    console.log('Download initiated');
    
    if (!convertedFileUrl) {
        showNotification('No converted file available. Please convert a file first.', 'error');
        return;
    }
    
    try {
        // Create download link
        const downloadLink = document.createElement('a');
        downloadLink.href = convertedFileUrl;
        downloadLink.download = convertedFileName;
        
        // Trigger download
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        // Show notification
        showNotification('File downloaded successfully!', 'success');
        
        // Add watermark notification for free users
        if (!userData.isPremium) {
            showNotification('Free version - Watermark added to document', 'info');
        }
        
        console.log('File downloaded:', convertedFileName);
        
    } catch (error) {
        console.error('Download error:', error);
        showNotification('Error downloading file. Please try again.', 'error');
    }
}

function handleConvertAnother() {
    console.log('Starting new conversion');
    
    celebration.style.display = 'none';
    
    // Reset file selection
    selectedFile = null;
    convertedFileUrl = null;
    convertedFileName = '';
    fileInput.value = '';
    
    // Reset upload area
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
    
    console.log('Ready for new conversion');
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
        showNotification('Redirecting to Stripe payment...', 'info');
        
        // For demo purposes, we'll simulate a successful payment
        setTimeout(() => {
            simulateSuccessfulPayment();
        }, 2000);
        
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error processing payment. Please try again.', 'error');
    }
}

async function handleRazorpayPayment() {
    try {
        // Redirect to Razorpay payment link
        const razorpayPaymentLink = 'https://rzp.io/l/docconvert-pro-premium';
        window.open(razorpayPaymentLink, '_blank');
        
        showNotification('Redirected to Razorpay payment page. Please complete the payment to activate premium features.', 'info');
        
        // Show verification option for demo
        showPaymentVerificationOption();
        
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error processing payment. Please try again.', 'error');
    }
}

function showPaymentVerificationOption() {
    // Remove existing verify button if any
    const existingButton = document.querySelector('#payment-verify-btn');
    if (existingButton) {
        existingButton.remove();
    }
    
    // Create a verification button for demo purposes
    const verifyButton = document.createElement('button');
    verifyButton.id = 'payment-verify-btn';
    verifyButton.textContent = 'I have completed the payment';
    verifyButton.className = 'btn btn-primary';
    verifyButton.style.marginTop = '10px';
    verifyButton.style.width = '100%';
    
    verifyButton.addEventListener('click', () => {
        simulateSuccessfulPayment();
        verifyButton.remove();
    });
    
    const paymentOption = document.querySelector('.payment-option:last-child');
    paymentOption.appendChild(verifyButton);
}

function activateDemoPremium() {
    if (!currentUser) {
        showNotification('Please create an account first', 'error');
        openAuthModal(false);
        return;
    }
    simulateSuccessfulPayment();
}

async function activatePremium(userId) {
    try {
        const subscriptionEnd = new Date();
        subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1); // 1 month subscription
        
        userData.isPremium = true;
        userData.subscriptionEnd = subscriptionEnd.toISOString();
        userData.conversionsLimit = 9999; // Unlimited
        
        if (currentUser) {
            await db.collection('users').doc(currentUser.uid).update({
                isPremium: true,
                subscriptionEnd: subscriptionEnd.toISOString(),
                conversionsLimit: 9999
            });
        }
        
        updateUIForUser(currentUser);
        showNotification('Premium features activated successfully!', 'success');
        paymentModal.style.display = 'none';
        
        console.log('Premium activated for user:', userId);
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
    } else {
        showNotification('Please create an account first', 'error');
    }
}

// Utility Functions
function closeModals() {
    authModal.style.display = 'none';
    paymentModal.style.display = 'none';
    celebration.style.display = 'none';
}

function showNotification(message, type) {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());
    
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
    
    /* Download button specific styles */
    #download-btn {
        background: linear-gradient(45deg, var(--success-color), var(--accent-color));
        color: var(--dark-bg);
        font-weight: bold;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    #download-btn:hover {
        box-shadow: 0 0 20px rgba(0, 255, 157, 0.8);
        transform: translateY(-2px);
    }
    
    /* Enhanced Progress Bar */
    .progress-bar {
        width: 100%;
        height: 8px;
        background: rgba(0, 243, 255, 0.2);
        border-radius: 4px;
        overflow: hidden;
        margin-bottom: 15px;
        position: relative;
    }
    
    .progress {
        height: 100%;
        background: linear-gradient(90deg, var(--primary-color), var(--accent-color));
        width: 0%;
        transition: width 0.3s ease;
        position: relative;
    }
    
    .progress::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
        animation: shimmer 2s infinite;
    }
    
    @keyframes shimmer {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
    }
`;
document.head.appendChild(style);

console.log('Script loaded successfully');
