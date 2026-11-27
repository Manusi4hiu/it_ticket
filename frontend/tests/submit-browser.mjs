// Run after npm run build: node tests/submit-browser.mjs
// Production React Router + real Flask/SQLite test backend; only email is stubbed.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import { chromium } from '@playwright/test';

async function port() {
  const server = net.createServer().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const value = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return value;
}
const backendPort = await port();
const frontendPort = await port();
const api = `http://127.0.0.1:${backendPort}/api`;
const origin = `http://127.0.0.1:${frontendPort}`;
const base = `${origin}/it_ticket/frontend`;
const jobs = [];
let logs = '';
function start(command, args, env = {}) {
  const job = spawn(command, args, { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  job.stdout.on('data', data => { logs += data; });
  job.stderr.on('data', data => { logs += data; });
  jobs.push(job);
}
async function ready(url) {
  for (let i = 0; i < 600; i++) {
    try { if ((await fetch(url)).ok) return; } catch {}
    if (jobs.some(job => job.exitCode !== null)) throw new Error(logs);
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`Server not ready: ${url}\n${logs}`);
}
let browser;
try {
  start('../backend/venv/bin/python', ['../backend/tests/test_submit_routing.py', '--serve', String(backendPort)]);
  await ready(`${api}/settings/teams`);
  start(process.execPath, ['node_modules/@react-router/serve/bin.js', 'build/server/index.js'], {
    NODE_ENV: 'production', PORT: String(frontendPort), HOST: '127.0.0.1', API_URL: api, SESSION_SECRET: 'test-only-session-secret',
  });
  await ready(`${base}/`);
  browser = await chromium.launch();
  const page = await browser.newPage({ timezoneId: 'Asia/Jakarta' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === origin ? route.continue() : route.abort();
  });
  for (const [label, path, code, category] of [
    ['Request IT', '/submit-ticket', 'IT', 'Hardware'],
    ['Request Corcom', '/corcom/submit-ticket', 'COC', 'Graphic Design'],
  ]) {
    await page.goto(`${base}/`);
    assert.equal(await page.getByRole('link', { name: label, exact: true }).getAttribute('href'), `/it_ticket/frontend${path}`);
    await page.getByRole('link', { name: label, exact: true }).click();
    await page.waitForURL(`${base}${path}`);
    await page.getByText(label, { exact: true }).waitFor();
    assert.equal(await page.getByText('Ticket For', { exact: false }).count(), 0);
    assert.equal(await page.locator('[name="teamId"], [name="teamCode"]').count(), 0);
    assert.equal(await page.locator('#deadline').count(), code === 'COC' ? 1 : 0);
    await page.locator('#name').fill('Browser Requester');
    await page.getByRole('combobox').nth(0).click();
    await page.getByRole('option', { name: 'Finance', exact: true }).click();
    await page.getByRole('combobox').nth(1).click();
    assert.equal(await page.getByRole('option', { name: code === 'IT' ? 'Graphic Design' : 'Hardware', exact: true }).count(), 0);
    await page.getByRole('option', { name: category, exact: true }).click();
    await page.locator('#subject').fill(`Browser ${code} request`);
    await page.locator('#description').fill('Actual submit and track regression');
    if (code === 'COC') {
      assert.equal(await page.locator('#deadline').getAttribute('required'), '');
      await page.locator('#deadline').fill('2099-12-01T12:30');
    }
    await page.locator('form').evaluate((form, spoof) => {
      for (const [name, value] of Object.entries(spoof)) {
        const input = document.createElement('input');
        input.type = 'hidden'; input.name = name; input.value = value; form.append(input);
      }
    }, { teamId: code === 'IT' ? '7' : '2', teamCode: code === 'IT' ? 'COC' : 'IT', team: code === 'IT' ? 'COC' : 'IT' });
    await page.getByRole('button', { name: 'Submit Ticket', exact: true }).click();
    await page.getByText('Ticket Created Successfully!').waitFor();
    const ticketCode = await page.locator('[class*="ticketId"]').textContent();
    const saved = await (await fetch(`${api}/tickets/${ticketCode}`)).json();
    assert.equal(saved.ticket.teamCode, code);
    assert.equal(saved.ticket.submitterDepartment, null); // Mobile privacy guard: public tracking redacts requester details.
    assert.match(ticketCode, /^FIN-\d+$/);
    assert.equal(saved.ticket.slaDeadline, code === 'COC' ? '2099-12-01T05:30:00Z' : null);
    await page.goto(`${base}/`);
    await page.getByRole('button', { name: 'Track Your Ticket', exact: true }).click();
    await page.locator('#ticket-id').fill(` #${ticketCode} `);
    await page.getByRole('button', { name: 'Track Ticket', exact: true }).click();
    await page.waitForURL(`${base}/ticket/${ticketCode}`);
    await page.getByText(`Browser ${code} request`, { exact: true }).waitFor();
    console.log(`PASS: production ${label}, submit persisted to ${code}, shared home tracking ${ticketCode}`);
  }
  const redirected = await fetch(`${base}/submit-ticket?teamId=7`, { redirect: 'manual' });
  assert.equal(redirected.status, 302);
  assert.equal(redirected.headers.get('Location'), '/it_ticket/frontend/corcom/submit-ticket');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${base}/`);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  for (const label of ['Request IT', 'Request Corcom', 'Track Your Ticket']) {
    assert.equal(await page.getByRole(label.startsWith('Request') ? 'link' : 'button', { name: label, exact: true }).isVisible(), true);
  }
  assert.deepEqual(errors, []);
  console.log('PASS: production basename legacy redirect, mobile CTAs, no browser runtime errors');
  await page.waitForFunction(async () => Boolean((await navigator.serviceWorker.getRegistration())?.active), null, { timeout: 30000 });
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.evaluate(async () => {
    for (const name of ['api-tickets-sw', 'api-users-sw', 'pages-cache']) {
      await caches.open(name);
    }
    navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_API_CACHES' });
  });
  await page.waitForFunction(async () => !(await caches.keys()).some(name => ['api-tickets-sw', 'api-users-sw', 'pages-cache'].includes(name)));
  await page.context().setOffline(true);
  await page.goto(`${base}/dashboard`);
  await page.getByRole('heading', { name: 'Koneksi Terputus', exact: true }).waitFor();
  await page.context().setOffline(false);
  console.log('PASS: active production service worker clears session caches and serves offline fallback');
} catch (error) {
  console.error(logs.slice(-12000));
  throw error;
} finally {
  await browser?.close();
  for (const job of jobs) { if (job.exitCode === null) { job.kill('SIGTERM'); await once(job, 'exit'); } }
}
