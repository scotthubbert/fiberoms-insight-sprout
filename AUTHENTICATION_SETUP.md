# Clerk Authentication Setup & Testing Guide

## Quick Start

Clerk authentication has been integrated into the FiberOMS Insight PWA. Follow these steps to test it locally.

## Local Development

### 1. Install Dependencies

```bash
npm install
```

This will install `@clerk/clerk-js` and all other dependencies.

### 2. Start Development Server

```bash
npm run dev
```

### 3. Test the Application

1. Open your browser to the development URL (usually `http://localhost:5173`)
2. You should see the Clerk sign-in page with a beautiful gradient background
3. The main application will be hidden until you authenticate

## Testing Authentication

### Create a Test Account

You have two options:

**Option 1: Use Clerk's test mode**

- Click "Sign up" on the sign-in form
- Enter any email address (Clerk test mode allows any email)
- Complete the sign-up flow
- You'll be automatically signed in

**Option 2: Use existing Clerk accounts**

- If you've configured users in your Clerk dashboard, use those credentials
- Navigate to: https://dashboard.clerk.com
- View your users and their credentials

### Sign-In Flow

1. Enter your email/password
2. Click "Sign in"
3. The authentication UI will disappear
4. The main application will load
5. You should see the map and all features

### Sign-Out Flow

1. Look for the sign-out button in the top-right header (power icon)
2. Click it
3. The page will reload
4. You'll see the sign-in UI again

## Configuration

### Clerk Publishable Key

The current key is hardcoded in `src/services/AuthService.js`:

```javascript
this.publishableKey =
  "pk_test_aHVtb3JvdXMtYmFzaWxpc2stNzIuY2xlcmsuYWNjb3VudHMuZGV2JA";
```

### Moving to Environment Variables (Recommended)

1. Create a `.env` file in the project root:

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_aHVtb3JvdXMtYmFzaWxpc2stNzIuY2xlcmsuYWNjb3VudHMuZGV2JA
```

2. Update `src/services/AuthService.js`:

```javascript
this.publishableKey =
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ||
  "pk_test_aHVtb3JvdXMtYmFzaWxpc2stNzIuY2xlcmsuYWNjb3VudHMuZGV2JA";
```

3. Add `.env` to `.gitignore` (if not already there)

## Building for Production

```bash
npm run build
```

The built files will include Clerk authentication. Deploy the `dist` folder to your hosting platform.

### Production Deployment Checklist

- [ ] Verify Clerk publishable key is correct for production
- [ ] Test sign-in flow on production domain
- [ ] Verify HTTPS is enabled (required by Clerk)
- [ ] Test sign-out flow
- [ ] Verify session persistence across page reloads
- [ ] Configure Clerk allowed domains in dashboard

## Clerk Dashboard Configuration

### Important Settings

1. **Allowed Origins**

   - Add your development domain: `http://localhost:5173`
   - Add your production domain: `https://your-domain.com`

2. **Sign-In Methods**

   - Enable email/password authentication
   - Optional: Enable social sign-in providers (Google, GitHub, etc.)

3. **Session Settings**

   - Configure session timeout
   - Set up session token claims if needed

4. **Appearance**
   - Customize the sign-in UI colors and branding in Clerk dashboard
   - The app already has custom styling, but Clerk allows additional customization

## Architecture

### File Structure

```
src/
├── services/
│   └── AuthService.js          # Core authentication logic
├── ui/
│   └── AuthContainer.js        # Sign-in UI component
└── main.js                     # App initialization with auth check

index.html                      # Auth container and sign-out button
src/style.css                   # Authentication UI styles
```

### Authentication Flow

```
1. App loads → 2. Initialize Clerk → 3. Check auth status
                                            ↓
                                    ┌───────┴────────┐
                                    ↓                ↓
                            Authenticated?    Not Authenticated?
                                    ↓                ↓
                              Show app        Show sign-in UI
                                    ↓                ↓
                         Initialize features   Wait for sign-in
                                    ↓                ↓
                          Setup sign-out      On success → Show app
```

## Troubleshooting

### "Clerk not loading" Error

**Symptoms:** Sign-in UI doesn't appear, blank screen

**Solutions:**

1. Check browser console for errors
2. Verify internet connection (Clerk loads from CDN)
3. Check if ad blockers are interfering
4. Verify publishable key is correct

### Build Errors

**Error:** `"default" is not exported by "@clerk/clerk-js"`

**Solution:** Use named import, not default import:

```javascript
// ✅ Correct
import { Clerk } from "@clerk/clerk-js";

// ❌ Wrong
import Clerk from "@clerk/clerk-js";
```

### Sign-Out Not Working

**Symptoms:** Click sign-out but stays signed in

**Solutions:**

1. Check if sign-out button handler is attached (check console logs)
2. Verify `setupSignOutButton()` is being called
3. Clear browser cache and cookies
4. Try in incognito mode

### Session Not Persisting

**Symptoms:** Signed out after page reload

**Solutions:**

1. Check if cookies are enabled in browser
2. Verify HTTPS is being used (required for secure cookies)
3. Check browser cookie settings for third-party cookies
4. Clear all site data and try again

## Development Tips

### Viewing Auth State

Open browser console and check:

```javascript
// Check if Clerk is initialized
window.Clerk;

// Check auth service
authService.isAuthenticated;
authService.user;

// Check user info
authService.getUser();
```

### Skipping Auth for Development

**Not Recommended**, but if you need to bypass auth temporarily:

1. Comment out the auth check in `src/main.js`
2. Replace with: `window.app = new ImportedApplication();`
3. Remember to uncomment before committing!

### Testing Different User States

1. **Test new user sign-up:** Use incognito mode with a new email
2. **Test existing user:** Use regular browser with known credentials
3. **Test sign-out:** Click sign-out button and verify redirect
4. **Test session persistence:** Sign in, close browser, reopen

## Support

### Clerk Support

- Documentation: https://clerk.com/docs
- Dashboard: https://dashboard.clerk.com
- Support: support@clerk.com

### Project Issues

- Create an issue in the project repository
- Include browser console logs
- Include steps to reproduce

## Next Steps

After verifying authentication works:

1. **Configure production Clerk instance**

   - Create production application in Clerk dashboard
   - Update publishable key for production

2. **Customize sign-in appearance**

   - Modify colors in `src/style.css`
   - Update branding text in `src/ui/AuthContainer.js`
   - Configure Clerk dashboard appearance settings

3. **Add user profile features**

   - Display user info in header
   - Add user settings page
   - Implement role-based access control

4. **Set up monitoring**
   - Track authentication events
   - Monitor sign-in success rates
   - Set up alerts for auth failures

## Additional Resources

- [Clerk React Documentation](https://clerk.com/docs/quickstarts/react)
- [Clerk JavaScript SDK Reference](https://clerk.com/docs/references/javascript/overview)
- [Clerk Customization Guide](https://clerk.com/docs/customization/overview)
- [Session Management](https://clerk.com/docs/authentication/session-management)

---

**Last Updated:** January 13, 2025  
**Clerk SDK Version:** 5.99.0  
**Status:** ✅ Fully Implemented and Tested
