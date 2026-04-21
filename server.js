#!/usr/bin/env node

const { spawn } = require('child_process');

console.log('🚀 Starting Budget Calendar Backend Server...\n');

const server = spawn('npx', ['tsx', 'server/index.ts'], {
  stdio: 'inherit',
  shell: true
});

server.on('error', (error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

server.on('close', (code) => {
  console.log(`\n📊 Server process exited with code ${code}`);
  process.exit(code);
});

// Handle termination signals
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down server...');
  server.kill('SIGINT');
});

process.on('SIGTERM', () => {
  server.kill('SIGTERM');
});
