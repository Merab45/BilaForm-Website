const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');

const host = '127.0.0.1';
const port = Number(process.env.PORT) || 8000;
const healthUrl = `http://${host}:${port}/api/health`;

function checkExistingApi() {
  return new Promise((resolve) => {
    const request = http.get(healthUrl, { timeout: 800 }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        if (response.statusCode !== 200) return resolve('occupied');
        try {
          resolve(JSON.parse(body).service === 'bilaform-api' ? 'running' : 'occupied');
        } catch {
          resolve('occupied');
        }
      });
    });
    request.on('timeout', () => request.destroy());
    request.on('error', (error) => resolve(error.code === 'ECONNREFUSED' ? 'stopped' : 'unavailable'));
  });
}

async function start() {
  const current = await checkExistingApi();
  if (current === 'running') {
    console.log(`BilaForm API is already running at http://${host}:${port}`);
    return;
  }
  if (current === 'occupied') {
    console.error(`Port ${port} is responding, but it is not the BilaForm API. Stop that service or change PORT before starting BilaForm.`);
    process.exitCode = 1;
    return;
  }

  if (current === 'unavailable') console.log('Could not check for an existing API; trying to start BilaForm.');
  console.log('Starting BilaForm API');
  const server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    cwd: path.join(__dirname, '..'),
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
  });
  server.on('error', (error) => {
    console.error(`Could not start BilaForm API: ${error.message}`);
    process.exitCode = 1;
  });
  server.on('exit', (code, signal) => {
    if (signal) console.log(`BilaForm API stopped (${signal}).`);
    else if (code) process.exitCode = code;
  });
}

start().catch((error) => {
  console.error(`Could not start BilaForm API: ${error.message}`);
  process.exitCode = 1;
});
