// End-to-end test: needs a running MySQL with schema loaded + admin seeded (see README / CI).
// Run:  npm run test:e2e
const assert = require('node:assert/strict');
const app = require('../../src/app');
const { pool } = require('../../src/config/db');

let base;
let passed = 0;
const call = async (method, path, { token, body, form } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(base + path, { method, headers, body: payload });
  return { status: res.status, body: await res.json().catch(() => null) };
};
const step = async (name, fn) => { await fn(); passed += 1; console.log(`  ok  ${name}`); };

// minimal valid PNG (1x1)
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const imgForm = (n, name = 'p.png', type = 'image/png', buf = PNG) => {
  const f = new FormData();
  for (let i = 0; i < n; i += 1) f.append('images', new Blob([buf], { type }), name);
  return f;
};

(async () => {
  const server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  const sfx = Date.now();
  const ctx = {};

  try {
    await step('health', async () => assert.equal((await call('GET', '/health')).status, 200));

    await step('register worker + second worker; admin needs key', async () => {
      const w = await call('POST', '/auth/register', { body: { name: 'Worker One', email: `w1_${sfx}@t.com`, password: 'Pass1234' } });
      assert.equal(w.status, 201); ctx.w1 = w.body.data;
      const w2 = await call('POST', '/auth/register', { body: { name: 'Worker Two', email: `w2_${sfx}@t.com`, password: 'Pass1234' } });
      ctx.w2 = w2.body.data;
      const bad = await call('POST', '/auth/register', { body: { name: 'Evil', email: `e_${sfx}@t.com`, password: 'Pass1234', role: 'Admin' } });
      assert.equal(bad.status, 403);
      const dup = await call('POST', '/auth/register', { body: { name: 'Worker One', email: `w1_${sfx}@t.com`, password: 'Pass1234' } });
      assert.equal(dup.status, 409);
      const inv = await call('POST', '/auth/register', { body: { email: 'bad' } });
      assert.equal(inv.status, 400); assert.ok(inv.body.errors.length >= 2);
    });

    await step('login (valid / invalid) + profile + unauthenticated', async () => {
      const a = await call('POST', '/auth/login', { body: { email: 'admin@example.com', password: 'Admin@12345' } });
      assert.equal(a.status, 200); ctx.admin = a.body.data.token;
      assert.equal((await call('POST', '/auth/login', { body: { email: 'admin@example.com', password: 'wrong' } })).status, 401);
      const me = await call('GET', '/auth/me', { token: ctx.admin });
      assert.equal(me.body.data.role, 'Admin'); assert.equal(me.body.data.passwordHash, undefined);
      assert.equal((await call('GET', '/auth/me')).status, 401);
      assert.equal((await call('GET', '/jobs', { token: 'garbage' })).status, 401);
    });

    await step('admin creates job; worker cannot create', async () => {
      const body = { title: 'Brake repair', customerName: 'John Doe', customerContact: '9876543210', address: '12 MG Road, Indore', priority: 'High' };
      assert.equal((await call('POST', '/jobs', { token: ctx.w1.token, body })).status, 403);
      const r = await call('POST', '/jobs', { token: ctx.admin, body });
      assert.equal(r.status, 201); assert.equal(r.body.data.status, 'Pending'); ctx.job = r.body.data;
      assert.equal((await call('POST', '/jobs', { token: ctx.admin, body: { title: 'x' } })).status, 400);
    });

    await step('invalid id / not found', async () => {
      assert.equal((await call('GET', '/jobs/abc', { token: ctx.admin })).status, 400);
      assert.equal((await call('GET', '/jobs/999999', { token: ctx.admin })).status, 404);
    });

    await step('worker sees nothing until assigned; assign works; reassign works', async () => {
      assert.equal((await call('GET', '/jobs', { token: ctx.w1.token })).body.data.length, 0);
      assert.equal((await call('POST', `/jobs/${ctx.job.id}/assign`, { token: ctx.w1.token, body: { workerId: ctx.w1.user.id } })).status, 403);
      const r = await call('POST', `/jobs/${ctx.job.id}/assign`, { token: ctx.admin, body: { workerId: ctx.w1.user.id } });
      assert.equal(r.status, 200); assert.equal(r.body.data.status, 'Assigned');
      assert.equal((await call('POST', `/jobs/${ctx.job.id}/assign`, { token: ctx.admin, body: { workerId: 999999 } })).status, 404);
      assert.equal((await call('POST', `/jobs/${ctx.job.id}/assign`, { token: ctx.admin, body: { workerId: 1 } })).status, 400); // admin user is not a worker
      assert.equal((await call('GET', '/jobs', { token: ctx.w1.token })).body.data.length, 1);
      assert.equal((await call('GET', `/jobs/${ctx.job.id}`, { token: ctx.w2.token })).status, 403);
    });

    await step('parts: add/calc/update/delete + ownership', async () => {
      const add = await call('POST', `/jobs/${ctx.job.id}/parts`, { token: ctx.w1.token, body: { partName: 'Brake Pad', unitPrice: 500, quantity: 2 } });
      assert.equal(add.status, 201); assert.equal(add.body.data.part.totalPrice, 1000); ctx.part = add.body.data.part;
      assert.equal((await call('POST', `/jobs/${ctx.job.id}/parts`, { token: ctx.w2.token, body: { partName: 'X part', unitPrice: 1, quantity: 1 } })).status, 403);
      assert.equal((await call('POST', `/jobs/${ctx.job.id}/parts`, { token: ctx.admin, body: { partName: 'X part', unitPrice: 1, quantity: 1 } })).status, 403);
      assert.equal((await call('POST', `/jobs/${ctx.job.id}/parts`, { token: ctx.w1.token, body: { partName: 'Bad', unitPrice: -5, quantity: 0 } })).status, 400);
      const up = await call('PUT', `/jobs/${ctx.job.id}/parts/${ctx.part.id}`, { token: ctx.w1.token, body: { quantity: 3 } });
      assert.equal(up.body.data.part.totalPrice, 1500);
      const extra = await call('POST', `/jobs/${ctx.job.id}/parts`, { token: ctx.w1.token, body: { partName: 'Oil', unitPrice: 250.5, quantity: 2 } });
      assert.equal(extra.body.data.partsTotal, 2001);
      const del = await call('DELETE', `/jobs/${ctx.job.id}/parts/${extra.body.data.part.id}`, { token: ctx.w1.token });
      assert.equal(del.body.data.partsTotal, 1500);
      assert.equal((await call('PUT', `/jobs/${ctx.job.id}/parts/${ctx.part.id}`, { token: ctx.w2.token, body: { quantity: 1 } })).status, 403);
      await call('PUT', `/jobs/${ctx.job.id}/parts/${ctx.part.id}`, { token: ctx.w1.token, body: { quantity: 2 } });
    });

    await step('images: upload multiple, type/size/max validation, delete, url', async () => {
      const up = await call('POST', `/jobs/${ctx.job.id}/images`, { token: ctx.w1.token, form: imgForm(3) });
      assert.equal(up.status, 201); assert.equal(up.body.data.totalImages, 3);
      assert.match(up.body.data.images[0].url, /^http.*\/uploads\/jobs\/.+\.png$/);
      const imgPath = new URL(up.body.data.images[0].url).pathname; // test server uses a random port
      const file = await fetch(base + imgPath); assert.equal(file.status, 200);
      const txt = await call('POST', `/jobs/${ctx.job.id}/images`, { token: ctx.w1.token, form: imgForm(1, 'a.txt', 'text/plain', Buffer.from('hi')) });
      assert.equal(txt.status, 400);
      const fake = await call('POST', `/jobs/${ctx.job.id}/images`, { token: ctx.w1.token, form: imgForm(1, 'fake.png', 'image/png', Buffer.from('not an image at all')) });
      assert.equal(fake.status, 400);
      const big = await call('POST', `/jobs/${ctx.job.id}/images`, { token: ctx.w1.token, form: imgForm(1, 'big.png', 'image/png', Buffer.concat([PNG, Buffer.alloc(6 * 1024 * 1024)])) });
      assert.equal(big.status, 400);
      const over = await call('POST', `/jobs/${ctx.job.id}/images`, { token: ctx.w1.token, form: imgForm(3) });
      assert.equal(over.status, 400); assert.match(over.body.message, /Maximum 5/);
      assert.equal((await call('POST', `/jobs/${ctx.job.id}/images`, { token: ctx.w1.token, form: imgForm(6) })).status, 400);
      assert.equal((await call('POST', `/jobs/${ctx.job.id}/images`, { token: ctx.w2.token, form: imgForm(1) })).status, 403);
      const two = await call('POST', `/jobs/${ctx.job.id}/images`, { token: ctx.admin, form: imgForm(2) });
      assert.equal(two.body.data.totalImages, 5);
      const id = two.body.data.images[0].id;
      assert.equal((await call('DELETE', `/jobs/${ctx.job.id}/images/${id}`, { token: ctx.w1.token })).status, 200);
      assert.equal((await call('DELETE', `/jobs/${ctx.job.id}/images/${id}`, { token: ctx.w1.token })).status, 404);
    });

    await step('status rules', async () => {
      const s = (token, status) => call('PATCH', `/jobs/${ctx.job.id}/status`, { token, body: { status } });
      assert.equal((await s(ctx.w2.token, 'In Progress')).status, 403);
      assert.equal((await s(ctx.admin, 'In Progress')).status, 403);
      assert.equal((await s(ctx.w1.token, 'Completed')).status, 400); // skipping In Progress
      assert.equal((await s(ctx.w1.token, 'Pending')).status, 400);
      assert.equal((await s(ctx.w1.token, 'In Progress')).status, 200);
      assert.equal((await call('GET', '/jobs?status=In%20Progress&search=John', { token: ctx.w1.token })).body.data.length, 1);
      assert.equal((await s(ctx.w1.token, 'Completed')).status, 200);
      const back = await s(ctx.w1.token, 'Pending');
      assert.equal(back.status, 400); assert.match(back.body.message, /back to Pending/);
      assert.equal((await call('POST', `/jobs/${ctx.job.id}/parts`, { token: ctx.w1.token, body: { partName: 'Late', unitPrice: 1, quantity: 1 } })).status, 400);
    });

    await step('completed list + invoice rules + calculation', async () => {
      assert.equal((await call('GET', '/jobs/completed', { token: ctx.w1.token })).status, 403);
      const list = await call('GET', '/jobs/completed', { token: ctx.admin });
      assert.ok(list.body.data.some((j) => j.id === ctx.job.id && j.hasInvoice === false));

      const pending = (await call('POST', '/jobs', { token: ctx.admin, body: { title: 'Another', customerName: 'Jane', customerContact: '9999999999', address: 'Some address 1' } })).body.data;
      assert.equal((await call('POST', '/invoices', { token: ctx.admin, body: { jobId: pending.id, serviceCost: 1, cleaningCost: 1 } })).status, 400);
      assert.equal((await call('POST', '/invoices', { token: ctx.admin, body: { jobId: 999999, serviceCost: 1, cleaningCost: 1 } })).status, 404);
      assert.equal((await call('POST', '/invoices', { token: ctx.admin, body: { jobId: ctx.job.id, serviceCost: -1, cleaningCost: 0 } })).status, 400);
      assert.equal((await call('POST', '/invoices', { token: ctx.w1.token, body: { jobId: ctx.job.id, serviceCost: 1, cleaningCost: 1 } })).status, 403);

      const inv = await call('POST', '/invoices', { token: ctx.admin, body: { jobId: ctx.job.id, serviceCost: 2000, cleaningCost: 500 } });
      assert.equal(inv.status, 201);
      assert.deepEqual(
        { p: inv.body.data.charges.partsTotal, s: inv.body.data.charges.subtotal, g: inv.body.data.charges.gstAmount, t: inv.body.data.charges.finalTotal },
        { p: 1000, s: 3500, g: 350, t: 3850 }
      );
      assert.equal((await call('POST', '/invoices', { token: ctx.admin, body: { jobId: ctx.job.id, serviceCost: 2000, cleaningCost: 500 } })).status, 409);
      assert.equal((await call('GET', `/invoices/${inv.body.data.id}`, { token: ctx.admin })).body.data.finalPayableAmount, 3850);
      assert.ok((await call('GET', '/invoices', { token: ctx.admin })).body.pagination.total >= 1);
      assert.equal((await call('GET', '/jobs/completed?invoiced=true', { token: ctx.admin })).body.data.some((j) => j.id === ctx.job.id), true);

      // cancelled job cannot be assigned; only admin deletes; invoiced job cannot be deleted
      assert.equal((await call('PATCH', `/jobs/${pending.id}/status`, { token: ctx.admin, body: { status: 'Cancelled' } })).status, 200);
      assert.equal((await call('POST', `/jobs/${pending.id}/assign`, { token: ctx.admin, body: { workerId: ctx.w1.user.id } })).status, 400);
      assert.equal((await call('DELETE', `/jobs/${pending.id}`, { token: ctx.w1.token })).status, 403);
      assert.equal((await call('DELETE', `/jobs/${pending.id}`, { token: ctx.admin })).status, 200);
      assert.equal((await call('DELETE', `/jobs/${ctx.job.id}`, { token: ctx.admin })).status, 409);
    });

    await step('pagination + sort + filter + search', async () => {
      for (let i = 0; i < 3; i += 1) {
        await call('POST', '/jobs', { token: ctx.admin, body: { title: `Bulk ${i}`, customerName: 'Bulk Customer', customerContact: '9999999999', address: 'Bulk address', priority: 'Low' } });
      }
      const p1 = await call('GET', '/jobs?page=1&limit=2&priority=Low&search=Bulk&sortOrder=asc', { token: ctx.admin });
      assert.equal(p1.body.data.length, 2); assert.equal(p1.body.pagination.hasNextPage, true);
      assert.ok(new Date(p1.body.data[0].createdAt) <= new Date(p1.body.data[1].createdAt));
      assert.equal((await call('GET', '/jobs?status=Nope', { token: ctx.admin })).status, 400);
      assert.equal((await call('GET', '/jobs?search=%25', { token: ctx.admin })).body.data.length, 0); // wildcard escaped
    });

    await step('unknown route + malformed JSON', async () => {
      assert.equal((await call('GET', '/nope')).status, 404);
      const r = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' });
      assert.equal(r.status, 400);
    });

    console.log(`\nAll ${passed} e2e steps passed`);
  } catch (e) {
    console.error('\nE2E FAILED:', e);
    process.exitCode = 1;
  } finally {
    server.close();
    await pool.end();
  }
})();
