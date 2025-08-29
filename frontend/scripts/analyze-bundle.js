#!/usr/bin/env node

/**
 * Bundle Analysis Script for BoosterBeacon Frontend
 * 
 * This script builds the production bundle and generates analysis reports
 * to help identify optimization opportunities.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Starting bundle analysis...\n');

try {
  // Build the production bundle
  console.log('📦 Building production bundle...');
  execSync('npm run build', { stdio: 'inherit' });
  
  // Check if analysis file was generated
  const analysisFile = path.join(__dirname, '../dist/bundle-analysis.html');
  if (fs.existsSync(analysisFile)) {
    console.log('✅ Bundle analysis generated successfully!');
    console.log(`📊 Analysis file: ${analysisFile}`);
  } else {
    console.log('❌ Bundle analysis file not found');
  }
  
  // Generate size report
  console.log('\n📈 Bundle size report:');
  const distDir = path.join(__dirname, '../dist/assets');
  
  if (fs.existsSync(distDir)) {
    const files = fs.readdirSync(distDir)
      .filter(file => file.endsWith('.js'))
      .map(file => {
        const filePath = path.join(distDir, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          size: stats.size,
          sizeKB: (stats.size / 1024).toFixed(2)
        };
      })
      .sort((a, b) => b.size - a.size);
    
    console.log('\nLargest JavaScript bundles:');
    files.slice(0, 10).forEach((file, index) => {
      const icon = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '📄';
      console.log(`${icon} ${file.name}: ${file.sizeKB} kB`);
    });
    
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    console.log(`\n📊 Total JS bundle size: ${(totalSize / 1024).toFixed(2)} kB`);
    
    // Identify optimization opportunities
    console.log('\n🎯 Optimization opportunities:');
    const largeFiles = files.filter(file => file.size > 50 * 1024); // > 50KB
    if (largeFiles.length > 0) {
      largeFiles.forEach(file => {
        console.log(`⚠️  ${file.name} (${file.sizeKB} kB) - Consider code splitting`);
      });
    } else {
      console.log('✅ No large bundles detected - good job!');
    }
  }
  
  console.log('\n🎉 Bundle analysis complete!');
  console.log(`\nTo view detailed analysis:`);
  console.log(`- Open: dist/bundle-analysis.html`);
  console.log(`- Or run: npm run analyze`);
  
} catch (error) {
  console.error('❌ Bundle analysis failed:', error.message);
  process.exit(1);
}