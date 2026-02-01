# Quick Deploy Reference Card

## 🚀 Quick Deploy (Just the Changed Files)

### Using rsync (Recommended)
```bash
# Replace 'username' and 'your-server.com' with your actual values
# Replace '/var/www/html' with your actual web root path

# Step 1: Deploy HTML and Service Worker files
rsync -avz --progress \
  dist/index.html dist/index.html.br dist/index.html.gz \
  dist/sw.js dist/workbox-*.js \
  username@your-server.com:/var/www/html/

# Step 2: Deploy JavaScript assets
rsync -avz --progress \
  dist/assets/index-*.js \
  username@your-server.com:/var/www/html/assets/
```

### Using scp (Alternative)
```bash
# Step 1: Deploy HTML and Service Worker files
scp dist/index.html* dist/sw.js dist/workbox-*.js \
  username@your-server.com:/var/www/html/

# Step 2: Deploy JavaScript assets
scp dist/assets/index-*.js \
  username@your-server.com:/var/www/html/assets/
```

## 📋 What Each Command Does

### rsync Flags:
- `-a` = Archive mode (keeps file permissions)
- `-v` = Verbose (shows what's being copied)
- `-z` = Compress during transfer (faster)
- `--progress` = Shows transfer progress bar

### scp:
- Simple secure copy
- No resume capability
- Good for small files

## 🎯 Files Being Deployed (120KB total)

1. `index.html` (+ compressed versions) - Updated references
2. `index-D6kns56k.js` - Your app code with Splitter changes
3. `sw.js` - Service worker
4. `workbox-*.js` - PWA runtime

## ⚡ One-Line Deploy

### For rsync:
```bash
rsync -avz dist/index.html* dist/sw.js dist/workbox-*.js username@server.com:/path/to/web/ && rsync -avz dist/assets/index-*.js username@server.com:/path/to/web/assets/
```

### For scp:
```bash
scp dist/index.html* dist/sw.js dist/workbox-*.js username@server.com:/path/to/web/ && scp dist/assets/index-*.js username@server.com:/path/to/web/assets/
```

## 🔍 Verify Deployment

```bash
# Check if files were uploaded
ssh username@your-server.com "ls -la /var/www/html/index.html /var/www/html/assets/index-*.js"
```

## 💡 Pro Tips

1. **First time?** Test with `--dry-run` flag:
   ```bash
   rsync -avz --dry-run dist/index.html username@server.com:/path/
   ```

2. **Different SSH port?** (e.g., port 2222):
   ```bash
   rsync -avz -e "ssh -p 2222" dist/index.html username@server.com:/path/
   scp -P 2222 dist/index.html username@server.com:/path/
   ```

3. **Using SSH key?**
   ```bash
   rsync -avz -e "ssh -i ~/.ssh/mykey.pem" dist/index.html username@server.com:/path/
   scp -i ~/.ssh/mykey.pem dist/index.html username@server.com:/path/
   ```

---
**Remember**: Only 120KB to upload instead of 76MB! 🎉