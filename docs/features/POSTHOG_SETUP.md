# PostHog Setup Guide

## Quick Start

### 1. Get Your API Key First ⚠️

**You need to get your API key BEFORE configuring the code:**

1. Go to [posthog.com](https://posthog.com) and sign up
2. Create a new project
3. On the installation page, copy your **Project API Key**
   - Format: `phc_a2uD2wO3MaDp0q9N4H5MeXxoHCtLYcxCM75NqiM22zb`
4. Note your **API Host** (usually `https://us.i.posthog.com` or `https://eu.i.posthog.com`)

### 2. Install PostHog (Already Done ✅)

PostHog is already installed in this project:
```bash
npm install posthog-js  # Already installed ✅
```

### 3. Configure Environment Variables

Create or update your `.env` file:

```bash
# Enable PostHog
VITE_POSTHOG_ENABLED=true

# Your Project API Key (get from PostHog dashboard)
VITE_POSTHOG_KEY=phc_your_actual_api_key_here

# API Host (check your PostHog project settings)
# US region (default):
VITE_POSTHOG_HOST=https://us.i.posthog.com
# OR EU region:
# VITE_POSTHOG_HOST=https://eu.i.posthog.com
```

### 4. Restart Your Dev Server

After adding environment variables:
```bash
npm run dev
```

### 5. Verify It's Working

1. Open your app in the browser
2. Click around - navigate, search, toggle layers
3. Go to PostHog dashboard → **Activity** → **Live events**
4. You should see events appearing!

## Finding Your API Key

If you already created a project but need to find your API key:

1. Go to PostHog dashboard
2. Click **Project Settings** (gear icon)
3. Scroll to **Project API Key**
4. Copy the key (starts with `phc_`)

## Finding Your API Host

Your API host depends on which region you selected when creating your PostHog account:

- **US**: `https://us.i.posthog.com` (most common)
- **EU**: `https://eu.i.posthog.com`

You can check this in:
- PostHog dashboard → **Project Settings** → **API Host**
- Or look at the installation code snippet PostHog shows you

## Troubleshooting

### No Events Showing Up?

1. **Check environment variables are loaded:**
   ```bash
   # In your browser console, check:
   console.log(import.meta.env.VITE_POSTHOG_ENABLED)
   console.log(import.meta.env.VITE_POSTHOG_KEY)
   ```

2. **Check browser console for errors:**
   - Look for PostHog initialization messages
   - Check for any CORS or network errors

3. **Verify API key format:**
   - Should start with `phc_`
   - Should be your Project API Key (not Personal API Key)

4. **Check PostHog dashboard:**
   - Make sure you're looking at the correct project
   - Check **Activity** → **Live events** (not Insights)

### Events Showing But Not Detailed?

- PostHog autocapture is enabled, so clicks should be tracked automatically
- Custom events (like `user_click`, `search_performed`) are sent via our tracking functions
- Check **Insights** → **Trends** to see aggregated data

## Next Steps

Once PostHog is working:

1. **Explore Live Events** - See what's being tracked in real-time
2. **Create Insights** - Build queries to see "most clicked sections"
3. **Set Up Dashboards** - Create custom dashboards for your key metrics
4. **Enable Session Replay** (optional) - Watch user sessions

## Reference

- [PostHog JavaScript Docs](https://posthog.com/docs/libraries/js)
- [PostHog Setup Guide](https://posthog.com/docs/getting-started/install)

