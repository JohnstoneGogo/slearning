// CMS — premium admin dashboard
type Row = Record<string, any>;
const $ = (s: string, r: ParentNode = document): any => r.querySelector(s);
const $$ = (s: string, r: ParentNode = document): any[] => [...r.querySelectorAll(s)];
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] as string));
const money = (m: number, c = 'GHS') => new Intl.NumberFormat('en', { style: 'currency', currency: c, maximumFractionDigits: 2 }).format((m || 0) / 100);
const fmt = (iso: string) => new Date(iso).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtShort = (iso: string) => new Date(iso).toLocaleDateString('en', { day: 'numeric', month: 'short' });
const ago = (iso: string) => { const s = Math.floor((Date.now() - +new Date(iso)) / 1000); if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s/60) + 'm ago'; if (s < 86400) return Math.floor(s/3600) + 'h ago'; return Math.floor(s/86400) + 'd ago'; };
const trend = (now: number, prev: number) => { if (!prev) return ''; const p = Math.round(((now - prev) / prev) * 100); const up = p >= 0; return `<span class="cms-trend ${up?'up':'dn'}">${up?'▲':'▼'} ${Math.abs(p)}%</span>`; };
const pill = (label: string, cls = '') => `<span class="cms-pill ${cls}">${esc(label)}</span>`;
const statusPill = (s: string) => pill(s, s==='success'||s==='activated'||s==='completed'?'green':s==='pending'||s==='processing'||s==='registered'?'yellow':s==='failed'||s==='mismatch'||s==='suspended'?'red':'grey');
const pct = (done: number, total: number) => total > 0 ? Math.round((done/total)*100) : 0;
const progressBar = (done: number, total: number) => { const p = pct(done, total); return `<div class="cms-prog"><div class="cms-prog-bar" style="width:${p}%"></div></div><small>${p}%</small>`; };

let cats: Row[] = [];
let adminMe: Row | null = null;

const toast = (m: string, type: 'ok'|'err' = 'ok') => {
  const t = $('#cms-toast'); if (!t) return;
  t.textContent = m; t.className = 'cms-toast on ' + type;
  clearTimeout((t as any).h); (t as any).h = setTimeout(() => t.classList.remove('on'), 3500);
};

async function api(p: string, o: { method?: string; body?: unknown; raw?: Blob; type?: string } = {}): Promise<any> {
  const r = await fetch('/api/v1' + p, {
    method: o.method || (o.raw || o.body ? 'POST' : 'GET'),
    credentials: 'same-origin',
    headers: o.raw ? { 'Content-Type': o.type as string } : { 'Content-Type': 'application/json' },
    body: o.raw || (o.body ? JSON.stringify(o.body) : undefined),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Request failed');
  return d;
}

export function mountAdmin(root: HTMLElement) { return boot(root); }

// ── Navigation ─────────────────────────────────────────────────────────────
const NAV: [string, [string, string, string][]][] = [
  ['Workspace', [
    ['overview', '◫', 'Overview'],
  ]],
  ['People', [
    ['users', '◎', 'Learners'],
    ['instructors', '♙', 'Team & roles'],
  ]],
  ['Learning', [
    ['courses', '▤', 'Courses'],
    ['categories', '▦', 'Course categories'],
    ['enrollments', '☷', 'Enrollments'],
    ['certificates', '◇', 'Certificates'],
    ['quizzes', '?', 'Quizzes'],
  ]],
  ['Operations', [
    ['payments', '$', 'Payments'],
    ['withdrawals', '↗', 'Payouts & withdrawals'],
    ['reviews', '☆', 'Reviews & feedback'],
    ['support', '◌', 'Support'],
    ['audit', '≡', 'Audit log'],
  ]],
  ['Website', [
    ['pages', '▧', 'Pages'],
    ['facts', '✳', 'Did you know'],
    ['settings', '⚙', 'Settings'],
    ['profile', '○', 'My profile'],
  ]],
];

// ── Sparkline SVG ──────────────────────────────────────────────────────────
function sparkline(data: number[], w = 80, h = 32, color = '#3b82f6'): string {
  if (!data.length || data.every(v => v === 0)) return `<svg width="${w}" height="${h}"></svg>`;
  const max = Math.max(...data, 1), min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * w;
    const y = h - ((v - min) / range) * (h - 6) - 3;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const first = pts.split(' ')[0], last = pts.split(' ').slice(-1)[0];
  const [lx] = last.split(',');
  const area = `M0,${h} L${pts.split(' ').join(' L')} L${lx},${h} Z`;
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none">
    <path d="${area}" fill="${color}" fill-opacity="0.1"/>
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${first.split(',')[0]}" cy="${first.split(',')[1]}" r="2.5" fill="${color}"/>
    <circle cx="${last.split(',')[0]}" cy="${last.split(',')[1]}" r="2.5" fill="${color}"/>
  </svg>`;
}

// ── KPI card ───────────────────────────────────────────────────────────────
function kpiCard(label: string, value: unknown, sub: string, chart: string, color = '#3b82f6') {
  return `<div class="cms-kpi" style="--kc:${color}">
    <div class="cms-kpi-top">
      <div class="cms-kpi-label">${esc(label)}</div>
      ${chart ? `<div class="cms-kpi-chart">${chart}</div>` : ''}
    </div>
    <div class="cms-kpi-val">${esc(String(value))}</div>
    ${sub ? `<div class="cms-kpi-sub">${sub}</div>` : ''}
  </div>`;
}

// ── main() helper ──────────────────────────────────────────────────────────
function main(html: string) { const m = $('#admin-main'); if (m) { m.innerHTML = html; m.scrollTop = 0; } }

function activityChart(signups: number[], enrollments: number[], days: number): string {
  const width = 720, height = 250, left = 42, right = 14, top = 16, bottom = 34;
  const values = [...signups, ...enrollments];
  const max = Math.max(1, ...values);
  const step = Math.ceil(max / 4);
  const ceiling = step * 4;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const point = (value: number, index: number, length: number) => {
    const x = left + (index / Math.max(length - 1, 1)) * plotWidth;
    const y = top + plotHeight - (value / ceiling) * plotHeight;
    return { x, y };
  };
  const line = (series: number[], color: string) => {
    const points = series.map((value, index) => point(value, index, series.length));
    return `<polyline class="cms-chart-line" points="${points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}" stroke="${color}"/>${points.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="${color}"/>`).join('')}`;
  };
  const grid = Array.from({ length: 5 }, (_, index) => {
    const value = ceiling - index * step;
    const y = top + (index / 4) * plotHeight;
    return `<line x1="${left}" y1="${y}" x2="${width-right}" y2="${y}" class="cms-chart-grid"/><text x="${left-9}" y="${y+4}" text-anchor="end" class="cms-chart-axis">${value}</text>`;
  }).join('');
  const labels = [0, 2, 4, 6].map(index => {
    const date = new Date(Date.now() - days * 864e5 + (days * index / 7) * 864e5);
    const p = point(0, index, 7);
    return `<text x="${p.x}" y="${height-8}" text-anchor="middle" class="cms-chart-axis">${date.toLocaleDateString('en', { month: 'short', day: 'numeric' })}</text>`;
  }).join('');
  const hasActivity = values.some(value => value > 0);
  return `<div class="cms-trend-chart">
    <div class="cms-chart-legend"><span><i class="cms-legend-dot signup"></i>New learners</span><span><i class="cms-legend-dot enrollment"></i>Enrollments</span></div>
    ${hasActivity
      ? `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="New learner registrations and enrollments over the last ${days} days">${grid}${labels}${line(signups, '#2563eb')}${line(enrollments, '#f59e0b')}</svg>`
      : '<div class="cms-chart-empty">No learner registrations or enrollments in this period.</div>'}
  </div>`;
}

function courseEnrollmentChart(courses: Row[]): string {
  if (!courses.length) return '<p class="cms-chart-empty">No courses to display yet.</p>';
  const max = Math.max(1, ...courses.map(course => Number(course.enrolments) || 0));
  return `<div class="cms-course-chart">${courses.map(course => {
    const count = Number(course.enrolments) || 0;
    const width = Math.round((count / max) * 100);
    return `<div class="cms-course-bar-row"><div class="cms-course-bar-label"><span title="${esc(course.title)}">${esc(course.title)}</span><b>${count}</b></div><div class="cms-course-bar-track" role="img" aria-label="${esc(course.title)}: ${count} enrollments"><i style="width:${width}%"></i></div></div>`;
  }).join('')}</div>`;
}

// ── Overview ───────────────────────────────────────────────────────────────
async function screenOverview(days = 30) {
  const s = await api('/admin/stats?days=' + days);
  const ghsRev = s.revenue?.find((r: any) => r.currency === 'GHS');
  const ngnRev = s.revenue?.find((r: any) => r.currency === 'NGN');
  main(`
<div class="cms-page-head">
  <div>
      <span class="cms-page-eyebrow">S LEARNING / ADMINISTRATION</span>
      <h1>Overview</h1>
      <p class="cms-sub">Welcome back${adminMe ? ', ' + esc((adminMe.full_name||'').split(' ')[0] || adminMe.username) : ''}. Platform activity over the last ${s.rangeDays} days.</p>
  </div>
  <div class="cms-head-actions">
    <label class="cms-range-label" for="stats-range">Reporting period</label>
    <select id="stats-range" class="cms-filter-select" aria-label="Dashboard reporting period">
      <option value="7" ${s.rangeDays===7?'selected':''}>Last 7 days</option>
      <option value="30" ${s.rangeDays===30?'selected':''}>Last 30 days</option>
      <option value="90" ${s.rangeDays===90?'selected':''}>Last 90 days</option>
    </select>
    ${s.provider === 'mock' ? '<span class="cms-pill yellow">⚠ Mock payments</span>' : '<span class="cms-pill green">✓ Live payments</span>'}
    ${s.needsReview ? `<a href="#/withdrawals" class="cms-pill red">⚠ ${s.needsReview} withdrawal${s.needsReview>1?'s':''} need review</a>` : ''}
    ${s.mismatches ? `<span class="cms-pill red">⚠ ${s.mismatches} mismatch${s.mismatches>1?'es':''}</span>` : ''}
    ${s.supportOpen ? `<a href="#/support" class="cms-pill yellow">🎧 ${s.supportOpen} open ticket${s.supportOpen>1?'s':''}</a>` : ''}
  </div>
</div>

<section class="cms-overview-section" aria-labelledby="overview-performance">
  <div class="cms-overview-section-head"><div><h2 id="overview-performance">Platform performance</h2><p>Audience, participation and course outcomes</p></div></div>
  <div class="cms-kpi-grid cms-kpi-primary">
  ${kpiCard('Total learners', s.users, `<span class="cms-sub-val">${s.activationRate??0}% activated</span>`, '', '#6366f1')}
  ${kpiCard('New learners', s.signups30d, trend(s.signups30d, s.signupsPrev30d), sparkline(s.signupsByDay||[], 80, 32, '#3b82f6'), '#3b82f6')}
  ${kpiCard('Enrollments', s.periodEnrollments??0, `${trend(s.periodEnrollments??0, s.previousEnrollments??0)} <span class="cms-sub-val">${s.enrollments??0} total</span>`, sparkline(s.enrollmentsByDay||[], 80, 32, '#f59e0b'), '#f59e0b')}
  ${kpiCard('Course completion', (s.completionRate??0)+'%', `${s.completions??0} completed enrollments`, '', '#d97706')}
</div>
</section>

<section class="cms-overview-section" aria-labelledby="overview-learning">
  <div class="cms-overview-section-head"><div><h2 id="overview-learning">Learning and operations</h2><p>Course catalogue, credentials and settled revenue</p></div></div>
  <div class="cms-kpi-grid cms-kpi-secondary">
  ${kpiCard('Activated learners', s.activated, `<span class="cms-sub-val">${s.suspended??0} suspended</span>`, '', '#10b981')}
  ${kpiCard('Instructors', s.instructors??0, 'Instructor accounts', '', '#8b5cf6')}
  ${kpiCard('Published courses', s.publishedCourses??0, `${s.courses??0} total courses`, '', '#0ea5e9')}
  ${kpiCard('Draft courses', s.drafts??0, 'Not visible to learners', '', '#64748b')}
  ${kpiCard('Certificates', s.certificates??0, `${s.completions30d??0} completions this period`, '', '#8b5cf6')}
  ${ghsRev ? kpiCard(`Revenue GHS (${s.rangeDays}d)`, money(ghsRev.total,'GHS'), `${trend(ghsRev.total, ghsRev.prev)} <span class="cms-sub-val">${ghsRev.n} successful transactions</span>`, '', '#22c55e') : ''}
  ${ngnRev ? kpiCard(`Revenue NGN (${s.rangeDays}d)`, money(ngnRev.total,'NGN'), `${trend(ngnRev.total, ngnRev.prev)} <span class="cms-sub-val">${ngnRev.n} successful transactions</span>`, '', '#22c55e') : ''}
</div>
</section>

<section class="cms-analytics-grid" aria-label="Learning analytics">
  <div class="cms-card cms-activity-card">
    <div class="cms-card-head"><div><h3>Growth and engagement</h3><p class="cms-sub">Learner registrations and enrollments by period</p></div></div>
    ${activityChart(s.signupsByDay||[], s.enrollmentsByDay||[], s.rangeDays)}
  </div>
  <div class="cms-card cms-courses-card">
    <div class="cms-card-head"><div><h3>Popular courses</h3><p class="cms-sub">Ranked by total enrollments</p></div><a href="#/courses" class="cms-link">Manage</a></div>
    ${courseEnrollmentChart(s.topCourses||[])}
  </div>
</section>

<div class="cms-dash-grid">
  <div class="cms-card">
    <div class="cms-card-head"><h3>Recent sign-ups</h3><a href="#/users" class="cms-link">View all →</a></div>
    <table class="cms-table">
      <thead><tr><th>User</th><th>Country</th><th>Status</th><th>Joined</th></tr></thead>
      <tbody>
        ${(s.recentSignups||[]).map((u: any) => `<tr>
          <td><div class="cms-user-cell"><div class="cms-av-sm">${u.avatarUrl?`<img src="${esc(u.avatarUrl)}" alt="">`:esc((u.fullName||u.username||'?')[0].toUpperCase())}</div><div><b>${esc(u.username)}</b><br><small class="cms-sub">${esc(u.fullName)}</small></div></div></td>
          <td>${esc(u.country)}</td>
          <td>${statusPill(u.suspended?'suspended':u.status)}</td>
          <td>${ago(u.registeredAt)}</td>
        </tr>`).join('')||'<tr><td colspan="4" class="cms-empty">No sign-ups yet.</td></tr>'}
      </tbody>
    </table>
  </div>

  <div class="cms-card">
    <div class="cms-card-head"><h3>Recent payments</h3><a href="#/payments" class="cms-link">View all →</a></div>
    <table class="cms-table">
      <thead><tr><th>User</th><th>Type</th><th>Amount</th><th>When</th></tr></thead>
      <tbody>
        ${(s.recentPayments||[]).map((p: any) => `<tr>
          <td>${esc(p.username)}</td>
          <td>${p.kind==='course'?pill('Course','blue'):pill('Activation','grey')}</td>
          <td><b>${money(p.amount, p.currency)}</b></td>
          <td>${ago(p.createdAt)}</td>
        </tr>`).join('')||'<tr><td colspan="4" class="cms-empty">No payments yet.</td></tr>'}
      </tbody>
    </table>
  </div>

  <div class="cms-card">
    <div class="cms-card-head"><h3>Top courses</h3><a href="#/courses" class="cms-link">Manage →</a></div>
    <table class="cms-table">
      <thead><tr><th>Course</th><th>Enrolled</th><th>Rating</th><th>Status</th></tr></thead>
      <tbody>
        ${(s.topCourses||[]).map((c: any) => `<tr>
          <td>${esc(c.title)}</td>
          <td>${c.enrolments}</td>
          <td>${c.rating ? '⭐ ' + (+c.rating).toFixed(1) : '—'}</td>
          <td>${c.published ? pill('Live','green') : pill('Draft','grey')}</td>
        </tr>`).join('')||'<tr><td colspan="4" class="cms-empty">No courses yet.</td></tr>'}
      </tbody>
    </table>
  </div>

  <div class="cms-card">
    <div class="cms-card-head"><h3>Pending withdrawals</h3><a href="#/withdrawals" class="cms-link">Manage →</a></div>
    ${s.pendingWithdrawals?.length ? s.pendingWithdrawals.map((w: any) => `
      <div class="cms-stat-row">
        <span>${esc(w.currency)}</span>
        <b>${money(w.total, w.currency)}</b>
        <span class="cms-sub">${w.n} request${w.n>1?'s':''}</span>
      </div>`).join('') : '<p class="cms-empty">No pending withdrawals.</p>'}
    <div class="cms-card-foot">
      <div class="cms-mini-stat"><span>Needs review</span><b class="${s.needsReview?'red':''}">${s.needsReview||0}</b></div>
      <div class="cms-mini-stat"><span>Mismatches</span><b class="${s.mismatches?'red':''}">${s.mismatches||0}</b></div>
      <div class="cms-mini-stat"><span>Provider</span><b>${esc(s.provider)}</b></div>
    </div>
  </div>
</div>`);
  $('#stats-range').onchange = (event: Event) => screenOverview(Number((event.target as HTMLSelectElement).value));
}

// ── Learners ───────────────────────────────────────────────────────────────
async function screenUsers(q = '', status = '', role = 'member', page = 1) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (status) params.set('status', status);
  if (role) params.set('role', role);
  params.set('page', String(page));
  const result = await api('/admin/users?' + params);
  const rows = result.items || [];
  main(`
<div class="cms-page-head">
  <h1>Learners</h1>
  <div class="cms-head-actions">
    <span class="cms-pill grey">${result.total} result${result.total!==1?'s':''}</span>
    <button class="cms-btn sm" id="export-users" type="button">Export CSV</button>
  </div>
</div>
<div class="cms-filters-bar">
  <form id="sf" class="cms-search-form">
    <input name="q" value="${esc(q)}" placeholder="Search name, email, member ID…" class="cms-search-input">
    <select name="status" class="cms-filter-select">
      <option value="" ${!status?'selected':''}>All statuses</option>
      <option value="activated" ${status==='activated'?'selected':''}>Activated</option>
      <option value="registered" ${status==='registered'?'selected':''}>Registered</option>
      <option value="suspended" ${status==='suspended'?'selected':''}>Suspended</option>
    </select>
    <select name="role" class="cms-filter-select" aria-label="Filter by account role">
      <option value="member" ${role==='member'?'selected':''}>Learners</option>
      <option value="instructor" ${role==='instructor'?'selected':''}>Instructors</option>
      <option value="admin" ${role==='admin'?'selected':''}>Administrators</option>
    </select>
    <button class="cms-btn primary sm" type="submit">Search</button>
    ${q||status||role!=='member' ? `<a href="#/users" class="cms-btn sm">Clear</a>` : ''}
  </form>
</div>
<div class="cms-card mt">
  <div class="cms-table-wrap">
    <table class="cms-table">
      <thead><tr><th>Member</th><th>Name</th><th>Email</th><th>Country</th><th>Enrolled</th><th>Status</th><th>Joined</th><th></th></tr></thead>
      <tbody>
      ${rows.map((u: any) => `<tr>
        <td><div class="cms-user-cell"><div class="cms-av-sm">${u.avatar_url?`<img src="${esc(u.avatar_url)}" alt="">`:esc((u.full_name||u.username||'?')[0].toUpperCase())}</div><div><b>${esc(u.member_id)}</b><br><small class="cms-sub">@${esc(u.username)}</small></div></div></td>
        <td>${esc(u.full_name)}</td>
        <td><small>${esc(u.email)}</small></td>
        <td>${esc(u.country)}</td>
        <td>${u.enrollments??0}</td>
        <td>${statusPill(u.suspended?'suspended':u.status)}</td>
        <td>${fmtShort(u.registered_at)}</td>
        <td class="cms-actions">
          <button class="cms-btn sm" data-view="${u.id}">View</button>
          ${u.role!=='admin'?`<button class="cms-btn sm ${u.suspended?'':'red'}" data-u="${u.id}" data-s="${u.suspended?0:1}">${u.suspended?'Restore':'Suspend'}</button>`:''}
          ${u.role!=='admin'?`<button class="cms-btn sm" data-g="${u.id}">Settle</button>`:''}
        </td>
      </tr>`).join('')||'<tr><td colspan="8" class="cms-empty">No users found.</td></tr>'}
      </tbody>
    </table>
  </div>
  <div class="cms-pagination" aria-label="Learner pages">
    <button class="cms-btn sm" id="users-prev" ${page<=1?'disabled':''}>Previous</button>
    <span>Page ${result.page} of ${Math.max(result.pages,1)}</span>
    <button class="cms-btn sm" id="users-next" ${page>=result.pages?'disabled':''}>Next</button>
  </div>
</div>
<div id="user-detail"></div>`);
  $('#sf').onsubmit = (e: any) => { e.preventDefault(); const fd = new FormData(e.target); screenUsers(String(fd.get('q')??''), String(fd.get('status')??''), String(fd.get('role')??'member')); };
  $('#users-prev').onclick = () => screenUsers(q, status, role, page - 1);
  $('#users-next').onclick = () => screenUsers(q, status, role, page + 1);
  $('#export-users').onclick = async () => {
    const exportParams = new URLSearchParams();
    if (q) exportParams.set('q', q);
    if (status) exportParams.set('status', status);
    if (role) exportParams.set('role', role);
    try {
      const response = await fetch('/api/v1/admin/users/export?' + exportParams, { credentials: 'same-origin' });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Unable to export learners.');
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = 'slearning-learners.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast(error.message, 'err');
    }
  };
  $$('[data-u]').forEach((b: any) => b.onclick = async () => {
    if (!confirm((+b.dataset.s ? 'Suspend' : 'Restore') + ' this user?')) return;
    await api('/admin/users/' + b.dataset.u, { method: 'PATCH', body: { suspended: b.dataset.s === '1' } });
    toast('Updated.'); screenUsers(q, status, role, page);
  });
  $$('[data-g]').forEach((b: any) => b.onclick = async () => {
    if (!confirm("Move this user's pending rewards to available?")) return;
    const r = await api('/admin/rewards/settle/' + b.dataset.g, { body: {} });
    toast('Settled ' + money(r.settled));
  });
  $$('[data-view]').forEach((b: any) => b.onclick = async () => {
    const u = await api('/admin/users/' + b.dataset.view);
    const det = $('#user-detail'); if (!det) return;
    det.innerHTML = `<div class="cms-card mt cms-user-detail">
      <div class="cms-user-detail-head">
        <div class="cms-av-lg">${u.avatar_url?`<img src="${esc(u.avatar_url)}" alt="">`:esc((u.full_name||'?')[0].toUpperCase())}</div>
        <div>
          <h2>${esc(u.full_name)}</h2>
          <p class="cms-sub">@${esc(u.username)} · ${esc(u.member_id)} · ${pill(u.role,'grey')}</p>
        </div>
        <button class="cms-btn sm" id="close-det">✕ Close</button>
      </div>
      <div class="cms-user-detail-grid">
        <div>
          <h3>Account info</h3>
          <div class="cms-info-list">
            <div><span>Email</span><b>${esc(u.email)}</b></div>
            <div><span>Phone</span><b>${esc(u.phone||'—')}</b></div>
            <div><span>Country</span><b>${esc(u.country)}</b></div>
            <div><span>Status</span>${statusPill(u.suspended?'suspended':u.status)}</div>
            <div><span>Email verified</span>${u.email_verified?pill('Yes','green'):pill('No','red')}</div>
            <div><span>Eligible</span>${u.eligible?pill('Yes','green'):pill('No','grey')}</div>
            <div><span>Registered</span><b>${fmt(u.registered_at)}</b></div>
          </div>
          <div class="cms-form-foot mt">
            ${u.role!=='admin'?`<button class="cms-btn sm ${u.suspended?'':'red'}" data-ua="${u.id}" data-sv="${u.suspended?0:1}">${u.suspended?'Restore account':'Suspend account'}</button>`:''}
            ${u.role!=='admin'?`<button class="cms-btn sm ${u.eligible?'red':''}" data-ea="${u.id}" data-ev="${u.eligible?0:1}">${u.eligible?'Remove eligibility':'Mark eligible'}</button>`:''}
          </div>
        </div>
        <div>
          <h3>Learning</h3>
          <div class="cms-info-list">
            <div><span>Enrollments</span><b>${u.enrollment_count}</b></div>
            <div><span>Completions</span><b>${u.completions}</b></div>
          </div>
          ${u.enrollments?.length ? `<h3 class="mt">Course history</h3><div class="cms-table-wrap"><table class="cms-table"><thead><tr><th>Course</th><th>Progress</th><th>Status</th><th>Certificate</th></tr></thead><tbody>${u.enrollments.map((e: any) => `<tr><td>${esc(e.course_title)}</td><td>${progressBar(e.lessons_done,e.total_lessons)}</td><td>${e.completed_at?pill('Completed','green'):pill('In progress','yellow')}</td><td>${e.cert_code?`<code class="cms-ref">${esc(e.cert_code)}</code>`:'—'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="cms-empty">No course history yet.</p>'}
          ${u.payments?.length ? `<h3 class="mt">Recent payments</h3><table class="cms-table"><thead><tr><th>Type</th><th>Amount</th><th>Date</th></tr></thead><tbody>${u.payments.map((p: any) => `<tr><td>${p.kind}</td><td>${money(p.amount,p.currency)}</td><td>${fmtShort(p.created_at)}</td></tr>`).join('')}</tbody></table>` : ''}
        </div>
      </div>
    </div>`;
    det.scrollIntoView({ behavior: 'smooth' });
    $('#close-det').onclick = () => { det.innerHTML = ''; };
    $$('[data-ua]').forEach((b2: any) => b2.onclick = async () => {
      await api('/admin/users/' + b2.dataset.ua, { method: 'PATCH', body: { suspended: b2.dataset.sv === '1' } });
      toast('Updated.'); screenUsers(q, status, role, page);
    });
    $$('[data-ea]').forEach((b2: any) => b2.onclick = async () => {
      await api('/admin/users/' + b2.dataset.ea, { method: 'PATCH', body: { eligible: b2.dataset.ev === '1' } });
      toast('Updated.'); screenUsers(q, status, role, page);
    });
  });
}

// ── Instructors ────────────────────────────────────────────────────────────
async function screenInstructors() {
  const rows = await api('/admin/instructors');
  main(`
<div class="cms-page-head">
  <h1>Instructors</h1>
  <button class="cms-btn primary" id="add-inst">+ Add instructor</button>
</div>
<div class="cms-card">
  <div class="cms-table-wrap">
    <table class="cms-table">
      <thead><tr><th>Name</th><th>Email</th><th>Country</th><th>Role</th><th>Courses</th><th>Status</th><th>Joined</th><th></th></tr></thead>
      <tbody>
      ${rows.map((u: any) => `<tr>
        <td><div class="cms-user-cell"><div class="cms-av-sm">${esc((u.full_name||u.username||'?')[0].toUpperCase())}</div><div><b>${esc(u.full_name)}</b><br><small class="cms-sub">@${esc(u.username)}</small></div></div></td>
        <td><small>${esc(u.email)}</small></td>
        <td>${esc(u.country)}</td>
        <td>${pill(u.role, u.role==='admin'?'red':'blue')}</td>
        <td>${u.courses}</td>
        <td>${u.suspended?pill('Suspended','red'):pill('Active','green')}</td>
        <td>${fmtShort(u.registered_at)}</td>
        <td class="cms-actions">
          <button class="cms-btn sm ${u.suspended?'':'red'}" data-iu="${u.id}" data-is="${u.suspended?0:1}">${u.suspended?'Restore':'Suspend'}</button>
          <button class="cms-btn sm" data-ir="${u.id}" data-role="${u.role}">Role</button>
        </td>
      </tr>`).join('')||'<tr><td colspan="8" class="cms-empty">No instructors yet.</td></tr>'}
      </tbody>
    </table>
  </div>
</div>
<div id="inst-form"></div>`);

  const showForm = () => {
    $('#inst-form').innerHTML = `<form id="if" class="cms-card cms-form mt">
      <h2>Add instructor</h2>
      <label>Full name<input name="full_name" required></label>
      <label>Username<input name="username" required pattern="[a-z0-9_]{3,20}" placeholder="lowercase, 3-20 chars"></label>
      <label>Email<input name="email" type="email" required></label>
      <label>Password<input name="password" type="password" required placeholder="8+ chars, letter + number"></label>
      <label>Country<select name="country"><option value="GH">Ghana</option><option value="NG">Nigeria</option></select></label>
      <p class="cms-err full"></p>
      <div class="cms-form-foot"><button class="cms-btn primary" type="submit">Create</button><button class="cms-btn" type="button" id="cx-inst">Cancel</button></div>
    </form>`;
    $('#if').onsubmit = async (e: any) => { e.preventDefault(); const b = Object.fromEntries(new FormData(e.target)); try { await api('/admin/instructors', { body: b }); toast('Instructor created.'); screenInstructors(); } catch (x: any) { $('.cms-err', e.target).textContent = x.message; } };
    $('#cx-inst').onclick = () => { $('#inst-form').innerHTML = ''; };
    $('#inst-form').scrollIntoView({ behavior: 'smooth' });
  };
  $('#add-inst').onclick = showForm;
  $$('[data-iu]').forEach((b: any) => b.onclick = async () => {
    if (!confirm((+b.dataset.is ? 'Suspend' : 'Restore') + ' this instructor?')) return;
    await api('/admin/instructors/' + b.dataset.iu, { method: 'PATCH', body: { suspended: +b.dataset.is } });
    toast('Updated.'); screenInstructors();
  });
  $$('[data-ir]').forEach((b: any) => b.onclick = async () => {
    const r = prompt('Role (admin / instructor / member):', b.dataset.role); if (!r) return;
    try { await api('/admin/instructors/' + b.dataset.ir, { method: 'PATCH', body: { role: r } }); toast('Role updated.'); screenInstructors(); } catch (x: any) { toast(x.message, 'err'); }
  });
}

// ── Enrollments ────────────────────────────────────────────────────────────
async function screenEnrollments(courseId = '') {
  const params = courseId ? '?course_id=' + courseId : '';
  const [rows, courses] = await Promise.all([api('/admin/enrollments' + params), api('/categories').then(() => api('/admin/content/courses'))]);
  main(`
<div class="cms-page-head">
  <h1>Enrollments</h1>
  <span class="cms-pill grey">${rows.length} total</span>
</div>
<div class="cms-filters-bar">
  <form id="ef2" class="cms-search-form">
    <select name="course_id" class="cms-filter-select">
      <option value="">All courses</option>
      ${courses.map((c: any) => `<option value="${c.id}" ${courseId==c.id?'selected':''}>${esc(c.title)}</option>`).join('')}
    </select>
    <button class="cms-btn primary sm" type="submit">Filter</button>
    ${courseId ? `<a href="#/enrollments" class="cms-btn sm">Clear</a>` : ''}
  </form>
</div>
<div class="cms-card mt">
  <div class="cms-table-wrap">
    <table class="cms-table">
      <thead><tr><th>Learner</th><th>Course</th><th>Progress</th><th>Enrolled</th><th>Completed</th><th>Certificate</th></tr></thead>
      <tbody>
      ${rows.map((e: any) => `<tr>
        <td><b>${esc(e.username)}</b><br><small class="cms-sub">${esc(e.full_name)} · ${esc(e.country)}</small></td>
        <td>${esc(e.course_title)}</td>
        <td>${progressBar(e.lessons_done, e.total_lessons)}</td>
        <td>${fmtShort(e.created_at)}</td>
        <td>${e.completed_at ? pill('Done','green') : pill('In progress','yellow')}</td>
        <td>${e.cert_code ? `<code class="cms-ref">${esc(e.cert_code.slice(0,8))}…</code>` : '—'}</td>
      </tr>`).join('')||'<tr><td colspan="6" class="cms-empty">No enrollments found.</td></tr>'}
      </tbody>
    </table>
  </div>
</div>`);
  $('#ef2').onsubmit = (e: any) => { e.preventDefault(); const fd = new FormData(e.target); screenEnrollments(String(fd.get('course_id')??'')); };
}

async function screenCertificates() {
  const rows = await api('/admin/certificates');
  main(`<div class="cms-page-head"><div><h1>Certificates</h1><p class="cms-sub">Issued certificates from completed course enrollments.</p></div><span class="cms-pill grey">${rows.length} recent records</span></div>
  <div class="cms-card"><div class="cms-table-wrap"><table class="cms-table"><thead><tr><th>Learner</th><th>Course</th><th>Certificate code</th><th>Issued</th><th>Verify</th></tr></thead><tbody>
  ${rows.map((row: any) => `<tr><td><b>${esc(row.user.full_name)}</b><br><small class="cms-sub">@${esc(row.user.username)} · ${esc(row.user.member_id)}</small></td><td>${esc(row.course.title)}</td><td><code class="cms-ref">${esc(row.cert_code)}</code></td><td>${row.completed_at?fmt(row.completed_at):'—'}</td><td><a class="cms-btn sm" href="/certificate/${encodeURIComponent(row.cert_code)}" target="_blank" rel="noopener noreferrer">View certificate</a></td></tr>`).join('')||'<tr><td colspan="5" class="cms-empty">No certificates issued yet.</td></tr>'}
  </tbody></table></div></div>
  <p class="cms-sub mt">Certificate revocation is not supported by the current data model.</p>`);
}

// ── Pages ──────────────────────────────────────────────────────────────────
async function screenPages() {
  const rows = await api('/admin/pages');
  main(`<div class="cms-page-head"><h1>Pages</h1><button class="cms-btn primary" id="add">+ New page</button></div>
  <div class="cms-card">
    <table class="cms-table"><thead><tr><th>Slug</th><th>Title</th><th>Updated</th><th></th></tr></thead><tbody>
    ${rows.map((p: any) => `<tr><td><code class="cms-ref">${esc(p.slug)}</code></td><td>${esc(p.title)}</td><td>${fmtShort(p.updated_at)}</td>
    <td class="cms-actions"><button class="cms-btn sm" data-s="${esc(p.slug)}">Edit</button><button class="cms-btn sm red" data-x="${esc(p.slug)}">Delete</button></td></tr>`).join('')||'<tr><td colspan="4" class="cms-empty">No pages yet.</td></tr>'}
    </tbody></table>
  </div><div id="ed"></div>`);
  const edit = (p?: any) => {
    p ||= { slug: '', title: '', body: '' };
    $('#ed').innerHTML = `<form id="ef" class="cms-card cms-form mt"><h2>${p.slug?'Edit':'New'} page</h2>
      <label>Slug<input name="slug" value="${esc(p.slug)}" ${p.slug?'readonly':''} required pattern="[a-z0-9-]{2,40}" placeholder="e.g. about-us"></label>
      <label>Title<input name="title" value="${esc(p.title)}" required></label>
      <label class="full">Content<textarea name="body" rows="14">${esc(p.body)}</textarea></label>
      <p class="cms-err full"></p>
      <div class="cms-form-foot"><button class="cms-btn primary" type="submit">Save</button><button class="cms-btn" type="button" id="cx">Cancel</button></div></form>`;
    $('#ef').onsubmit = async (e: any) => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); try { await api('/admin/pages/' + d.slug, { method: 'PUT', body: d }); toast('Saved.'); screenPages(); } catch (x: any) { $('.cms-err', e.target).textContent = x.message; } };
    $('#cx').onclick = () => { $('#ed').innerHTML = ''; }; $('#ef').scrollIntoView({ behavior: 'smooth' });
  };
  $('#add').onclick = () => edit();
  $$('[data-s]').forEach((b: any) => b.onclick = () => edit(rows.find((r: any) => r.slug === b.dataset.s)));
  $$('[data-x]').forEach((b: any) => b.onclick = async () => { if (confirm('Delete this page?')) { await api('/admin/pages/' + b.dataset.x, { method: 'DELETE' }); screenPages(); } });
}

// ── Reviews ────────────────────────────────────────────────────────────────
async function screenReviews() {
  const rows = await api('/admin/reviews');
  main(`<div class="cms-page-head"><h1>Reviews &amp; Feedback</h1></div>
  <div class="cms-card"><div class="cms-table-wrap"><table class="cms-table"><thead><tr><th>Course</th><th>User</th><th>Rating</th><th>Review</th><th>Status</th><th></th></tr></thead><tbody>
  ${rows.map((r: any) => `<tr><td>${esc(r.course)}</td><td>${esc(r.username)}</td>
  <td>${'⭐'.repeat(r.rating)}</td><td><small>${esc(r.body?.slice(0,80))}${r.body?.length>80?'…':''}</small></td>
  <td>${statusPill(r.status)}</td>
  <td><button class="cms-btn sm" data-r="${r.id}" data-s="${r.status==='hidden'?'published':'hidden'}">${r.status==='hidden'?'Show':'Hide'}</button></td></tr>`).join('')||'<tr><td colspan="6" class="cms-empty">No reviews yet.</td></tr>'}
  </tbody></table></div></div>`);
  $$('[data-r]').forEach((b: any) => b.onclick = async () => { await api('/admin/reviews/' + b.dataset.r, { method: 'PATCH', body: { status: b.dataset.s } }); screenReviews(); });
}

// ── Payments ───────────────────────────────────────────────────────────────
async function screenPayments() {
  const rows = await api('/admin/payments');
  main(`<div class="cms-page-head"><h1>Payments &amp; Transactions</h1><span class="cms-pill grey">${rows.length} records</span></div>
  <div class="cms-card"><div class="cms-table-wrap"><table class="cms-table"><thead><tr><th>Date</th><th>Type</th><th>User</th><th>Reference</th><th>Amount</th><th>Status</th><th></th></tr></thead><tbody>
  ${rows.map((p: any) => `<tr>
    <td>${fmtShort(p.created_at)}</td>
    <td>${p.kind==='course'?pill('Course','blue'):pill('Activation','grey')}</td>
    <td>${esc(p.username)}</td>
    <td><code class="cms-ref">${esc(p.reference)}</code></td>
    <td><b>${money(p.amount, p.currency)}</b></td>
    <td>${statusPill(p.status)}</td>
    <td>${p.status==='pending'||p.status==='failed'?`<button class="cms-btn sm" data-v="${esc(p.reference)}">Re-check</button>`:''}</td>
  </tr>`).join('')||'<tr><td colspan="7" class="cms-empty">No payments yet.</td></tr>'}
  </tbody></table></div></div>`);
  $$('[data-v]').forEach((b: any) => b.onclick = async () => { try { const r = await api(`/admin/payments/${b.dataset.v}/verify`, { body: {} }); toast('Status: ' + r.status); screenPayments(); } catch (x: any) { toast(x.message, 'err'); } });
}

// ── Withdrawals ────────────────────────────────────────────────────────────
async function screenWithdrawals() {
  const rows = await api('/admin/withdrawals');
  main(`<div class="cms-page-head"><h1>Withdrawals</h1></div>
  <div class="cms-card"><div class="cms-table-wrap"><table class="cms-table"><thead><tr><th>Date</th><th>User</th><th>Amount</th><th>Method</th><th>Status</th><th></th></tr></thead><tbody>
  ${rows.map((w: any) => `<tr>
    <td>${fmtShort(w.created_at)}</td><td>${esc(w.username)}</td>
    <td><b>${money(w.amount, w.currency)}</b><br><small class="cms-sub">fee ${money(w.fee, w.currency)}</small></td>
    <td>${esc(w.method)}<br><small class="cms-sub">${esc(w.account_name)} · ${esc(w.account_number)}</small></td>
    <td>${statusPill(w.status)}${w.note?`<br><small class="cms-sub">${esc(w.note)}</small>`:''}</td>
    <td class="cms-actions">
      ${w.status==='review'?`<button class="cms-btn sm primary" data-a="approve" data-w="${w.id}">Approve</button>`:''}
      ${['review','processing'].includes(w.status)?`<button class="cms-btn sm red" data-a="fail" data-w="${w.id}">Reject</button>`:''}
      ${['review','processing'].includes(w.status)&&!w.provider_ref?`<button class="cms-btn sm" data-a="complete" data-w="${w.id}">Mark paid</button>`:''}
    </td>
  </tr>`).join('')||'<tr><td colspan="6" class="cms-empty">No withdrawals yet.</td></tr>'}
  </tbody></table></div></div>
  <p class="cms-sub mt">Approve sends the payout via the payment provider. "Mark paid" is for manual payouts. Rejecting returns funds to the user's balance.</p>`);
  $$('[data-w]').forEach((b: any) => b.onclick = async () => { if (!confirm(b.dataset.a + ' this withdrawal?')) return; try { await api('/admin/withdrawals/' + b.dataset.w, { method: 'PATCH', body: { action: b.dataset.a } }); screenWithdrawals(); } catch (x: any) { toast(x.message, 'err'); } });
}

// ── Audit log ──────────────────────────────────────────────────────────────
async function screenAudit() {
  const rows = await api('/admin/audit');
  main(`<div class="cms-page-head"><h1>Audit log</h1></div>
  <div class="cms-card"><div class="cms-table-wrap"><table class="cms-table"><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Detail</th></tr></thead><tbody>
  ${rows.map((a: any) => `<tr><td>${fmt(a.created_at)}</td><td>${a.actor??'system'}</td><td><code class="cms-ref">${esc(a.action)}</code></td><td><small class="cms-sub">${esc(JSON.stringify(a.detail))}</small></td></tr>`).join('')||'<tr><td colspan="4" class="cms-empty">No entries.</td></tr>'}
  </tbody></table></div></div>`);
}

// ── Support ────────────────────────────────────────────────────────────────
async function screenSupport() {
  const cur = (location.hash.split('?status=')[1] || 'open');
  const { items, counts } = await api('/admin/support?status=' + cur);
  const tabs = ['all','open','in_progress','resolved','closed'];
  main(`<div class="cms-page-head"><h1>Support</h1></div>
  <div class="cms-tabs">${tabs.map(t => `<button class="cms-tab${cur===t?' on':''}" data-t="${t}">${t.replace('_',' ')} <span class="cms-badge">${counts[t]||0}</span></button>`).join('')}</div>
  <div class="cms-card mt"><div class="cms-table-wrap"><table class="cms-table"><thead><tr><th>Date</th><th>User</th><th>Subject</th><th>Category</th><th>Status</th><th></th></tr></thead><tbody>
  ${items.map((r: any) => `<tr>
    <td>${fmtShort(r.created_at)}</td>
    <td>${r.username?esc(r.username):esc(r.name)}<br><small class="cms-sub">${esc(r.email)}</small></td>
    <td>${esc(r.subject)}<br><small class="cms-sub">${esc(r.body?.slice(0,60))}…</small></td>
    <td>${pill(r.category,'grey')}</td>
    <td>${statusPill(r.status)}</td>
    <td><button class="cms-btn sm" data-sid="${r.id}" data-status="${r.status}" data-note="${esc(r.note||'')}">Update</button></td>
  </tr>`).join('')||'<tr><td colspan="6" class="cms-empty">No tickets.</td></tr>'}
  </tbody></table></div></div>`);
  $$('.cms-tab').forEach((b: any) => b.onclick = () => { location.hash = '#/support?status=' + b.dataset.t; screenSupport(); });
  $$('[data-sid]').forEach((b: any) => b.onclick = () => {
    const status = prompt('Status (open / in_progress / resolved / closed):', b.dataset.status); if (!status) return;
    const note = prompt('Note (optional):', b.dataset.note) ?? '';
    api('/admin/support/' + b.dataset.sid, { method: 'PATCH', body: { status, note } }).then(() => { toast('Updated.'); screenSupport(); }).catch((x: any) => toast(x.message, 'err'));
  });
}

// ── Quizzes ────────────────────────────────────────────────────────────────
async function screenQuizzes(courseId = '') {
  const [rows, courses] = await Promise.all([
    api('/admin/quizzes' + (courseId ? '?course_id=' + courseId : '')),
    api('/admin/content/courses'),
  ]);
  main(`<div class="cms-page-head"><h1>Quizzes</h1></div>
  <div class="cms-filters-bar">
    <form id="qf" class="cms-search-form">
      <select name="course_id" class="cms-filter-select">
        <option value="">All courses</option>
        ${courses.map((c: any) => `<option value="${c.id}" ${courseId==c.id?'selected':''}>${esc(c.title)}</option>`).join('')}
      </select>
      <button class="cms-btn primary sm" type="submit">Filter</button>
    </form>
  </div>
  <div class="cms-card mt"><div class="cms-table-wrap"><table class="cms-table"><thead><tr><th>Lesson</th><th>Title</th><th>Questions</th><th>Attempts</th><th>Pass %</th><th></th></tr></thead><tbody>
  ${rows.map((q: any) => `<tr>
    <td>${esc(q.lesson_title)}</td>
    <td>${esc(q.title)}</td>
    <td>${q.questions}</td>
    <td>${q.attempts}</td>
    <td>${q.pass_percent}%</td>
    <td class="cms-actions">
      <button class="cms-btn sm" data-qv="${q.id}">Questions</button>
      <button class="cms-btn sm red" data-qd="${q.id}">Delete</button>
    </td>
  </tr>`).join('')||'<tr><td colspan="6" class="cms-empty">No quizzes yet. Add them from the Lessons editor.</td></tr>'}
  </tbody></table></div></div>
  <div id="q-detail"></div>`);
  $('#qf').onsubmit = (e: any) => { e.preventDefault(); screenQuizzes(String(new FormData(e.target).get('course_id')??'')); };
  $$('[data-qd]').forEach((b: any) => b.onclick = async () => { if (confirm('Delete this quiz and all its questions?')) { await api('/admin/quizzes/' + b.dataset.qd, { method: 'DELETE' }); screenQuizzes(courseId); } });
  $$('[data-qv]').forEach((b: any) => b.onclick = async () => {
    const qs = await api('/admin/quizzes/' + b.dataset.qv + '/questions');
    const det = $('#q-detail'); if (!det) return;
    det.innerHTML = `<div class="cms-card mt"><div class="cms-card-head"><h3>Questions (${qs.length})</h3><button class="cms-btn sm" id="cq">Close</button></div>
      ${qs.length ? qs.map((q: any, i: number) => `<div class="cms-q-item"><b>${i+1}. ${esc(q.prompt)}</b><ul>${(q.options||[]).map((o: string, j: number) => `<li ${j===q.answer_index?'class="cms-q-correct"':''}>${esc(o)}${j===q.answer_index?' ✓':''}</li>`).join('')}</ul>${q.explanation?`<small class="cms-sub">${esc(q.explanation)}</small>`:''}</div>`).join('') : '<p class="cms-empty">No questions yet.</p>'}
    </div>`;
    $('#cq').onclick = () => { det.innerHTML = ''; };
    det.scrollIntoView({ behavior: 'smooth' });
  });
}

// ── Settings ───────────────────────────────────────────────────────────────
async function screenSettings() {
  const all = await api('/admin/settings');
  const MONEY = new Set(['activation_fee','referral_reward','course_reward','min_withdrawal','withdrawal_review_above']);
  const LABEL: Record<string,string> = { site:'Business details & homepage', activation_fee:'Activation fee', referral_reward:'Referral reward', course_reward:'Course completion reward', min_withdrawal:'Minimum withdrawal', withdrawal_review_above:'Manual review above', withdrawal_fee_percent:'Withdrawal fee (%)', payout_methods:'Payout methods', task_deadline_hours:'Task deadline (hours)', reviews:'Homepage reviews (JSON)' };
  const field = (key: any, k: any, v: any) => { const m = MONEY.has(key), t = Array.isArray(v) ? 'arr' : typeof v;
    return `<label>${esc(k??'')}${m?' <small>(major units, e.g. 50 = 50.00)</small>':''}<input data-k="${esc(k??'')}" data-t="${t}" ${m?'data-m="1"':''} value="${esc(Array.isArray(v)?v.join(', '):m?v/100:v)}"></label>`; };
  main(`<div class="cms-page-head"><h1>Settings</h1><p class="cms-sub">Changes go live immediately.</p></div>
  <div class="cms-settings-grid">${Object.entries(all).map(([key,val]) => {
    const simple = val && typeof val==='object' && !Array.isArray(val), json = Array.isArray(val) && typeof (val as any[])[0]==='object';
    return `<form class="cms-card cms-form" data-key="${key}"><h3>${esc(LABEL[key]||key)}</h3>
      ${json?`<label class="full"><textarea data-t="json" rows="8">${esc(JSON.stringify(val,null,2))}</textarea></label>`:simple?Object.entries(val as object).map(([k,v])=>field(key,k,v)).join(''):field(key,'',val)}
      <div class="cms-form-foot"><button class="cms-btn primary" type="submit">Save</button></div></form>`;
  }).join('')}</div>`);
  $$('form[data-key]').forEach((f: any) => f.onsubmit = async (e: any) => {
    e.preventDefault(); const key = f.dataset.key, ins = $$('input,textarea', f);
    const conv = (el: any) => el.dataset.t==='number'?(el.dataset.m?Math.round(+el.value*100):+el.value):el.dataset.t==='arr'?el.value.split(',').map((s: any)=>s.trim()).filter(Boolean):el.value;
    try { let value; if (ins[0].dataset.t==='json') value=JSON.parse(ins[0].value); else if (!ins[0].dataset.k) value=conv(ins[0]); else value=Object.fromEntries(ins.map((el: any)=>[el.dataset.k,conv(el)])); await api('/admin/settings/'+key,{method:'PUT',body:{value}}); toast('Saved.'); } catch (x: any) { toast('Error: '+x.message,'err'); }
  });
}

// ── Profile ────────────────────────────────────────────────────────────────
async function screenProfile() {
  if (!adminMe) adminMe = await api('/me');
  const u = adminMe!;
  main(`<div class="cms-page-head"><h1>My profile</h1></div>
  <div class="cms-profile-grid">
    <div class="cms-card">
      <div class="cms-profile-avatar">
        <div class="cms-av-lg">${u.avatar_url?`<img src="${esc(u.avatar_url)}" alt="">`:esc((u.full_name||u.username||'A')[0].toUpperCase())}</div>
        <div><h2>${esc(u.full_name)}</h2><p class="cms-sub">@${esc(u.username)} · ${pill('Admin','green')}</p></div>
      </div>
      <div class="cms-info-list">
        <div><span>Member ID</span><b>${esc(u.member_id)}</b></div>
        <div><span>Email</span><b>${esc(u.email)}</b></div>
        <div><span>Phone</span><b>${esc(u.phone||'—')}</b></div>
        <div><span>Country</span><b>${esc(u.country)}</b></div>
        <div><span>Email verified</span>${u.email_verified?pill('Yes','green'):pill('No','red')}</div>
      </div>
    </div>
    <div class="cms-card">
      <h3>Update details</h3>
      <form id="pf" class="cms-form mt">
        <label>Full name<input name="full_name" value="${esc(u.full_name)}" required></label>
        <label>Phone<input name="phone" value="${esc(u.phone||'')}" placeholder="+233..."></label>
        <p class="cms-err"></p>
        <div class="cms-form-foot"><button class="cms-btn primary" type="submit">Save changes</button></div>
      </form>
      <hr class="cms-divider">
      <h3>Change password</h3>
      <form id="pwf" class="cms-form mt">
        <label>Current password<input type="password" name="current" required></label>
        <label>New password<input type="password" name="password" required></label>
        <p class="cms-err"></p>
        <div class="cms-form-foot"><button class="cms-btn primary" type="submit">Change password</button></div>
      </form>
    </div>
  </div>`);
  $('#pf').onsubmit = async (e: any) => { e.preventDefault(); const b = Object.fromEntries(new FormData(e.target)); try { adminMe = await api('/me', { method: 'PATCH', body: { full_name: b.full_name, phone: b.phone } }); toast('Profile updated.'); screenProfile(); } catch (x: any) { $('.cms-err', e.target).textContent = x.message; } };
  $('#pwf').onsubmit = async (e: any) => { e.preventDefault(); const b = Object.fromEntries(new FormData(e.target)); try { await api('/me/password', { method: 'POST', body: b }); toast('Password changed.'); (e.target as HTMLFormElement).reset(); } catch (x: any) { $('.cms-err', e.target).textContent = x.message; } };
}

// ── Generic CRUD helpers ───────────────────────────────────────────────────
let cats2: Row[] = [];
const RES: Record<string, any> = {
  courses: { cols: ['cover_url','title','author','category_name','enrollment_count','completion_count','price_ghs','price_ngn','published'],
    fields: () => [['title','Title','text',1],['author','Author'],['category_id','Category','select',0,cats2.map((c:any)=>[c.id,c.name])],['level','Level','select',0,['Beginner','Intermediate','Advanced'].map((x:any)=>[x,x])],['description','Description','textarea'],['cover_url','Cover image','image'],['minutes','Total minutes','number'],['language','Language'],['price_ghs','Price GHS','m?'],['price_ngn','Price NGN','m?'],['learn_points',"What you'll learn (one per line)",'lines'],['skills','Skills (comma separated)'],['reward_eligible','Reward eligible','check'],['published','Published','check']],
    lessons:1, defaults:{published:1,minutes:60,level:'Beginner',language:'English',learn_points:[],price_ghs:'',price_ngn:''} },
  categories: { cols:['id','name','sort'], fields:()=>[['name','Name','text',1],['description','Description','textarea'],['thumb_url','Image','image'],['sort','Sort order','number']], defaults:{sort:0} },
  facts: { cols:['id','title','active'], fields:()=>[['title','Title','text',1],['body','Text','textarea'],['image_url','Image','image'],['link_url','Link (optional)'],['active','Show on site','check']], defaults:{active:1} },
  lessons: { cols:['sort','title','kind','preview'], fields:()=>[['title','Title','text',1],['kind','Type','select',0,[['text','Reading'],['video','Video'],['pdf','PDF eBook']]],['content','Text content','textarea'],['url','Video URL / PDF file','file'],['minutes','Minutes','number'],['sort','Order','number'],['preview','Free preview','check']], defaults:{kind:'text',minutes:10,sort:1,preview:0} },
};

function inp([n, label, type='text', req, opts]: any[], v: any) {
  v ??= ''; const id = `f_${n}`, L = `<label class="${type==='textarea'||type==='lines'?'full':''}" for="${id}">${label}`;
  if (type==='textarea') return `${L}<textarea id="${id}" name="${n}" rows="5">${esc(v)}</textarea></label>`;
  if (type==='lines') return `${L}<textarea id="${id}" name="${n}" data-t="lines" rows="4">${esc((Array.isArray(v)?v:JSON.parse(v||'[]')).join('\n'))}</textarea></label>`;
  if (type==='select') return `${L}<select id="${id}" name="${n}">${opts.map((o:any)=>`<option value="${esc(o[0])}" ${o[0]==v?'selected':''}>${esc(o[1])}</option>`).join('')}</select></label>`;
  if (type==='m?') return `${L}<input id="${id}" name="${n}" type="number" min="0" max="20000000" step="0.01" inputmode="decimal" data-nullable-money value="${esc(v)}" placeholder="Leave blank until set"></label>`;
  if (type==='check') return `<label class="cms-check"><input type="checkbox" id="${id}" name="${n}" ${v?'checked':''}> ${label}</label>`;
  if (type==='image'||type==='file') {
    const prev = v&&type==='image' ? `<div class="cms-up-preview"><img src="${esc(v)}" alt=""></div>` : `<div class="cms-up-preview empty"><span>${type==='image'?'Preview':'File'}</span></div>`;
    return `${L}<div class="cms-up-box">${prev}<input id="${id}" name="${n}" value="${esc(v)}" placeholder="${type==='image'?'Paste URL or upload':'Video URL or upload PDF'}"><input type="file" data-up="${n}" data-kind="${type}" accept="${type==='image'?'image/*':'application/pdf'}"></div></label>`;
  }
  return `${L}<input id="${id}" name="${n}" type="${type}" value="${esc(v)}" ${req?'required':''}></label>`;
}

function collect(f: any) {
  const o: Row = {};
  $$('input,textarea,select', f).forEach((el: any) => {
    if (!el.name) return;
    o[el.name] = el.type==='checkbox' ? +el.checked : el.dataset.t==='lines' ? el.value.split('\n').map((s:any)=>s.trim()).filter(Boolean) : el.dataset.nullableMoney!==undefined&&el.value.trim()==='' ? null : el.type==='number' ? +el.value : el.value;
  });
  return o;
}

function wireUploads(f: any) {
  $$('[data-up]', f).forEach((inp2: any) => inp2.onchange = async () => {
    const file = inp2.files[0]; if (!file) return; toast('Uploading…');
    try { const r = await api('/admin/upload', { raw: file, type: file.type, method: 'POST' }); f.elements[inp2.dataset.up].value = r.url; toast('Uploaded. Save to apply.'); } catch (e: any) { toast(e.message, 'err'); }
  });
}

async function crud(name: string, filter?: string, page = 1, q = '', status = '') {
  cats2 = cats;
  const R = RES[name];
  let rows: Row[], total = 0, pages = 1;
  if (name === 'courses') {
    const params = new URLSearchParams({ page: String(page) });
    if (q) params.set('q', q);
    if (status) params.set('status', status);
    const result = await api('/admin/courses?' + params);
    rows = result.items;
    total = result.total;
    pages = Math.max(result.pages, 1);
  } else {
    const courseQuery = filter ? `?course_id=${filter}` : '';
    rows = await api(`/admin/content/${name}${courseQuery}`);
    total = rows.length;
  }
  const title = ({courses:'Courses',categories:'Categories',facts:'Did you know',lessons:'Lessons'} as Record<string,string>)[name];
  main(`<div class="cms-page-head"><div><h1>${title}</h1>${name==='courses'?`<p class="cms-sub">${total} courses · learner activity and completion counts from the database</p>`:''}</div><button class="cms-btn primary" id="add">+ Add new</button></div>
  ${name==='courses'?`<div class="cms-filters-bar"><form id="course-search" class="cms-search-form"><input name="q" value="${esc(q)}" placeholder="Search courses…" class="cms-search-input"><select name="status" class="cms-filter-select" aria-label="Filter course publication status"><option value="" ${!status?'selected':''}>All statuses</option><option value="published" ${status==='published'?'selected':''}>Published</option><option value="draft" ${status==='draft'?'selected':''}>Draft</option></select><button class="cms-btn primary sm">Search</button>${q||status?'<a href="#/courses" class="cms-btn sm">Clear</a>':''}</form></div>`:''}
  <div class="cms-card"><div class="cms-table-wrap"><table class="cms-table"><thead><tr>${R.cols.map((c:any)=>`<th>${esc(({cover_url:'Cover',category_name:'Category',enrollment_count:'Enrolled',completion_count:'Completed',price_ghs:'GHS',price_ngn:'NGN',published:'Status'} as Record<string,string>)[c]||c)}</th>`).join('')}<th></th></tr></thead><tbody>
  ${rows.map((r:any)=>`<tr>${R.cols.map((c:any)=>`<td>${c==='cover_url'?(r.cover_url?`<img class="cms-course-thumb" src="${esc(r.cover_url)}" alt="">`:'—'):c==='price_ghs'?(r.price_ghs==null?'—':money(r.price_ghs,'GHS')):c==='price_ngn'?(r.price_ngn==null?'—':money(r.price_ngn,'NGN')):c==='published'?pill(r.published?'Published':'Draft',r.published?'green':'grey'):c==='enrollment_count'||c==='completion_count'?String(r[c]??0):esc(c==='active'||c==='preview'?(r[c]?'Yes':'No'):r[c])}</td>`).join('')}
  <td class="cms-actions"><button class="cms-btn sm" data-e="${r.id}">Edit</button>${R.lessons?`<button class="cms-btn sm" data-l="${r.id}">Lessons</button>`:''}<button class="cms-btn sm red" data-d="${r.id}" ${name==='courses'&&!r.safe_to_delete?'disabled title="Unpublish instead; this course has associated records"':''}>Delete</button></td></tr>`).join('')||`<tr><td colspan="${R.cols.length+1}" class="cms-empty">${q?'No courses match those filters.':'Nothing here yet.'}</td></tr>`}
  </tbody></table></div>${name==='courses'?`<div class="cms-pagination" aria-label="Course pages"><button class="cms-btn sm" id="courses-prev" ${page<=1?'disabled':''}>Previous</button><span>Page ${page} of ${pages}</span><button class="cms-btn sm" id="courses-next" ${page>=pages?'disabled':''}>Next</button></div>`:''}</div><div id="ed"></div>`);
  if (name === 'courses') {
    $('#course-search').onsubmit = (event: Event) => {
      event.preventDefault();
      const form = event.target as HTMLFormElement;
      const values = new FormData(form);
      crud(name, filter, 1, String(values.get('q') || ''), String(values.get('status') || ''));
    };
    $('#courses-prev').onclick = () => crud(name, filter, page - 1, q, status);
    $('#courses-next').onclick = () => crud(name, filter, page + 1, q, status);
  }
  const edit = (row: any) => {
    const v: Row = {...R.defaults,...(row||{})}; if (filter) v.course_id = filter;
    if (name==='courses'&&row) { v.price_ghs=row.price_ghs==null?'':row.price_ghs/100; v.price_ngn=row.price_ngn==null?'':row.price_ngn/100; }
    $('#ed').innerHTML = `<form id="ef" class="cms-card cms-form mt"><h2>${row?'Edit':'New'} ${title.toLowerCase().replace(/s$/,'')}</h2>${R.fields().map((f:any)=>inp(f,v[f[0]])).join('')}<p class="cms-err full"></p><div class="cms-form-foot"><button class="cms-btn primary" type="submit">Save</button><button class="cms-btn" type="button" id="cx">Cancel</button></div></form>`;
    wireUploads($('#ef')); $('#cx').onclick = () => { $('#ed').innerHTML=''; }; $('#ef').scrollIntoView({behavior:'smooth'});
    $('#ef').onsubmit = async (e: any) => { e.preventDefault(); const body=collect(e.target); if (filter) body.course_id=+filter; try { await api(`/admin/content/${name}${row?'/'+row.id:''}`,{method:row?'PUT':'POST',body}); toast('Saved.'); crud(name,filter,page,q,status); } catch (x:any) { $('.cms-err',e.target).textContent=x.message; } };
  };
  $('#add').onclick = () => edit(null);
  $$('[data-e]').forEach((b:any)=>b.onclick=()=>edit(rows.find((r:any)=>r.id==b.dataset.e)));
  $$('[data-l]').forEach((b:any)=>b.onclick=()=>{ location.hash='#/lessons/'+b.dataset.l; });
  $$('[data-d]').forEach((b:any)=>b.onclick=async()=>{ if (confirm('Delete? This cannot be undone.')) { try { await api(`/admin/content/${name}/${b.dataset.d}`,{method:'DELETE'}); toast('Deleted.'); crud(name,filter,page,q,status); } catch (error:any) { toast(error.message,'err'); } } });
}

// ── Router ─────────────────────────────────────────────────────────────────
const SCREENS: Record<string, (...args: any[]) => Promise<void>> = {
  overview: screenOverview,
  users: (q='',status='') => screenUsers(q, status),
  instructors: screenInstructors,
  enrollments: (cid='') => screenEnrollments(cid),
  certificates: screenCertificates,
  quizzes: (cid='') => screenQuizzes(cid),
  payments: screenPayments,
  withdrawals: screenWithdrawals,
  reviews: screenReviews,
  support: screenSupport,
  audit: screenAudit,
  pages: screenPages,
  settings: screenSettings,
  profile: screenProfile,
};
const SIMPLE: Record<string,number> = { courses:1, categories:1, facts:1 };

async function route() {
  const hash = location.hash.replace(/^#\//,'');
  const [path, queryString = ''] = hash.split('?');
  const [name, arg] = path.split('/');
  const routeQuery = new URLSearchParams(queryString);
  const n = name || 'overview';
  $$('.cms-nav-link').forEach((a:any) => a.classList.toggle('on', a.dataset.page === n || (n==='lessons' && a.dataset.page==='courses')));
  const pageTitle = $('#page-title');
  if (pageTitle) pageTitle.textContent = ({ overview:'Overview', users:'Learners', instructors:'Team & roles', courses:'Courses', categories:'Course categories', enrollments:'Enrollments', certificates:'Certificates', quizzes:'Quizzes', payments:'Payments', withdrawals:'Payouts & withdrawals', reviews:'Reviews & feedback', support:'Support', pages:'Website content', facts:'Website content', settings:'Settings', audit:'Audit logs', profile:'My profile' } as Record<string,string>)[n] || 'Admin';
  main('<div class="cms-skel"></div>');
  try {
    cats = await api('/categories');
    if (n==='lessons') { const c = await api('/courses/'+arg); await crud('lessons',arg); const h1 = $('#main h1'); if (h1) h1.innerHTML=`Lessons: ${esc(c.title)} <a class="cms-btn sm" href="#/courses">← Courses</a>`; }
    else if (SIMPLE[n]) await crud(n);
    else if (n === 'users') await screenUsers(routeQuery.get('q') || '', routeQuery.get('status') || '', routeQuery.get('role') || 'member', Number(routeQuery.get('page') || 1));
    else await (SCREENS[n] || SCREENS.overview)();
  } catch (e:any) { main(`<div class="cms-card"><h2>Error</h2><p class="cms-err">${esc(e.message)}</p></div>`); }
}

// ── Idle watcher ───────────────────────────────────────────────────────────
const IDLE_MS = 30 * 60 * 1000;
let idleTimer: ReturnType<typeof setTimeout>;
function resetIdle(fn: ()=>void) { clearTimeout(idleTimer); idleTimer = setTimeout(()=>{ toast('Session expired. Logging out…'); setTimeout(fn,2000); }, IDLE_MS); }
function startIdleWatcher(fn: ()=>void) { ['mousemove','keydown','click','scroll','touchstart'].forEach(e=>document.addEventListener(e,()=>resetIdle(fn),{passive:true})); resetIdle(fn); }

// ── Shell ──────────────────────────────────────────────────────────────────
let rootEl: HTMLElement;
export async function boot(el: HTMLElement) {
  rootEl = el;
  try { adminMe = await api('/me'); } catch { adminMe = null; }
  if (!adminMe || adminMe.role !== 'admin') { location.href = '/admin-login'; return; }

  const initials = (adminMe.full_name || adminMe.username || 'A')[0].toUpperCase();
  const avatarHtml = adminMe.avatar_url
    ? `<img src="${esc(adminMe.avatar_url)}" class="cms-topbar-av-img" alt="">`
    : `<span class="cms-topbar-av-init">${initials}</span>`;

  rootEl.innerHTML = `
<div id="cms-toast" class="cms-toast"></div>
<div class="cms-layout">
  <aside class="cms-sidebar" id="sidebar">
    <div class="cms-sidebar-brand">
      <span class="cms-sidebar-logo">S</span>
      <span class="cms-sidebar-brand-text"><span class="cms-sidebar-name">S Learning</span><small>ADMIN CONSOLE</small></span>
      <button class="cms-sidebar-close" id="sclose" aria-label="Close menu">✕</button>
    </div>
    <nav class="cms-nav" role="navigation" aria-label="Admin navigation">
      ${NAV.map(([group,items])=>`<section class="cms-nav-group" aria-label="${esc(group)}"><h2 class="cms-nav-group-title">${esc(group)}</h2>${items.map(([page,icon,label])=>`<a href="#/${page}" class="cms-nav-link" data-page="${page}"><span class="cms-nav-icon" aria-hidden="true">${icon}</span><span class="cms-nav-label">${label}</span></a>`).join('')}</section>`).join('')}
    </nav>
    <div class="cms-sidebar-foot">
      <a href="/" target="_blank" rel="noopener" class="cms-nav-link"><span class="cms-nav-icon" aria-hidden="true">🌐</span><span class="cms-nav-label">View site</span></a>
    </div>
  </aside>
  <button type="button" class="cms-sidebar-backdrop" id="sidebar-backdrop" aria-label="Close navigation"></button>
  <div class="cms-body">
    <header class="cms-topbar" role="banner">
      <button class="cms-burger" id="burger" aria-label="Toggle menu" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
      <div class="cms-topbar-heading"><span class="cms-topbar-context">S LEARNING</span><span class="cms-topbar-title" id="page-title">Admin</span></div>
      <form class="cms-global-search" id="admin-global-search" role="search">
        <input type="search" name="q" aria-label="Search learners by name, email, username, or member ID" placeholder="Search learners…">
        <button type="submit" aria-label="Search">⌕</button>
      </form>
      <div class="cms-topbar-right">
        <a href="#/profile" class="cms-topbar-profile" title="My profile">
          <span class="cms-topbar-av" aria-hidden="true">${avatarHtml}</span>
          <span class="cms-topbar-profile-copy"><b>${esc(adminMe.full_name || adminMe.username)}</b><small>Administrator</small></span>
        </a>
        <button class="cms-btn sm" id="lo">Sign out</button>
      </div>
    </header>
    <div class="cms-main" id="admin-main" tabindex="-1" role="region" aria-label="Admin content"></div>
  </div>
</div>`;

  const doLogout = async () => { await api('/auth/logout',{method:'POST',body:{}}).catch(()=>{}); window.location.href='/admin-login'; };
  $('#lo').onclick = async (e: Event) => { e.preventDefault(); await doLogout(); };
  $('#admin-global-search').onsubmit = (event: Event) => {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const query = String(new FormData(form).get('q') || '').trim();
    const hash = query ? '#/users?' + new URLSearchParams({ q: query }).toString() : '#/users';
    if (location.hash === hash) route();
    else location.hash = hash;
  };
  const burger = $('#burger'), sidebar = $('#sidebar');
  const closeSidebar = () => {
    sidebar.classList.remove('open');
    burger.setAttribute('aria-expanded','false');
  };
  burger.onclick = () => {
    const open = sidebar.classList.toggle('open');
    burger.setAttribute('aria-expanded', String(open));
    $('#sidebar-backdrop').classList.toggle('open', open);
  };
  $('#sclose').onclick = closeSidebar;
  $('#sidebar-backdrop').onclick = closeSidebar;
  // Close sidebar on nav click (mobile)
  $$('.cms-nav-link').forEach((a: any) => a.addEventListener('click', () => {
    if (window.innerWidth < 900) {
      closeSidebar();
      $('#sidebar-backdrop').classList.remove('open');
    }
  }));
  startIdleWatcher(doLogout);
  window.addEventListener('hashchange', route);
  route();
}
