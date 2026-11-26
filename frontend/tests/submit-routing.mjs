// Run: node tests/submit-routing.mjs (isolated API fixtures; no live backend).
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

const teams = [
  { id: 2, code: 'IT', name: 'IT', isActive: true },
  { id: 7, code: 'COC', name: 'Graphic Design', isActive: true },
];
const categories = [
  { id: 1, name: 'Other', teamId: null, isActive: true },
  { id: 2, name: 'Hardware', teamId: 2, isActive: true },
  { id: 3, name: 'Graphic Design', teamId: 7, isActive: true },
];
const sent = [];
let apiError;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  const path = new URL(url).pathname;
  if (path.endsWith('/tickets') && options.method === 'POST') {
    sent.push(JSON.parse(options.body));
    if (apiError) return Response.json({ error: apiError }, { status: 400 });
    return Response.json({ ticket: { id: 1, ticketCode: 'FIN-001' } });
  }
  const data = path.endsWith('/teams') ? teams : path.endsWith('/categories') ? categories : [];
  return Response.json({ success: true, data });
};
const vite = await createServer({ configFile: false, plugins: [tsconfigPaths()], server: { middlewareMode: true } });
try {
  const { action, loader } = await vite.ssrLoadModule('/app/routes/submit-ticket/route.tsx');
  const post = (path, fields = {}) => action({ request: new Request(`http://local${path}`, {
    method: 'POST', body: new URLSearchParams({ name: 'Requester', department: 'Finance', subject: 'Test request', description: 'Details', category: 'Other', ...fields }),
  }) });
  const get = path => loader({ request: new Request(`http://local${path}`) });
  assert.equal((await post('/submit-ticket', { teamId: '7', teamCode: 'COC', team: 'COC' })).success, true);
  assert.equal(sent.at(-1).teamCode, 'IT', 'IT URL must ignore spoofed destination');
  assert.equal(sent.at(-1).teamId, undefined);
  assert.equal(sent.at(-1).submitterDepartment, 'Finance');
  console.log('PASS: IT action is pathname-owned, requester department preserved');
  const before = sent.length;
  assert.match((await post('/corcom/submit-ticket', { teamCode: 'IT' })).error, /deadline/i);
  assert.equal(sent.length, before);
  const deadline = '2099-12-01T12:30';
  assert.equal((await post('/corcom/submit-ticket', { teamId: '2', teamCode: 'IT', deadline })).success, true);
  assert.equal(sent.at(-1).teamCode, 'COC');
  assert.equal(sent.at(-1).deadline, '2099-12-01T05:30:00.000Z', 'datetime-local is WIB, not SSR host timezone');
  assert.match((await post('/corcom/submit-ticket', { deadline: 'bad' })).error, /valid/i);
  assert.match((await post('/corcom/submit-ticket', { deadline: '2099-02-30T12:30' })).error, /valid/i);
  assert.match((await post('/corcom/submit-ticket', { deadline: '2000-01-01T12:00' })).error, /masa lalu/i);
  console.log('PASS: Corcom spoof protection and required/invalid/past/WIB deadline');
  assert.equal((await get('/corcom/submit-ticket/')).teamCode, 'COC');
  for (const [path, code] of [['/submit-ticket', 'IT'], ['/corcom/submit-ticket', 'COC']]) {
    const data = await get(path);
    assert.equal(data.teamCode, code);
    assert.equal(data.categories.some(c => c.teamId && c.teamId !== teams.find(t => t.code === code).id), false);
  }
  for (const query of ['team=COC', 'team=coc', 'teamId=7', 'teamCode=COC']) {
    const response = await get(`/submit-ticket?${query}&keep=1`);
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('Location'), '/corcom/submit-ticket?keep=1');
  }
  for (const query of ['team=unknown', 'teamId=999', 'teamCode=https://evil.invalid', 'team=IT&teamCode=COC', 'team=COC&team=IT']) {
    await assert.rejects(() => get(`/submit-ticket?${query}`), error => error.status === 400);
  }
  assert.equal((await get('/corcom/submit-ticket?team=IT')).headers.get('Location'), '/submit-ticket');
  console.log('PASS: loader category scoping and safe legacy redirects');
  apiError = 'Category tidak tersedia untuk team ini';
  assert.equal((await post('/submit-ticket')).error, apiError);
  teams[1].isActive = false;
  await assert.rejects(() => get('/corcom/submit-ticket'), error => error.status === 503);
  assert.match((await post('/corcom/submit-ticket', { deadline })).error, /tersedia/i);
  console.log('PASS: API validation messages and unavailable team fail closed');
} finally {
  globalThis.fetch = originalFetch;
  await vite.close();
}
