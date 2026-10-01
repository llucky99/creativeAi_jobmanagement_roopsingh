// Regenerate with: npm run postman  -> postman/Service-Job-Management.postman_collection.json
const fs = require('fs');
const path = require('path');

const bearer = (v) => ({ type: 'bearer', bearer: [{ key: 'token', value: `{{${v}}}`, type: 'string' }] });
const script = (lines) => [{ listen: 'test', script: { type: 'text/javascript', exec: lines } }];
const url = (p, query = []) => ({
  raw: `{{baseUrl}}${p}${query.length ? '?' + query.map((q) => `${q.key}=${q.value}`).join('&') : ''}`,
  host: ['{{baseUrl}}'],
  path: p.split('/').filter(Boolean),
  ...(query.length ? { query } : {}),
});
const req = (name, method, p, { auth, body, form, query, tests, description } = {}) => ({
  name,
  event: tests ? script(tests) : undefined,
  request: {
    method,
    header: body ? [{ key: 'Content-Type', value: 'application/json' }] : [],
    ...(auth ? { auth: bearer(auth) } : { auth: { type: 'noauth' } }),
    ...(body ? { body: { mode: 'raw', raw: JSON.stringify(body, null, 2) } } : {}),
    ...(form ? { body: { mode: 'formdata', formdata: form } } : {}),
    url: url(p, query),
    ...(description ? { description } : {}),
  },
});
const save = (varName, expr) => [`const j = pm.response.json();`, `if (j.success) pm.collectionVariables.set('${varName}', ${expr});`];
const q = (key, value, disabled = false) => ({ key, value, ...(disabled ? { disabled: true } : {}) });

const collection = {
  info: {
    name: 'Service & Job Management API',
    description: 'Run folders top-to-bottom: 1 Auth -> 2 Jobs -> 3 Assignment -> 4 Parts -> 5 Images -> 6 Status -> 7 Invoices. Tokens and IDs are saved automatically into collection variables.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  variable: [
    { key: 'baseUrl', value: 'http://localhost:3000' },
    { key: 'adminEmail', value: 'admin@example.com' },
    { key: 'adminPassword', value: 'Admin@12345' },
    { key: 'adminToken', value: '' }, { key: 'workerToken', value: '' }, { key: 'worker2Token', value: '' },
    { key: 'workerId', value: '' }, { key: 'jobId', value: '' }, { key: 'partId', value: '' },
    { key: 'imageId', value: '' }, { key: 'invoiceId', value: '' },
  ],
  item: [
    { name: '1. Auth', item: [
      req('Register Worker', 'POST', '/auth/register', {
        body: { name: 'Ravi Worker', email: 'ravi.worker@example.com', password: 'Worker123', phone: '9876543210', role: 'Worker' },
        tests: ['const j = pm.response.json();', "if (j.success) { pm.collectionVariables.set('workerToken', j.data.token); pm.collectionVariables.set('workerId', j.data.user.id); }"],
      }),
      req('Register Second Worker (for 403 checks)', 'POST', '/auth/register', {
        body: { name: 'Amit Worker', email: 'amit.worker@example.com', password: 'Worker123', role: 'Worker' },
        tests: save('worker2Token', 'j.data.token'),
      }),
      req('Register Admin (needs adminKey)', 'POST', '/auth/register', {
        body: { name: 'Admin User', email: 'admin2@example.com', password: 'Admin1234', role: 'Admin', adminKey: 'change-me-admin-key' },
        description: 'Requires ADMIN_REGISTRATION_KEY from .env. Alternatively use `npm run seed:admin`.',
      }),
      req('Login Admin', 'POST', '/auth/login', {
        body: { email: '{{adminEmail}}', password: '{{adminPassword}}' },
        tests: save('adminToken', 'j.data.token'),
      }),
      req('Login Worker', 'POST', '/auth/login', {
        body: { email: 'ravi.worker@example.com', password: 'Worker123' },
        tests: ['const j = pm.response.json();', "if (j.success) { pm.collectionVariables.set('workerToken', j.data.token); pm.collectionVariables.set('workerId', j.data.user.id); }"],
      }),
      req('Login - Invalid credentials (401)', 'POST', '/auth/login', { body: { email: 'admin@example.com', password: 'wrong' } }),
      req('Get My Profile', 'GET', '/auth/me', { auth: 'adminToken' }),
      req('List Workers (Admin)', 'GET', '/users/workers', { auth: 'adminToken' }),
    ] },
    { name: '2. Jobs', item: [
      req('Create Job (Admin)', 'POST', '/jobs', {
        auth: 'adminToken',
        body: { title: 'Brake pad replacement', description: 'Front brake pads worn out', customerName: 'John Doe', customerContact: '9123456780', address: '12 MG Road, Indore', priority: 'High' },
        tests: save('jobId', 'j.data.id'),
      }),
      req('Get Job List (Admin)', 'GET', '/jobs', { auth: 'adminToken', query: [q('page', '1'), q('limit', '10'), q('status', 'In%20Progress', true), q('priority', 'High', true), q('search', 'John', true), q('sortOrder', 'desc')] }),
      req('Get Job List (Worker - only assigned)', 'GET', '/jobs', { auth: 'workerToken', query: [q('page', '1'), q('limit', '10')] }),
      req('Get Job Details', 'GET', '/jobs/{{jobId}}', { auth: 'adminToken' }),
      req('Update Job (Admin)', 'PUT', '/jobs/{{jobId}}', { auth: 'adminToken', body: { priority: 'Urgent', address: '45 AB Road, Indore' } }),
      req('Delete Job (Admin)', 'DELETE', '/jobs/{{jobId}}', { auth: 'adminToken', description: 'Run only at the end / on a throwaway job.' }),
    ] },
    { name: '3. Assignment', item: [
      req('Assign / Reassign Worker (Admin)', 'POST', '/jobs/{{jobId}}/assign', { auth: 'adminToken', body: { workerId: '{{workerId}}' } }),
      req('Worker tries to assign (403)', 'POST', '/jobs/{{jobId}}/assign', { auth: 'workerToken', body: { workerId: '{{workerId}}' } }),
    ] },
    { name: '4. Parts / Materials', item: [
      req('Add Part (Worker)', 'POST', '/jobs/{{jobId}}/parts', {
        auth: 'workerToken', body: { partName: 'Brake Pad', unitPrice: 500, quantity: 2 },
        tests: save('partId', 'j.data.part.id'),
      }),
      req('List Parts', 'GET', '/jobs/{{jobId}}/parts', { auth: 'workerToken' }),
      req('Update Part (Worker)', 'PUT', '/jobs/{{jobId}}/parts/{{partId}}', { auth: 'workerToken', body: { quantity: 2 } }),
      req('Delete Part (Worker)', 'DELETE', '/jobs/{{jobId}}/parts/{{partId}}', { auth: 'workerToken' }),
      req('Other worker adds part (403)', 'POST', '/jobs/{{jobId}}/parts', { auth: 'worker2Token', body: { partName: 'X', unitPrice: 10, quantity: 1 } }),
    ] },
    { name: '5. Images', item: [
      req('Upload Images (max 5, field "images")', 'POST', '/jobs/{{jobId}}/images', {
        auth: 'workerToken',
        form: [{ key: 'images', type: 'file', src: [] }, { key: 'images', type: 'file', src: [] }],
        tests: ['const j = pm.response.json();', "if (j.success && j.data.images.length) pm.collectionVariables.set('imageId', j.data.images[0].id);"],
        description: 'In Body > form-data, pick one or more image files for each "images" row (JPG/PNG/WEBP/GIF, <= 5 MB each).',
      }),
      req('List Images', 'GET', '/jobs/{{jobId}}/images', { auth: 'workerToken' }),
      req('Delete Image', 'DELETE', '/jobs/{{jobId}}/images/{{imageId}}', { auth: 'workerToken' }),
    ] },
    { name: '6. Job Status', item: [
      req('Worker -> In Progress', 'PATCH', '/jobs/{{jobId}}/status', { auth: 'workerToken', body: { status: 'In Progress' } }),
      req('Worker -> Completed', 'PATCH', '/jobs/{{jobId}}/status', { auth: 'workerToken', body: { status: 'Completed' } }),
      req('Completed -> Pending (400)', 'PATCH', '/jobs/{{jobId}}/status', { auth: 'workerToken', body: { status: 'Pending' } }),
      req('Other worker updates status (403)', 'PATCH', '/jobs/{{jobId}}/status', { auth: 'worker2Token', body: { status: 'In Progress' } }),
      req('Admin cancels a job', 'PATCH', '/jobs/{{jobId}}/status', { auth: 'adminToken', body: { status: 'Cancelled' }, description: 'Admin may only cancel; use on a non-completed job.' }),
    ] },
    { name: '7. Completed Jobs & Invoices', item: [
      req('Completed Jobs (Admin)', 'GET', '/jobs/completed', { auth: 'adminToken', query: [q('page', '1'), q('limit', '10'), q('invoiced', 'false', true)] }),
      req('Generate Invoice (Admin)', 'POST', '/invoices', {
        auth: 'adminToken', body: { jobId: '{{jobId}}', serviceCost: 2000, cleaningCost: 500 },
        tests: save('invoiceId', 'j.data.id'),
      }),
      req('Generate Invoice again (409)', 'POST', '/invoices', { auth: 'adminToken', body: { jobId: '{{jobId}}', serviceCost: 2000, cleaningCost: 500 } }),
      req('Get Invoice', 'GET', '/invoices/{{invoiceId}}', { auth: 'adminToken' }),
      req('List Invoices', 'GET', '/invoices', { auth: 'adminToken', query: [q('page', '1'), q('limit', '10')] }),
    ] },
  ],
};

// jobId in JSON bodies must be a number for Joi? Joi converts numeric strings, so {{jobId}} strings are fine.
const out = path.join(__dirname, '..', 'postman', 'Service-Job-Management.postman_collection.json');
fs.writeFileSync(out, JSON.stringify(collection, null, 2));
console.log('Written', out);
