#!/usr/bin/env node

/**
 * Production Cleanup Script
 * Performs final cleanup tasks for production deployment
 */

import fs from 'fs';
import path from 'path';

console.log('🚀 Starting Production Cleanup...');

// Remove debug functions from built files
function removeDebugFunctions(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');

        // Remove debug function assignments
        content = content.replace(/window\.debug\w+ = [^}]+}[^}]*};?/g, '// Debug function removed for production');
        content = content.replace(/window\.test\w+ = [^}]+}[^}]*};?/g, '// Test function removed for production');

        // Remove excessive console.log statements (keep errors/warnings)
        content = content.replace(/console\.log\(['"`][^'"`]*🚛[^'"`]*['"`][^)]*\);?/g, '');
        content = content.replace(/console\.log\(['"`][^'"`]*DEBUG[^'"`]*['"`][^)]*\);?/g, '');

        fs.writeFileSync(filePath, content);
        console.log(`✅ Cleaned: ${filePath}`);
    } catch (error) {
        console.warn(`⚠️ Could not clean ${filePath}:`, error.message);
    }
}

// Hide test elements in HTML
function cleanupHTML(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');

        // Hide test buttons
        content = content.replace(
            /<[^>]+id=['"]test-[^'"]*['"][^>]*>/g,
            match => match.replace('>', ' style="display: none;">')
        );

        fs.writeFileSync(filePath, content);
        console.log(`✅ Cleaned HTML: ${filePath}`);
    } catch (error) {
        console.warn(`⚠️ Could not clean HTML ${filePath}:`, error.message);
    }
}

// Main cleanup process
async function cleanup() {
    try {
        console.log('📁 Cleaning built JavaScript files...');

        // Check if dist directory exists
        const distPath = 'dist';
        if (fs.existsSync(distPath)) {
            // Clean JS files in dist
            const jsFiles = fs.readdirSync(distPath)
                .filter(file => file.endsWith('.js'))
                .map(file => path.join(distPath, file));

            jsFiles.forEach(removeDebugFunctions);

            // Clean HTML files
            const htmlFiles = fs.readdirSync(distPath)
                .filter(file => file.endsWith('.html'))
                .map(file => path.join(distPath, file));

            htmlFiles.forEach(cleanupHTML);
        }

        console.log('🧹 Cleanup tasks completed!');
        console.log('');
        console.log('📋 Next steps:');
        console.log('1. Test the application locally');
        console.log('2. Verify no console errors');
        console.log('3. Check mobile responsiveness');
        console.log('4. Deploy to production');

    } catch (error) {
        console.error('❌ Cleanup failed:', error);
        process.exit(1);
    }
}

// Additional optimization suggestions
console.log('');
console.log('💡 Additional Production Recommendations:');
console.log('   • Enable Cloudflare compression');
console.log('   • Configure CDN cache headers');
console.log('   • Set up error monitoring');
console.log('   • Test on actual mobile devices');
console.log('   • Review security headers');
console.log('');

// Run cleanup
cleanup(); 