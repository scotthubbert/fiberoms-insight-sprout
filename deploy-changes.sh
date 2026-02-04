#!/bin/bash

# FiberOMS Insight - Deploy Only Changed Files
# Edit the configuration section below with your server details

# ========== CONFIGURATION ==========
# Edit these values for your server
SERVER_USER="username"
SERVER_HOST="your-server.com"
WEB_ROOT="/var/www/html"
SSH_PORT="22"  # Change if using non-standard port

# Optional: SSH key path (leave empty to use default)
SSH_KEY=""  # e.g., "~/.ssh/mykey.pem"

# ========== DO NOT EDIT BELOW THIS LINE ==========

# Build the SSH command
SSH_CMD="ssh"
RSYNC_SSH_CMD="ssh"
if [ ! -z "$SSH_KEY" ]; then
    SSH_CMD="ssh -i $SSH_KEY"
    RSYNC_SSH_CMD="ssh -i $SSH_KEY"
fi
if [ "$SSH_PORT" != "22" ]; then
    SSH_CMD="$SSH_CMD -p $SSH_PORT"
    RSYNC_SSH_CMD="$RSYNC_SSH_CMD -p $SSH_PORT"
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 FiberOMS Insight - Deploying Changed Files${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Check if dist directory exists
if [ ! -d "dist" ]; then
    echo -e "${RED}❌ Error: dist/ directory not found!${NC}"
    echo "Please run 'npm run build:production' first."
    exit 1
fi

# Display configuration
echo -e "${YELLOW}📋 Deployment Configuration:${NC}"
echo -e "   Server: ${GREEN}$SERVER_USER@$SERVER_HOST${NC}"
echo -e "   Path: ${GREEN}$WEB_ROOT${NC}"
echo -e "   Port: ${GREEN}$SSH_PORT${NC}"
if [ ! -z "$SSH_KEY" ]; then
    echo -e "   SSH Key: ${GREEN}$SSH_KEY${NC}"
fi
echo ""

# Test connection
echo -e "${YELLOW}🔌 Testing connection...${NC}"
$SSH_CMD $SERVER_USER@$SERVER_HOST "echo 'Connection successful!'" 2>/dev/null
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error: Cannot connect to server!${NC}"
    echo "Please check your configuration settings at the top of this script."
    exit 1
fi
echo -e "${GREEN}✅ Connection successful!${NC}"
echo ""

# Deploy HTML and service worker files
echo -e "${YELLOW}📦 Uploading HTML and service worker files...${NC}"
rsync -avz --progress -e "$RSYNC_SSH_CMD" \
    dist/index.html \
    dist/index.html.br \
    dist/index.html.gz \
    dist/sw.js \
    dist/workbox-*.js \
    $SERVER_USER@$SERVER_HOST:$WEB_ROOT/

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error uploading HTML files!${NC}"
    exit 1
fi

# Deploy JavaScript assets
echo -e "${YELLOW}📦 Uploading JavaScript assets...${NC}"
rsync -avz --progress -e "$RSYNC_SSH_CMD" \
    dist/assets/index-*.js \
    $SERVER_USER@$SERVER_HOST:$WEB_ROOT/assets/

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error uploading JavaScript assets!${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo -e "${BLUE}📋 Post-Deployment Checklist:${NC}"
echo "   1. Clear browser cache (Ctrl+F5 / Cmd+Shift+R)"
echo "   2. Test the Splitter popup functionality"
echo "   3. Verify 'Copy Info' button works"
echo "   4. Check browser console for errors"
echo "   5. Test on mobile devices"
echo ""
echo -e "${YELLOW}💡 Tip: Service worker will auto-update within 24 hours${NC}"