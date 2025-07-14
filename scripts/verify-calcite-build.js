// Build Verification Script for CalciteUI Components
// Usage: node scripts/verify-calcite-build.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distPath = path.join(__dirname, '..', 'dist');
const assetsPath = path.join(distPath, 'assets');
const calcitePath = path.join(distPath, 'calcite');

console.log('🔍 CalciteUI Build Verification\n');

// Check if dist folder exists
if (!fs.existsSync(distPath)) {
    console.error('❌ dist folder not found. Run "npm run build" first.');
    process.exit(1);
}

// Required CalciteUI components
const requiredComponents = [
    'calcite-list',
    'calcite-list-item',
    'calcite-icon',
    'calcite-button',
    'calcite-shell',
    'calcite-panel',
    'calcite-block'
];

// Required CalciteUI icons
const requiredIcons = [
    'car',
    'flash',
    'information',
    'exclamation-mark-triangle'
];

console.log('📦 Checking JavaScript bundles...');

// Check if CalciteUI components are in the JS bundles
const jsFiles = fs.readdirSync(assetsPath).filter(file => file.endsWith('.js'));
let componentsFound = {};
let totalBundleSize = 0;

jsFiles.forEach(file => {
    const filePath = path.join(assetsPath, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const fileSize = fs.statSync(filePath).size;
    totalBundleSize += fileSize;

    requiredComponents.forEach(component => {
        if (content.includes(component) || content.includes(component.replace('-', ''))) {
            componentsFound[component] = true;
        }
    });
});

console.log(`📊 Total JS bundle size: ${(totalBundleSize / 1024 / 1024).toFixed(2)} MB\n`);

console.log('🧩 Component Bundle Check:');
requiredComponents.forEach(component => {
    const found = componentsFound[component];
    console.log(`${found ? '✅' : '❌'} ${component}: ${found ? 'found in bundle' : 'NOT found'}`);
});

// Check CalciteUI assets
console.log('\n🎨 Checking CalciteUI assets...');

if (fs.existsSync(calcitePath)) {
    console.log('✅ CalciteUI assets folder exists');

    // Check icons
    const iconPath = path.join(calcitePath, 'assets', 'icon');
    if (fs.existsSync(iconPath)) {
        console.log('✅ CalciteUI icons folder exists');

        const iconFiles = fs.readdirSync(iconPath);
        requiredIcons.forEach(icon => {
            const iconVariants = iconFiles.filter(file => file.startsWith(icon));
            if (iconVariants.length > 0) {
                console.log(`✅ ${icon}: ${iconVariants.length} variants found`);
            } else {
                console.log(`❌ ${icon}: NOT found`);
            }
        });
    } else {
        console.log('❌ CalciteUI icons folder missing');
    }

    // Check translation files
    const t9nPath = path.join(calcitePath, 'assets', 't9n');
    if (fs.existsSync(t9nPath)) {
        console.log('✅ CalciteUI translation files exist');
    } else {
        console.log('❌ CalciteUI translation files missing');
    }
} else {
    console.log('❌ CalciteUI assets folder missing');
}

// Check main HTML file for CalciteUI references
console.log('\n📄 Checking index.html...');
const htmlPath = path.join(distPath, 'index.html');
if (fs.existsSync(htmlPath)) {
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    // Check for CalciteUI components in HTML
    const componentsInHtml = requiredComponents.filter(component =>
        htmlContent.includes(`<${component}`) || htmlContent.includes(`</${component}>`)
    );

    if (componentsInHtml.length > 0) {
        console.log(`✅ Found ${componentsInHtml.length} CalciteUI components in HTML`);
    } else {
        console.log('⚠️  No CalciteUI components found in HTML (components may be dynamically created)');
    }
} else {
    console.log('❌ index.html not found');
}

console.log('\n🏁 Verification complete!');
console.log('\n💡 To test CalciteUI in browser:');
console.log('   1. Open your built app');
console.log('   2. Open browser console');
console.log('   3. Run: window.verifyCalciteUI()');
console.log('   4. Run: window.debugCalciteUI()'); 