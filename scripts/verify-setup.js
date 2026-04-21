#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Budget Calendar - Setup Verification\n');
console.log('=' .repeat(50));

const checks = [];

// Check Node.js version
try {
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
  if (majorVersion >= 18) {
    checks.push({ name: 'Node.js version', status: '✅', details: nodeVersion });
  } else {
    checks.push({ name: 'Node.js version', status: '❌', details: `${nodeVersion} (need 18+)` });
  }
} catch (error) {
  checks.push({ name: 'Node.js version', status: '❌', details: 'Not found' });
}

// Check MongoDB
try {
  const mongoVersion = execSync('mongod --version', { encoding: 'utf8' });
  const versionMatch = mongoVersion.match(/v(\d+\.\d+\.\d+)/);
  if (versionMatch) {
    checks.push({ name: 'MongoDB', status: '✅', details: versionMatch[1] });
  } else {
    checks.push({ name: 'MongoDB', status: '⚠️', details: 'Version unknown' });
  }
} catch (error) {
  checks.push({ name: 'MongoDB', status: '❌', details: 'Not installed or not in PATH' });
}

// Check if node_modules exists
const nodeModulesPath = path.join(__dirname, '..', 'node_modules');
if (fs.existsSync(nodeModulesPath)) {
  checks.push({ name: 'Dependencies', status: '✅', details: 'Installed' });
} else {
  checks.push({ name: 'Dependencies', status: '❌', details: 'Run: npm install' });
}

// Check .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  checks.push({ name: 'Environment file', status: '✅', details: '.env.local exists' });
} else {
  checks.push({ name: 'Environment file', status: '⚠️', details: 'Using defaults' });
}

// Check port availability
const net = require('net');

function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}

(async () => {
  const port3000Available = await checkPort(3000);
  const port3001Available = await checkPort(3001);

  checks.push({ 
    name: 'Port 3000 (Frontend)', 
    status: port3000Available ? '✅' : '❌', 
    details: port3000Available ? 'Available' : 'In use' 
  });

  checks.push({ 
    name: 'Port 3001 (Backend)', 
    status: port3001Available ? '✅' : '❌', 
    details: port3001Available ? 'Available' : 'In use' 
  });

  // Print results
  console.log('\n📋 System Requirements:\n');
  checks.forEach(check => {
    console.log(`${check.status}  ${check.name.padEnd(25)} ${check.details}`);
  });

  console.log('\n' + '='.repeat(50));

  // Summary
  const allPass = checks.every(c => c.status === '✅');
  const hasWarnings = checks.some(c => c.status === '⚠️');
  const hasFails = checks.some(c => c.status === '❌');

  if (allPass) {
    console.log('\n🎉 All checks passed! You\'re ready to start:\n');
    console.log('   npm run dev:all\n');
  } else if (hasFails) {
    console.log('\n⚠️  Some checks failed. Please fix the issues above.\n');
    
    // Provide specific help
    if (!fs.existsSync(nodeModulesPath)) {
      console.log('📦 Install dependencies:');
      console.log('   npm install\n');
    }
    
    if (!port3000Available || !port3001Available) {
      console.log('🔌 Free up ports:');
      console.log('   lsof -ti:3000 | xargs kill -9');
      console.log('   lsof -ti:3001 | xargs kill -9\n');
    }
  } else if (hasWarnings) {
    console.log('\n⚠️  Setup complete with warnings. You can proceed.\n');
    console.log('   npm run dev:all\n');
  }

  console.log('📚 For detailed setup instructions, see:');
  console.log('   QUICKSTART.md\n');
})();
