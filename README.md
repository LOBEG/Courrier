# Courrier - Delivery Tracking & Payment Website

A courier tracking and payment confirmation website with Telegram integration, designed to be deployed on Railway.app.

## Features

- 📦 Courier package tracking interface
- 💳 Payment confirmation form
- 🤖 Telegram bot integration for form submissions
- 🛡️ Bot detection (honeypot, rate limiting, timing checks)
- 🚀 Railway-ready deployment configuration
- ✨ Responsive design with TailwindCSS

## Tech Stack

- **Backend**: Node.js + Express
- **Telegram Integration**: node-telegram-bot-api
- **Security**: Helmet, Express Rate Limit
- **Deployment**: Railway.app

## Prerequisites

- Node.js 18+ installed
- A Telegram Bot Token (get from [@BotFather](https://t.me/botfather))
- A Telegram Chat ID (where notifications will be sent)

## Local Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Courrier
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   TELEGRAM_CHAT_ID=your_chat_id_here
   PORT=3000
   NODE_ENV=development
   ```

   **How to get Telegram credentials:**
   - **Bot Token**: Message [@BotFather](https://t.me/botfather) on Telegram, create a new bot with `/newbot`, and copy the token
   - **Chat ID**: 
     - Message your bot first
     - Visit `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
     - Find your chat ID in the response

4. **Run the server**
   ```bash
   npm start
   ```

5. **Access the website**
   
   Open `http://localhost:3000` in your browser

## Railway Deployment

### Method 1: Deploy from GitHub (Recommended)

1. **Push code to GitHub**
   ```bash
   git add .
   git commit -m "Ready for Railway deployment"
   git push origin main
   ```

2. **Create a new project on Railway**
   - Go to [Railway.app](https://railway.app)
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

3. **Configure environment variables**
   
   In Railway dashboard, add these variables:
   - `TELEGRAM_BOT_TOKEN` - Your Telegram bot token
   - `TELEGRAM_CHAT_ID` - Your Telegram chat ID
   - `NODE_ENV` - Set to `production`
   - `PORT` - Railway will set this automatically

4. **Deploy**
   
   Railway will automatically detect the configuration and deploy your app.

### Method 2: Deploy with Railway CLI

1. **Install Railway CLI**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway**
   ```bash
   railway login
   ```

3. **Initialize project**
   ```bash
   railway init
   ```

4. **Set environment variables**
   ```bash
   railway variables set TELEGRAM_BOT_TOKEN=your_token_here
   railway variables set TELEGRAM_CHAT_ID=your_chat_id_here
   railway variables set NODE_ENV=production
   ```

5. **Deploy**
   ```bash
   railway up
   ```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | Token from @BotFather for Telegram notifications |
| `TELEGRAM_CHAT_ID` | Yes | Chat ID where form submissions will be sent |
| `PORT` | No | Server port (default: 3000, Railway sets automatically) |
| `NODE_ENV` | No | Environment (development/production) |
| `RATE_LIMIT_WINDOW_MS` | No | Rate limit window in milliseconds (default: 900000) |
| `RATE_LIMIT_MAX_REQUESTS` | No | Max form submissions per window per IP (default: 20) |

## Bot Detection Features

The application includes multiple layers of bot detection that are **deliberately tuned to let real humans through**. Only obvious automated traffic is blocked.

1. **Honeypot Field** (`company_url`): Hidden input that bots typically auto-fill. Real users never see or interact with it.
2. **Rate Limiting**: 20 form submissions per 15 minutes per IP (lenient enough for shared NAT/office networks).
3. **Timing Check**: Blocks only submissions that arrive less than **1 second** after page load — a real human cannot read and click that fast. If the timestamp is missing or invalid, the submission is **not** blocked (so users with JS disabled or unusual browsers still work).
4. **User-Agent Pattern Match**: Blocks only well-known automation signatures (`curl`, `wget`, `python-requests`, `Go-http-client`, `okhttp`, `scrapy`, `phantomjs`, `selenium`, `puppeteer`, `playwright`, generic `bot`/`crawler`/`spider`). A missing User-Agent is **not** blocked (some privacy tools strip it).
5. **Session Token**: A 20–30 character random token is generated in the browser on visit, stored in `sessionStorage`, and submitted with the form. Useful for correlating submissions and detecting replays.

## API Endpoints

- `GET /` - Main landing page
- `POST /api/submit` - Form submission endpoint
- `GET /success.html` - Success confirmation page
- `GET /health` - Health check endpoint

## Form Submission Data

When a form is submitted, the following data is sent to Telegram:

- Payment method selection
- Session token (20–30 char browser-generated identifier)
- Timestamp
- IP address
- User agent
- Referer URL

## Testing

### Test Form Submission Locally

1. Start the server: `npm start`
2. Open `http://localhost:3000`
3. Scroll to the payment form
4. Check the "Pay by card" checkbox
5. Click "CONFIRM AND PROCEED TO PAYMENT"
6. Check your Telegram for the notification

### Test Bot Detection

Try these scenarios to verify bot detection works:
- Submit form immediately after page load (should fail timing check)
- Fill the honeypot field (hidden, bots often fill it)
- Submit multiple times rapidly (should hit rate limit)

## Project Structure

```
Courrier/
├── server.js                 # Express server with Telegram integration
├── package.json              # Dependencies and scripts
├── railway.json              # Railway deployment configuration
├── Procfile                  # Process configuration
├── success.html              # Success page after form submission
├── .env.example              # Environment variables template
├── f006.backblazeb2.com/     # Static website files
│   └── file/dwiupo/
│       └── index.html        # Main landing page
└── README.md                 # This file
```

## Troubleshooting

### Telegram notifications not working

- Verify your bot token is correct
- Ensure you've messaged the bot at least once
- Check the chat ID is correct
- Review server logs for errors

### Form submission fails

- Check browser console for errors
- Verify the server is running
- Ensure bot detection isn't triggering falsely
- Check rate limiting settings

### Railway deployment issues

- Verify all environment variables are set
- Check Railway logs for errors
- Ensure Node.js version is 18+
- Verify `PORT` variable is not hardcoded

## Security Considerations

- Never commit `.env` file with real credentials
- Keep your Telegram bot token secret
- Regularly update dependencies
- Monitor form submissions for suspicious activity
- Adjust rate limiting based on your needs

## Support

For issues or questions:
1. Check the Troubleshooting section
2. Review Railway logs
3. Check Telegram bot configuration
4. Open an issue on GitHub

## License

MIT License