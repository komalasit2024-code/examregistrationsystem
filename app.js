const COLLEGE = 'ABC College of Engineering & Technology';
const $ = id => document.getElementById(id);
const token = () => localStorage.getItem('token');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtD = d => d ? new Date(d + 'T00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

async function api(path, method = 'GET', body) {
  const r = await fetch('/api' + path, {
    method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (token() || '') },
    body: body ? JSON.stringify(body) : undefined
  });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && !path.endsWith('/login')) { logout(); throw new Error('Session expired'); }
  if (!r.ok) throw new Error(d.error || 'Request failed');
  return d;
}
function logout() {
  const role = localStorage.getItem('role'); localStorage.clear();
  location.href = role === 'admin' ? 'admin-login.html' : 'student-login.html';
}
function toast(m, t = 'ok') {
  let b = $('toast'); if (!b) { b = document.createElement('div'); b.id = 'toast'; document.body.appendChild(b); }
  b.className = 'toast ' + t + ' show'; b.textContent = m;
  clearTimeout(b._t); b._t = setTimeout(() => b.className = 'toast', 3500);
}
function badge(s) {
  const c = { Approved: 'g', Verified: 'g', Paid: 'b', Submitted: 'b', Rejected: 'r' }[s] || 'y';
  return `<span class="badge ${c}">${esc(s)}</span>`;
}
function table(h, rows) {
  return `<div class="tw"><table><thead><tr>${h.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.join('') : `<tr><td colspan="${h.length}" class="empty">No records found</td></tr>`}</tbody></table></div>`;
}
const btn = (a, id, label, cls = '') => `<button class="btn sm ${cls}" data-a="${a}" data-id="${id}">${label}</button>`;
function actions(el, map) {
  el.addEventListener('click', async e => {
    const t = e.target.closest('[data-a]'); if (!t) return;
    try { await map[t.dataset.a](t.dataset.id, t); } catch (er) { toast(er.message, 'err'); }
  });
}
function stage(r) {
  if (!r) return 'Not Registered';
  if (r.status === 'Rejected') return 'Registration Rejected';
  if (r.hall_ticket) return 'Hall Ticket Generated';
  if (r.status === 'Approved') return 'Admin Verified';
  if (r.payment && ['Paid', 'Verified'].includes(r.payment.status)) return 'Payment Completed';
  return 'Registration Submitted';
}
function showInfo(title, html) {
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div class="box wide"><h3>${esc(title)}</h3>${html}<div class="row" style="margin-top:14px"><button class="btn alt">Close</button></div></div>`;
  m.querySelector('button').onclick = () => m.remove(); document.body.appendChild(m);
}
function openForm(title, fields, vals, onSubmit) {
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<form class="box" novalidate><h3>${esc(title)}</h3>${fields.map(f => `<label>${f.label}${f.type === 'select'
    ? `<select name="${f.name}">${f.options.map(o => `<option value="${esc(o[0])}">${esc(o[1])}</option>`).join('')}</select>`
    : `<input name="${f.name}" type="${f.type || 'text'}" ${f.ph ? `placeholder="${f.ph}"` : ''}>`}</label>`).join('')}
    <div class="err"></div><div class="row"><button class="btn">Save</button><button type="button" class="btn alt" id="x">Cancel</button></div></form>`;
  document.body.appendChild(m);
  const form = m.querySelector('form'), err = form.querySelector('.err');
  fields.forEach(f => { if (vals && vals[f.name] != null) form.elements[f.name].value = vals[f.name]; });
  form.querySelector('#x').onclick = () => m.remove();
  form.onsubmit = async e => {
    e.preventDefault(); const d = {};
    for (const f of fields) {
      d[f.name] = form.elements[f.name].value.trim();
      if (f.required && !d[f.name]) { err.textContent = f.label.replace(' *', '') + ' is required'; return; }
    }
    try { await onSubmit(d); m.remove(); } catch (er) { err.textContent = er.message; }
  };
}
function initPage(role, title) {
  if (!token() || localStorage.getItem('role') !== role) { location.href = role === 'admin' ? 'admin-login.html' : 'student-login.html'; return null; }
  const M = role === 'admin'
    ? [['admin-dashboard', 'Dashboard'], ['students', 'Students'], ['subjects', 'Subjects'], ['exam-schedule', 'Exam Schedule'], ['registrations', 'Registrations'], ['payments', 'Payments'], ['reports', 'Reports']]
    : [['student-dashboard', 'Dashboard'], ['exam-registration', 'Exam Registration'], ['payment', 'Payment'], ['registration-status', 'Registration Status'], ['hall-ticket', 'Hall Ticket']];
  const cur = location.pathname.split('/').pop().replace('.html', '');
  document.title = title + ' | Exam Registration';
  $('app').innerHTML = `<header class="nav"><button id="mb">☰</button><div class="brand"><span class="logo">LOGO</span><b>${COLLEGE}</b></div>
    <div class="who"><span>${esc(localStorage.getItem('name'))}</span><button class="btn sm alt" id="lo">Logout</button></div></header>
    <div class="layout"><aside id="side">${M.map(m => `<a href="${m[0]}.html" class="${m[0] === cur ? 'on' : ''}">${m[1]}</a>`).join('')}</aside>
    <main><h2>${title}</h2><div id="body"></div></main></div>`;
  $('mb').onclick = () => $('side').classList.toggle('open');
  $('lo').onclick = logout;
  return $('body');
}
function setupLogin(role) {
  const home = role === 'admin' ? 'admin-dashboard.html' : 'student-dashboard.html';
  if (token() && localStorage.getItem('role') === role) { location.href = home; return; }
  $('f').onsubmit = async e => {
    e.preventDefault();
    const u = $('u').value.trim(), p = $('p').value, m = $('msg'); m.textContent = '';
    if (role === 'student' && !/^\d{6,12}$/.test(u)) return m.textContent = 'Register number must be 6-12 digits';
    if (role === 'admin' && !u) return m.textContent = 'Username is required';
    if (p.length < 6) return m.textContent = 'Password must be at least 6 characters';
    try {
      const d = await api(`/${role}/login`, 'POST', role === 'admin' ? { username: u, password: p } : { register_no: u, password: p });
      localStorage.setItem('token', d.token); localStorage.setItem('role', role); localStorage.setItem('name', d.name);
      location.href = home;
    } catch (er) { m.textContent = er.message; }
  };
}
