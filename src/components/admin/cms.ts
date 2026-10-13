// CMS (TypeScript). Talks to /api/v1/admin/* using the signed-in admin's cookie. Mounted by <AdminApp />.
type Row = Record<string, any>;
const $ = (s: string, r: ParentNode = document): any => r.querySelector(s), $$ = (s: string, r: ParentNode = document): any[] => [...r.querySelectorAll(s)];
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
let cats: Row[] = [];
const toast = (m: string) => { const t = $('#toast'); if (!t) return; t.textContent = m; t.classList.add('on'); clearTimeout((t as any).h); (t as any).h = setTimeout(() => t.classList.remove('on'), 3500); };
const money = (m: number, c?: string) => new Intl.NumberFormat('en', { style: 'currency', currency: c || 'GHS' }).format((m || 0) / 100);
async function api(p: string, o: { method?: string; body?: unknown; raw?: Blob; type?: string } = {}): Promise<any> {
  const r = await fetch('/api/v1' + p, { method: o.method || (o.raw || o.body ? 'POST' : 'GET'), credentials: 'same-origin', headers: { 'Content-Type': o.raw ? (o.type as string) : 'application/json' }, body: o.raw || (o.body ? JSON.stringify(o.body) : undefined) });
  const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'Request failed'); return d;
}
export function mountAdmin(root: HTMLElement) { return boot(root); }
const NAV = [['overview', 'Overview'], ['courses', 'Courses'], ['categories', 'Categories'], ['facts', 'Did you know'], ['quizzes', 'Quizzes'], ['pages', 'Pages'], ['reviews', 'Reviews'], ['users', 'Users'], ['payments', 'Payments'], ['withdrawals', 'Withdrawals'], ['support', 'Support'], ['settings', 'Settings'], ['audit', 'Audit log']];

// ---------- generic CRUD ----------
const RES: Record<string, any> = {
  courses: { cols: ['id', 'title', 'level', 'priceGhs', 'priceNgn', 'rating', 'enrolments', 'published'], fields: () => [['title', 'Title', 'text', 1], ['author', 'Author'], ['category_id', 'Category', 'select', 0, cats.map((c: any) => [c.id, c.name])], ['level', 'Level', 'select', 0, ['Beginner', 'Intermediate', 'Advanced'].map((x: any) => [x, x])], ['description', 'Description', 'textarea'], ['cover_url', 'Cover image', 'image'], ['minutes', 'Total minutes', 'number'], ['language', 'Language'], ['price_ghs', 'Price in Ghana (GHS)', 'm?'], ['price_ngn', 'Price in Nigeria (NGN)', 'm?'], ['learn_points', "What you'll learn (one per line)", 'lines'], ['skills', 'Skills (comma separated)'], ['reward_eligible', 'Reward eligible', 'check'], ['published', 'Published', 'check']], lessons: 1, defaults: { published: 1, minutes: 60, level: 'Beginner', language: 'English', learn_points: [], price_ghs: '', price_ngn: '' } },
  categories: { cols: ['id', 'name', 'sort'], fields: () => [['name', 'Name', 'text', 1], ['description', 'Description', 'textarea'], ['thumb_url', 'Image', 'image'], ['sort', 'Sort order', 'number']], defaults: { sort: 0 } },
  facts: { cols: ['id', 'title', 'active'], fields: () => [['title', 'Title', 'text', 1], ['body', 'Text', 'textarea'], ['image_url', 'Image', 'image'], ['link_url', 'Link (optional)'], ['active', 'Show on site', 'check']], defaults: { active: 1 } },
  lessons: { cols: ['sort', 'title', 'kind', 'preview'], fields: () => [['title', 'Title', 'text', 1], ['kind', 'Type', 'select', 0, [['text', 'Reading'], ['video', 'Video'], ['pdf', 'PDF eBook']]], ['content', 'Text content (for reading lessons)', 'textarea'], ['url', 'Video URL / PDF file', 'file'], ['minutes', 'Minutes', 'number'], ['sort', 'Order', 'number'], ['preview', 'Free preview', 'check']], defaults: { kind: 'text', minutes: 10, sort: 1, preview: 0 } }
};
function input([n, label, type = 'text', req, opts]: any[], v: any) {
  v ??= ''; const id = `f_${n}`, L = `<label class="${type === 'textarea' || type === 'lines' ? 'full' : ''}" for="${id}">${label}`;
  if (type === 'textarea') return `${L}<textarea id="${id}" name="${n}" rows="5">${esc(v)}</textarea></label>`;
  if (type === 'lines') return `${L}<textarea id="${id}" name="${n}" data-t="lines" rows="4">${esc((Array.isArray(v) ? v : JSON.parse(v || '[]')).join('\n'))}</textarea></label>`;
  if (type === 'select') return `${L}<select id="${id}" name="${n}">${opts.map((o: any) => `<option value="${esc(o[0])}" ${o[0] == v ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select></label>`;
  if (type === 'm?') return `${L}<input id="${id}" name="${n}" type="number" min="0" max="20000000" step="0.01" inputmode="decimal" data-nullable-money value="${esc(v)}" placeholder="Leave blank until pricing is set"></label>`;
  if (type === 'check') return `<label class="row" style="font-weight:500"><input type="checkbox" id="${id}" name="${n}" ${v ? 'checked' : ''} style="width:auto;min-height:0"> ${label}</label>`;
  if (type === 'image' || type === 'file') {
    const hasPreview = !!(v && type === 'image');
    const previewMarkup = hasPreview
      ? `<div class="admin-upload-preview"><img src="${esc(v)}" alt="" /></div>`
      : `<div class="admin-upload-preview empty"><span>${type === 'image' ? 'Thumbnail preview' : 'Upload file'}</span></div>`;
    return `${L}<div class="admin-upload-box">${previewMarkup}<input id="${id}" name="${n}" value="${esc(v)}" placeholder="${type === 'image' ? 'Paste a URL or upload' : 'Video URL, or upload a PDF'}"><input type="file" data-up="${n}" data-kind="${type}" accept="${type === 'image' ? 'image/*' : 'application/pdf'}"></div></label>`;
  }
  return `${L}<input id="${id}" name="${n}" type="${type}" value="${esc(v)}" ${req ? 'required' : ''}></label>`;
}
function collect(f: any) {
  const o: Row = {}; $$('input,textarea,select', f).forEach((el: any) => { if (!el.name) return; o[el.name] = el.type === 'checkbox' ? +el.checked : el.dataset.t === 'lines' ? el.value.split('\n').map((s: any) => s.trim()).filter(Boolean) : el.dataset.nullableMoney !== undefined && el.value.trim() === '' ? null : el.type === 'number' ? +el.value : el.value; });
  return o;
}
function wireUploads(f: any) {
  $$('[data-up]', f).forEach((inp: any) => inp.onchange = async () => {
    const file = inp.files[0]; if (!file) return; toast('Uploading…');
    try { const r = await api('/admin/upload', { raw: file, type: file.type, method: 'POST' }); f.elements[inp.dataset.up].value = r.url; toast('Uploaded. Save to apply.'); } catch (e: any) { toast(e.message); }
  });
}
async function crud(name: string, filter?: string) {
  const R = RES[name], q = filter ? `?course_id=${filter}` : '', rows = await api(`/admin/content/${name}${q}`);
  const title = ({ courses: 'Courses', categories: 'Categories', facts: 'Did you know', lessons: 'Lessons' } as Record<string, string>)[name];
  main(`<div class="sp"><h1>${title}</h1><button class="btn primary" id="add">Add new</button></div><div class="tbl card"><table><thead><tr>${R.cols.map((c: any) => `<th>${c === 'priceGhs' ? 'Price GHS' : c === 'priceNgn' ? 'Price NGN' : esc(c)}</th>`).join('')}<th></th></tr></thead><tbody>
  ${rows.map((r: any) => `<tr>${R.cols.map((c: any) => `<td>${c === 'priceGhs' ? (r.price_ghs == null ? '—' : money(r.price_ghs, 'GHS')) : c === 'priceNgn' ? (r.price_ngn == null ? '—' : money(r.price_ngn, 'NGN')) : esc(c === 'published' || c === 'active' || c === 'preview' ? (r[c] ? 'yes' : 'no') : r[c])}</td>`).join('')}<td style="white-space:nowrap"><button class="btn sm" data-e="${r.id}">Edit</button>${R.lessons ? `<button class="btn sm" data-l="${r.id}">Lessons</button>` : ''}<button class="btn sm" data-d="${r.id}">Delete</button></td></tr>`).join('') || `<tr><td colspan="9" class="muted">Nothing here yet.</td></tr>`}</tbody></table></div><div id="ed"></div>`);
  const edit = (row: any) => {
    const v: Row = { ...R.defaults, ...(row || {}) }; if (filter) v.course_id = filter;
    if (name === 'courses' && row) { v.price_ghs = row.price_ghs == null ? '' : row.price_ghs / 100; v.price_ngn = row.price_ngn == null ? '' : row.price_ngn / 100; }
    $('#ed').innerHTML = `<form id="ef" class="card mt form2"><h2 class="full">${row ? 'Edit' : 'New'} ${title.toLowerCase().replace(/s$/, '')}</h2>${R.fields().map((f: any) => input(f, v[f[0]])).join('')}<p class="err full"></p><div class="row full"><button class="btn primary" type="submit">Save</button><button class="btn" type="button" id="cx">Cancel</button></div></form>`;
    wireUploads($('#ef')); $('#cx').onclick = () => $('#ed').innerHTML = ''; $('#ef').scrollIntoView({ behavior: 'smooth' });
    $('#ef').onsubmit = async (e: any) => { e.preventDefault(); const body = collect(e.target); if (filter) body.course_id = +filter; try { await api(`/admin/content/${name}${row ? '/' + row.id : ''}`, { method: row ? 'PUT' : 'POST', body }); toast('Saved.'); crud(name, filter); } catch (x: any) { $('.err', e.target).textContent = x.message; } };
  };
  $('#add').onclick = () => edit(null);
  $$('[data-e]').forEach((b: any) => b.onclick = () => edit(rows.find((r: any) => r.id == b.dataset.e)));
  $$('[data-l]').forEach((b: any) => b.onclick = () => { location.hash = '#/lessons/' + b.dataset.l; });
  $$('[data-d]').forEach((b: any) => b.onclick = async () => { if (confirm('Delete this item? This cannot be undone.')) { await api(`/admin/content/${name}/${b.dataset.d}`, { method: 'DELETE' }); crud(name, filter); } });
}

// ---------- other screens ----------
const table = (head: any, rows: any) => `<div class="tbl card"><table><thead><tr>${head.map((h: any) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('') || `<tr><td colspan="${head.length}" class="muted">Nothing here yet.</td></tr>`}</tbody></table></div>`;
const SCREENS: Record<string, any> = {
  async overview() {
    const s = await api('/admin/stats');
    main(`<h1>Overview</h1><div class="stats">${[['Members', s.users], ['Activated', s.activated], ['Sign-ups (7 days)', s.signups7d], ['Courses', s.courses]].map((x: any) => `<div class="card stat"><span>${x[0]}</span><b>${x[1]}</b></div>`).join('')}</div>
    <div class="grid mt"><div class="card"><h3>Payment revenue</h3>${s.revenue.map((r: any) => `<p><b>${money(r.total, r.currency)}</b> from ${r.n} payments</p>`).join('') || '<p class="muted">No payments yet.</p>'}</div>
    <div class="card"><h3>Open withdrawals</h3>${s.pending_withdrawals.map((r: any) => `<p><b>${money(r.total, r.currency)}</b> (${r.n})</p>`).join('') || '<p class="muted">None.</p>'}${s.needs_review ? `<p class="bad"><b>${s.needs_review}</b> need your review. <a href="#/withdrawals">Open</a></p>` : ''}</div>
    <div class="card"><h3>System</h3><p>Payment provider: <span class="pill">${esc(s.provider)}</span></p>${s.provider === 'mock' ? '<p class="bad">Mock mode: no real money moves. Set PAYSTACK_SECRET_KEY to go live.</p>' : ''}${s.mismatches ? `<p class="bad">${s.mismatches} payments have an amount mismatch.</p>` : ''}</div></div>`);
  },
  async pages() {
    const rows = await api('/admin/pages');
    main(`<div class="sp"><h1>Pages</h1><button class="btn primary" id="add">New page</button></div>${table(['Slug', 'Title', 'Updated', ''], rows.map((p: any) => `<tr><td>${esc(p.slug)}</td><td>${esc(p.title)}</td><td>${esc(p.updated_at)}</td><td><button class="btn sm" data-s="${esc(p.slug)}">Edit</button><button class="btn sm" data-x="${esc(p.slug)}">Delete</button></td></tr>`))}<div id="ed"></div>`);
    const edit = (p?: any) => { p ||= { slug: '', title: '', body: '' }; $('#ed').innerHTML = `<form id="ef" class="card mt form2"><label>Slug (web address: #/p/slug)<input name="slug" value="${esc(p.slug)}" ${p.slug ? 'readonly' : ''} required pattern="[a-z0-9-]{2,40}"></label><label>Title<input name="title" value="${esc(p.title)}" required></label>
      <label class="full">Content (blank line = new paragraph, **bold**)<textarea name="body" rows="14">${esc(p.body)}</textarea></label><p class="err full"></p><div class="row full"><button class="btn primary" type="submit">Save</button></div></form>`;
      $('#ef').onsubmit = async (e: any) => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); try { await api('/admin/pages/' + d.slug, { method: 'PUT', body: d }); toast('Saved.'); SCREENS.pages(); } catch (x: any) { $('.err', e.target).textContent = x.message; } }; $('#ef').scrollIntoView(); };
    $('#add').onclick = () => edit(); $$('[data-s]').forEach((b: any) => b.onclick = () => edit(rows.find((r: any) => r.slug === b.dataset.s)));
    $$('[data-x]').forEach((b: any) => b.onclick = async () => { if (confirm('Delete this page?')) { await api('/admin/pages/' + b.dataset.x, { method: 'DELETE' }); SCREENS.pages(); } });
  },
  async reviews() {
    const rows = await api('/admin/reviews');
    main(`<h1>Reviews</h1>${table(['Course', 'User', 'Rating', 'Review', 'Status', ''], rows.map((r: any) => `<tr><td>${esc(r.course)}</td><td>${esc(r.username)}</td><td>${r.rating}</td><td>${esc(r.body)}</td><td>${r.status}</td><td><button class="btn sm" data-r="${r.id}" data-s="${r.status === 'hidden' ? 'published' : 'hidden'}">${r.status === 'hidden' ? 'Show' : 'Hide'}</button></td></tr>`))}`);
    $$('[data-r]').forEach((b: any) => b.onclick = async () => { await api('/admin/reviews/' + b.dataset.r, { method: 'PATCH', body: { status: b.dataset.s } }); SCREENS.reviews(); });
  },
  async users(q = '') {
    const rows = await api('/admin/users' + (q ? '?q=' + encodeURIComponent(q) : ''));
    main(`<h1>Users</h1><form id="sf" class="row"><input name="q" value="${esc(q)}" placeholder="Search username, email or member ID" style="flex:1;min-width:200px"><button class="btn primary" type="submit">Search</button></form><br>${table(['ID', 'Member', 'Name', 'Email', 'Country', 'Status', 'Verified', ''], rows.map((u: any) => `<tr><td>${u.id}</td><td>${esc(u.member_id)}</td><td>${esc(u.full_name)}</td><td>${esc(u.email)}</td><td>${u.country}</td><td>${u.suspended ? '<span class="bad">suspended</span>' : u.status}</td><td>${u.email_verified ? 'yes' : 'no'}</td><td>${u.role === 'admin' ? '' : `<button class="btn sm" data-u="${u.id}" data-s="${u.suspended ? 0 : 1}">${u.suspended ? 'Restore' : 'Suspend'}</button><button class="btn sm" data-g="${u.id}">Settle rewards</button>`}</td></tr>`))}`);
    $('#sf').onsubmit = (e: any) => { e.preventDefault(); SCREENS.users(String(new FormData(e.target).get('q') ?? '')); };
    $$('[data-u]').forEach((b: any) => b.onclick = async () => { await api('/admin/users/' + b.dataset.u, { method: 'PATCH', body: { suspended: +b.dataset.s } }); SCREENS.users(q); });
    $$('[data-g]').forEach((b: any) => b.onclick = async () => { if (confirm('Move this user\'s pending rewards to available? Only do this after validating them.')) { const r = await api('/admin/rewards/settle/' + b.dataset.g, { body: {} }); toast('Settled ' + r.settled / 100); } });
  },
  async payments() {
    const rows = await api('/admin/payments');
    main(`<h1>Payments</h1>${table(['Date', 'Type', 'Course', 'User', 'Reference', 'Amount', 'Provider', 'Status', ''], rows.map((p: any) => `<tr><td>${esc(p.created_at)}</td><td>${p.kind === 'course' ? 'Course' : 'Activation'}</td><td>${esc(p.course_title || '—')}</td><td>${esc(p.username)}</td><td><small>${esc(p.reference)}</small></td><td>${money(p.amount, p.currency)}</td><td>${esc(p.provider)}</td><td class="${p.status === 'success' ? 'ok' : p.status === 'mismatch' ? 'bad' : ''}">${esc(p.status)}</td><td>${p.status === 'pending' || p.status === 'failed' ? `<button class="btn sm" data-v="${esc(p.reference)}">Re-check</button>` : ''}</td></tr>`))}`);
    $$('[data-v]').forEach((b: any) => b.onclick = async () => { try { const r = await api(`/admin/payments/${b.dataset.v}/verify`, { body: {} }); toast('Status: ' + r.status); SCREENS.payments(); } catch (x: any) { toast(x.message); } });
  },
  async withdrawals() {
    const rows = await api('/admin/withdrawals');
    main(`<h1>Withdrawals</h1>${table(['Date', 'User', 'Amount', 'To', 'Status', ''], rows.map((w: any) => `<tr><td>${esc(w.created_at)}</td><td>${esc(w.username)}</td><td>${money(w.amount, w.currency)} <small class="muted">fee ${money(w.fee, w.currency)}</small></td><td>${esc(w.method)}<br><small>${esc(w.account_name)} ${esc(w.account_number)}</small></td><td class="${w.status === 'review' ? 'bad' : ''}">${w.status}${w.note ? `<br><small>${esc(w.note)}</small>` : ''}</td>
      <td style="white-space:nowrap">${w.status === 'review' ? `<button class="btn sm primary" data-a="approve" data-w="${w.id}">Approve</button>` : ''}${['review', 'processing'].includes(w.status) ? `<button class="btn sm" data-a="fail" data-w="${w.id}">Reject</button>${w.provider_ref ? '' : `<button class="btn sm" data-a="complete" data-w="${w.id}">Mark paid</button>`}` : ''}</td></tr>`))}<p class="muted">Approve sends the payout through the payment provider. "Mark paid" is only for payouts you made manually. Rejecting returns the money to the user's balance.</p>`);
    $$('[data-w]').forEach((b: any) => b.onclick = async () => { if (!confirm(b.dataset.a + ' this withdrawal?')) return; try { await api('/admin/withdrawals/' + b.dataset.w, { method: 'PATCH', body: { action: b.dataset.a } }); SCREENS.withdrawals(); } catch (x: any) { toast(x.message); } });
  },
  async audit() { const rows = await api('/admin/audit'); main(`<h1>Audit log</h1>${table(['Time', 'Actor', 'Action', 'Detail'], rows.map((a: any) => `<tr><td>${esc(a.created_at)}</td><td>${a.actor ?? 'system'}</td><td>${esc(a.action)}</td><td><small>${esc(JSON.stringify(a.detail))}</small></td></tr>`))}`); },
  async settings() {
    const all = await api('/admin/settings'), MONEY = new Set(['activation_fee', 'referral_reward', 'course_reward', 'min_withdrawal', 'withdrawal_review_above']);
    const LABEL: Record<string, string> = { site: 'Business details and homepage', activation_fee: 'Activation fee', referral_reward: 'Referral reward', course_reward: 'Course completion reward', min_withdrawal: 'Minimum withdrawal', withdrawal_review_above: 'Manual review above (withdrawal amount)', withdrawal_fee_percent: 'Withdrawal fee (%)', payout_methods: 'Payout methods (comma separated)', task_deadline_hours: 'Task deadline (hours after registration)', reviews: 'Homepage reviews (JSON)' };
    const field = (key: any, k: any, v: any) => { const m = MONEY.has(key), t = Array.isArray(v) ? 'arr' : typeof v;
      return `<label>${esc(k ?? '')}${m ? ' (amount in major units, e.g. 50 = 50.00)' : ''}<input data-k="${esc(k ?? '')}" data-t="${t}" ${m ? 'data-m="1"' : ''} value="${esc(Array.isArray(v) ? v.join(', ') : m ? v / 100 : v)}"></label>`; };
    main(`<h1>Settings</h1><p class="muted">Prices, rewards, limits, business details and homepage text. Changes go live immediately.</p>${Object.entries(all).map(([key, val]) => {
      const simple = val && typeof val === 'object' && !Array.isArray(val), json = Array.isArray(val) && typeof val[0] === 'object';
      return `<form class="card mt form2" data-key="${key}"><h3 class="full">${esc(LABEL[key] || key)}</h3>${json ? `<label class="full"><textarea data-t="json" rows="8">${esc(JSON.stringify(val, null, 2))}</textarea></label>` : simple ? Object.entries(val).map(([k, v]) => field(key, k, v)).join('') : field(key, '', val)}<div class="row full"><button class="btn primary" type="submit">Save</button></div></form>`; }).join('')}`);
    $$('form[data-key]').forEach((f: any) => f.onsubmit = async (e: any) => {
      e.preventDefault(); const key = f.dataset.key, ins = $$('input,textarea', f), conv = (el: any) => el.dataset.t === 'number' ? (el.dataset.m ? Math.round(+el.value * 100) : +el.value) : el.dataset.t === 'arr' ? el.value.split(',').map((s: any) => s.trim()).filter(Boolean) : el.value;
      try { let value; if (ins[0].dataset.t === 'json') value = JSON.parse(ins[0].value); else if (!ins[0].dataset.k) value = conv(ins[0]); else value = Object.fromEntries(ins.map((el: any) => [el.dataset.k, conv(el)])); await api('/admin/settings/' + key, { method: 'PUT', body: { value } }); toast('Saved. Live now.'); } catch (x: any) { toast('Could not save: ' + x.message); }
    });
  }
};
const SIMPLE: Record<string, number> = { courses: 1, categories: 1, facts: 1 };

// ---------- shell ----------
function main(html: string) { const m = $('#main'); if (m) { m.innerHTML = html; m.focus({ preventScroll: true }); } }
async function route() {
  const [name, arg] = location.hash.replace(/^#\//, '').split('/'); const n = name || 'overview';
  $$('.sidebar a').forEach((a: any) => a.classList.toggle('on', a.getAttribute('href') === '#/' + n || (n === 'lessons' && a.getAttribute('href') === '#/courses')));
  $('.sidebar').classList.remove('open'); main('<div class="skel" style="height:240px"></div>');
  try {
    cats = await api('/categories');
    if (n === 'lessons') { const c = await api('/courses/' + arg); await crud('lessons', arg); $('#main h1').innerHTML = `Lessons: ${esc(c.title)} <a class="btn sm" href="#/courses">← Courses</a>`; }
    else if (SIMPLE[n]) await crud(n); else await ((SCREENS as Record<string, any>)[n] || SCREENS.overview)();
  } catch (e: any) { main(`<div class="card"><h2>Error</h2><p class="err">${esc(e.message)}</p></div>`); }
}

const IDLE_MS = 30 * 60 * 1000; // 30 minutes
let idleTimer: ReturnType<typeof setTimeout>;

function resetIdle(logoutFn: () => void) {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    toast('Session expired due to inactivity. Logging out…');
    setTimeout(logoutFn, 2000);
  }, IDLE_MS);
}

function startIdleWatcher(logoutFn: () => void) {
  const reset = () => resetIdle(logoutFn);
  ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(e => document.addEventListener(e, reset, { passive: true }));
  resetIdle(logoutFn);
}

let root: HTMLElement;
export async function boot(el: HTMLElement) {
  root = el;
  let me: Row | null = null;
  try { me = await api('/me'); } catch { /* not signed in */ }
  if (!me || me.role !== 'admin') { location.href = '/admin-login'; return; }
  root.innerHTML = `<div class="mtop"><b>S Learning CMS</b><button class="btn sm" id="mb" style="color:#fff;border-color:#fff">Menu</button></div><div class="shell"><aside class="sidebar"><b>S Learning CMS</b>${NAV.map((n: any) => `<a href="#/${n[0]}">${n[1]}</a>`).join('')}<a href="/" target="_blank" rel="noopener">View site ↗</a><a href="#" id="lo">Sign out</a></aside><main class="main" id="main" tabindex="-1"></main></div>`;
  $('#mb').onclick = () => $('.sidebar').classList.toggle('open');
  const doLogout = async () => { await api('/auth/logout', { method: 'POST', body: {} }).catch(() => {}); window.location.href = '/admin-login'; };
  $('#lo').onclick = async (e: Event) => { e.preventDefault(); await doLogout(); };
  startIdleWatcher(doLogout);
  window.addEventListener('hashchange', route); route();
}
