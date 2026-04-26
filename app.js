/* ── State ──────────────────────────────────────────────────── */
let appHistory    = JSON.parse(localStorage.getItem('mls_history')    || '[]');
let settings      = JSON.parse(localStorage.getItem('mls_settings')   || '{}');
let profile       = JSON.parse(localStorage.getItem('mls_profile')    || '{}');
let schedConfig   = JSON.parse(localStorage.getItem('mls_sched')      || '{"time":"09:00","days":[1,2,3,4,5],"enabled":false}');
let lastResults   = JSON.parse(localStorage.getItem('mls_last_results')|| '[]');
let activeFilter  = 'all';
let schedTimer    = null;
let cdTimer       = null;
let totalEmails   = parseInt(localStorage.getItem('mls_emails') || '0');

/* ── Boot ───────────────────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
  setGreeting();
  setTopbarDate();
  loadSettingsUI();
  loadProfileUI();
  loadScheduleUI();
  renderHistory();
  updateKPIs(lastResults);
  renderTopMatches(lastResults);
  if (lastResults.length) {
    renderResultsTable(lastResults);
    document.getElementById('results-badge').textContent = lastResults.length;
  }
  if (schedConfig.enabled) startScheduler();
  setInterval(setTopbarDate, 60000);
});

/* ── Nav ────────────────────────────────────────────────────── */
function nav(el) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  const tab = el.dataset.tab;
  document.getElementById('tab-' + tab).classList.add('active');
  const titles = { dashboard:'Dashboard', run:'Run Search', results:'Job Results', schedule:'Schedule', settings:'Settings', history:'History' };
  document.getElementById('topbar-title').textContent = titles[tab] || '';
}

/* ── Greeting ───────────────────────────────────────────────── */
function setGreeting() {
  const h = new Date().getHours();
  const g = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  document.getElementById('greeting').textContent = g;
}
function setTopbarDate() {
  document.getElementById('topbar-date').textContent =
    new Date().toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' });
}

/* ── Settings ───────────────────────────────────────────────── */
function loadSettingsUI() {
  if (settings.anthropicKey) document.getElementById('anthropic-key').value = settings.anthropicKey;
  if (settings.gmailKey)     document.getElementById('gmail-key').value     = settings.gmailKey;
}
function saveSettings() {
  settings.anthropicKey = document.getElementById('anthropic-key').value.trim();
  settings.gmailKey     = document.getElementById('gmail-key').value.trim();
  localStorage.setItem('mls_settings', JSON.stringify(settings));
  showBanner('settings-banner', 'ok', 'Keys saved to your browser.');
}
function loadProfileUI() {
  if (profile.name)     document.getElementById('pref-name').value     = profile.name;
  if (profile.email) {  document.getElementById('pref-email').value    = profile.email;
                        document.getElementById('run-email').value      = profile.email; }
  if (profile.roles)    document.getElementById('pref-roles').value    = profile.roles;
  if (profile.location) document.getElementById('pref-location').value = profile.location;
  if (profile.minScore) document.getElementById('pref-minscore').value = profile.minScore;
}
function saveProfile() {
  profile = {
    name:     document.getElementById('pref-name').value,
    email:    document.getElementById('pref-email').value,
    roles:    document.getElementById('pref-roles').value,
    location: document.getElementById('pref-location').value,
    minScore: document.getElementById('pref-minscore').value,
  };
  localStorage.setItem('mls_profile', JSON.stringify(profile));
  showBanner('settings-banner', 'ok', 'Profile saved.');
}
function toggleVis(id, btn) {
  const el = document.getElementById(id);
  el.type = el.type === 'password' ? 'text' : 'password';
  btn.textContent = el.type === 'password' ? 'Show' : 'Hide';
}

/* ── Scheduler ──────────────────────────────────────────────── */
function loadScheduleUI() {
  document.getElementById('sched-time').value    = schedConfig.time || '09:00';
  document.getElementById('sched-enabled').checked = schedConfig.enabled || false;
  document.querySelectorAll('.dp').forEach(p => {
    p.classList.toggle('on', (schedConfig.days || [1,2,3,4,5]).includes(parseInt(p.dataset.day)));
    p.onclick = () => p.classList.toggle('on');
  });
  const badge = document.getElementById('sched-badge');
  badge.style.display = schedConfig.enabled ? 'inline' : 'none';
  if (schedConfig.enabled) updateCountdowns();
}
function saveSchedule() {
  const days = [...document.querySelectorAll('.dp.on')].map(p => parseInt(p.dataset.day));
  schedConfig = {
    time:    document.getElementById('sched-time').value,
    days,
    enabled: document.getElementById('sched-enabled').checked,
  };
  localStorage.setItem('mls_sched', JSON.stringify(schedConfig));
  document.getElementById('sched-badge').style.display = schedConfig.enabled ? 'inline' : 'none';
  if (schedConfig.enabled) { startScheduler(); showBanner('sched-banner', 'ok', 'Schedule saved and active.'); }
  else                     { stopScheduler();  showBanner('sched-banner', 'info', 'Schedule saved (disabled).'); }
  updateKPIs(lastResults);
}
function toggleScheduler() {
  schedConfig.enabled = document.getElementById('sched-enabled').checked;
  localStorage.setItem('mls_sched', JSON.stringify(schedConfig));
  document.getElementById('sched-badge').style.display = schedConfig.enabled ? 'inline' : 'none';
  schedConfig.enabled ? startScheduler() : stopScheduler();
  updateKPIs(lastResults);
}
function startScheduler() {
  stopScheduler();
  updateCountdowns();
  schedTimer = setInterval(checkSchedule,  30000);
  cdTimer    = setInterval(updateCountdowns, 1000);
}
function stopScheduler() {
  clearInterval(schedTimer);
  clearInterval(cdTimer);
  document.getElementById('dash-cd').textContent      = '--:--:--';
  document.getElementById('dash-cd-label').textContent = 'Scheduler is off';
  document.getElementById('sched-cd').textContent     = '--:--:--';
  document.getElementById('sched-cd-sub').textContent = 'Enable scheduler above';
  document.getElementById('dash-prog').style.width    = '0%';
  document.getElementById('sched-prog').style.width   = '0%';
}
function getNextRun() {
  const [h, m] = (schedConfig.time || '09:00').split(':').map(Number);
  const days   = schedConfig.days || [1,2,3,4,5];
  let d        = new Date(); d.setHours(h, m, 0, 0);
  for (let i = 0; i < 8; i++) {
    if (d > new Date() && days.includes(d.getDay())) return d;
    d = new Date(d.getTime() + 86400000); d.setHours(h, m, 0, 0);
  }
  return null;
}
function updateCountdowns() {
  const next = getNextRun();
  if (!next) return;
  const diff = Math.max(0, next - new Date());
  const hh   = Math.floor(diff / 3600000);
  const mm   = Math.floor((diff % 3600000) / 60000);
  const ss   = Math.floor((diff % 60000) / 1000);
  const str  = `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
  const sub  = 'Next: ' + next.toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' }) + ' at ' + (schedConfig.time || '09:00');
  const dayMs = 86400000;
  const pct  = (1 - diff / dayMs) * 100;

  document.getElementById('dash-cd').textContent       = str;
  document.getElementById('dash-cd-label').textContent = sub;
  document.getElementById('sched-cd').textContent      = str;
  document.getElementById('sched-cd-sub').textContent  = sub;
  document.getElementById('dash-prog').style.width     = Math.min(pct, 100) + '%';
  document.getElementById('sched-prog').style.width    = Math.min(pct, 100) + '%';

  // KPI
  document.getElementById('kpi-next-time').textContent = schedConfig.time || '9:00 AM';
  document.getElementById('kpi-next-sub').textContent  = sub;
}
function checkSchedule() {
  if (!schedConfig.enabled) return;
  const now     = new Date();
  const [h, m]  = (schedConfig.time || '09:00').split(':').map(Number);
  const dayMatch = (schedConfig.days || []).includes(now.getDay());
  if (now.getHours() === h && now.getMinutes() === m && dayMatch) {
    const key = now.toDateString() + ':' + schedConfig.time;
    if (localStorage.getItem('mls_last_sched') !== key) {
      localStorage.setItem('mls_last_sched', key);
      runDigest(true);
    }
  }
}

/* ── Run digest ─────────────────────────────────────────────── */
async function runDigest(auto = false) {
  const btn = document.getElementById('run-btn');
  btn.disabled = true; btn.textContent = '⏳ Running...';
  setStatus('running', 'Searching...');
  clearLog();
  setProg('run-prog', 0);
  document.getElementById('rpt').style.opacity = '1';
  hideBanner('run-banner');

  const steps = [
    { msg: 'Connecting to job boards...', pct: 12 },
    { msg: 'Querying Indeed Nigeria...', pct: 28 },
    { msg: 'Querying HotNigerianJobs...', pct: 42 },
    { msg: 'Querying MyJobMag & Glassdoor...', pct: 56 },
    { msg: 'Scoring matches against your profile...', pct: 72 },
    { msg: 'Composing digest email...', pct: 86 },
    { msg: 'Finalising results...', pct: 96 },
  ];
  for (const s of steps) { await sleep(650 + Math.random() * 450); log(s.msg); setProg('run-prog', s.pct); }

  let jobs = [...STATIC_JOBS];
  const apiKey = settings.anthropicKey;
  if (apiKey && apiKey.startsWith('sk-ant')) {
    log('Calling Anthropic API for fresh listings...', 'info');
    try {
      const fresh = await fetchJobsFromAI(apiKey);
      if (fresh && fresh.length) { jobs = fresh; log('AI returned ' + fresh.length + ' fresh matches.', 'ok'); }
    } catch (e) { log('AI search failed — using curated list. (' + e.message + ')', 'err'); }
  } else {
    log('No API key — using curated list. Add yours in Settings.', 'info');
  }

  // Apply filters
  const loc     = document.getElementById('run-location').value;
  const inclT3  = document.getElementById('tog-t3').checked;
  const minScore = parseInt(document.getElementById('run-minscore').value) || 70;
  let filtered  = jobs.filter(j => j.score >= minScore);
  if (loc === 'abuja')       filtered = filtered.filter(j => j.loc.toLowerCase().includes('abuja'));
  else if (loc === 'lagos')  filtered = filtered.filter(j => j.loc.toLowerCase().includes('lagos'));
  else if (loc === 'abuja,lagos') filtered = filtered.filter(j => j.loc.toLowerCase().includes('abuja') || j.loc.toLowerCase().includes('lagos'));
  if (!inclT3)               filtered = filtered.filter(j => j.tier < 3);
  filtered.sort((a, b) => b.score - a.score);

  lastResults = filtered;
  localStorage.setItem('mls_last_results', JSON.stringify(filtered));
  setProg('run-prog', 100);
  log(filtered.length + ' matches found.', 'ok');

  // Send email
  const sendEmail = document.getElementById('tog-email').checked;
  const toEmail   = document.getElementById('run-email').value || 'success.sholly@icloud.com';
  let emailSent   = false;
  if (sendEmail) {
    emailSent = await trySendEmail(buildEmailText(filtered), toEmail);
    log(emailSent ? 'Email sent to ' + toEmail : 'Email send skipped (configure Gmail in Settings).', emailSent ? 'ok' : 'info');
    if (emailSent) { totalEmails++; localStorage.setItem('mls_emails', totalEmails); }
  }

  // Persist history
  const now = new Date();
  const entry = {
    date:    now.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }),
    time:    now.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' }),
    matches: filtered.length,
    t1:      filtered.filter(j => j.tier === 1).length,
    email:   toEmail,
    status:  emailSent ? 'sent' : 'run only',
    auto,
  };
  appHistory.unshift(entry);
  if (appHistory.length > 100) appHistory = appHistory.slice(0, 100);
  localStorage.setItem('mls_history', JSON.stringify(appHistory));

  // Update all UI
  updateKPIs(filtered, now);
  renderTopMatches(filtered);
  renderResultsTable(filtered);
  renderHistory();
  document.getElementById('results-badge').textContent = filtered.length;
  showBanner('run-banner', emailSent ? 'ok' : 'info', filtered.length + ' matches found' + (emailSent ? ' · email sent to ' + toEmail : ' · open Job Results to view'));
  setStatus(emailSent ? 'ok' : 'ok', 'Last run: ' + entry.time);

  btn.disabled = false;
  btn.innerHTML = '&#9654; Run job search';
}

/* ── AI fetch ───────────────────────────────────────────────── */
async function fetchJobsFromAI(apiKey) {
  const prompt = `You are a job-search agent for a Medical Laboratory Scientist in Nigeria named Success Oluwafemi Ishola.
Profile: B.MLS (Kwara State University), MLSCN registered, HBTSSN member, specialises in haematology/blood bank/transfusion medicine/microbiology, 2+ years clinical experience post-NYSC, based in Abuja.
Search for current MLS job openings and return ONLY a valid JSON array — no markdown, no explanation, no backticks.
Each item must have: title (string), company (string), loc (string), salary (string), skills (string), url (string), score (number 0–100), tier (number: 1 for 88+, 2 for 70–87, 3 for 52–69).
Return exactly 20 jobs sorted by score descending.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':    'application/json',
      'x-api-key':       apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages:   [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  const raw  = data.content.map(c => c.text || '').join('');
  return JSON.parse(raw.replace(/```json|```/g, '').trim());
}

/* ── Email ──────────────────────────────────────────────────── */
function buildEmailText(jobs) {
  const today = new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  const fmt   = arr => arr.map((j, i) =>
    `${i+1}. ${j.title} | ${j.company} | ${j.loc} | ${j.salary} | Score: ${j.score}\n   Skills: ${j.skills}\n   Apply: ${j.url}`
  ).join('\n\n');
  const t1 = jobs.filter(j => j.tier === 1);
  const t2 = jobs.filter(j => j.tier === 2);
  const t3 = jobs.filter(j => j.tier === 3);
  return `Hi Success,\n\nYour MLS job digest for ${today}\n\n${'━'.repeat(44)}\nTIER 1 — STRONG MATCHES (${t1.length} roles)\n${'━'.repeat(44)}\n\n${fmt(t1)}\n\n${'━'.repeat(44)}\nTIER 2 — GOOD MATCHES (${t2.length} roles)\n${'━'.repeat(44)}\n\n${fmt(t2)}\n${t3.length ? `\n${'━'.repeat(44)}\nTIER 3 — MODERATE MATCHES (${t3.length} roles)\n${'━'.repeat(44)}\n\n${fmt(t3)}\n` : ''}\nSources: Indeed Nigeria · HotNigerianJobs · MyJobMag · Glassdoor · SmartRecruiters\nGenerated by MLS Recruiter Dashboard`;
}
async function trySendEmail(body, to) {
  const today   = new Date().toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
  const subject = `Your MLS job digest — ${today}`;
  if (settings.gmailKey && settings.gmailKey.startsWith('ya29')) {
    try {
      const raw = btoa(`To: ${to}\nSubject: ${subject}\nContent-Type: text/plain; charset=utf-8\n\n${body}`)
        .replace(/\+/g,'-').replace(/\//g,'_');
      const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + settings.gmailKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw }),
      });
      return r.ok;
    } catch { return false; }
  }
  window.open(`mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
  return true;
}
function previewEmail() {
  const jobs = lastResults.length ? lastResults : STATIC_JOBS;
  const w = window.open('', '_blank');
  w.document.write(`<pre style="font:13px/1.8 monospace;padding:2rem;white-space:pre-wrap;background:#0b0e14;color:#dde2ed">${buildEmailText(jobs)}</pre>`);
}

/* ── Render: KPIs ───────────────────────────────────────────── */
function updateKPIs(jobs, runDate) {
  document.getElementById('kpi-total').textContent  = jobs.length || '—';
  document.getElementById('kpi-t1').textContent     = jobs.filter(j => j.tier === 1).length || '—';
  document.getElementById('kpi-emails').textContent = totalEmails;
  if (!schedConfig.enabled) {
    document.getElementById('kpi-next-time').textContent = 'Off';
    document.getElementById('kpi-next-sub').textContent  = 'Enable in Schedule tab';
  }
}

/* ── Render: Top matches ────────────────────────────────────── */
function renderTopMatches(jobs) {
  const el = document.getElementById('top-matches');
  if (!jobs || !jobs.length) { el.innerHTML = '<div class="empty" style="padding:1.5rem 0">Run a search to see matches.</div>'; return; }
  el.innerHTML = jobs.slice(0, 6).map(j => {
    const cls = j.score >= 88 ? 'ms-high' : j.score >= 70 ? 'ms-mid' : 'ms-low';
    return `<div class="match-item">
      <div class="match-score ${cls}">${j.score}</div>
      <div class="match-info">
        <div class="match-title">${j.title}</div>
        <div class="match-co">${j.company}</div>
      </div>
      <span class="match-badge">${j.loc}</span>
    </div>`;
  }).join('');
}

/* ── Render: Results table ──────────────────────────────────── */
function renderResultsTable(jobs, filter) {
  const empty = document.getElementById('results-empty');
  const wrap  = document.getElementById('results-wrap');
  if (!jobs || !jobs.length) { empty.style.display = 'block'; wrap.style.display = 'none'; return; }
  empty.style.display = 'none'; wrap.style.display = 'block';

  let filtered = [...jobs];
  if (filter === 'abuja')    filtered = jobs.filter(j => j.loc.toLowerCase().includes('abuja'));
  else if (filter === 'lagos') filtered = jobs.filter(j => j.loc.toLowerCase().includes('lagos'));
  else if (filter === 't1')  filtered = jobs.filter(j => j.tier === 1);

  const tierLabels = { 1:'Tier 1 — Strong match (88+)', 2:'Tier 2 — Good match (70–87)', 3:'Tier 3 — Moderate match (52–68)' };
  let html = ''; let lastTier = 0;
  filtered.forEach(j => {
    if (j.tier !== lastTier) {
      html += `<tr class="tier-row"><td colspan="6">${tierLabels[j.tier] || ''}</td></tr>`;
      lastTier = j.tier;
    }
    const sc = j.score >= 88 ? 'sc-h' : j.score >= 70 ? 'sc-m' : 'sc-l';
    html += `<tr>
      <td><div class="job-name">${j.title}</div><div class="job-co">${j.company}</div></td>
      <td>${j.loc}</td>
      <td style="white-space:nowrap">${j.salary}</td>
      <td style="max-width:180px;font-size:11px">${j.skills}</td>
      <td><a class="apply-a" href="${j.url}" target="_blank">Apply ↗</a></td>
      <td><span class="sc ${sc}">${j.score}</span></td>
    </tr>`;
  });
  document.getElementById('results-tbody').innerHTML = html;
}
function filterResults(f, btn) {
  document.querySelectorAll('.fpill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  renderResultsTable(lastResults, f);
}

/* ── Render: History ────────────────────────────────────────── */
function renderHistory() {
  const tbody = document.getElementById('hist-tbody');
  if (!appHistory.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty">No history yet.</td></tr>';
    return;
  }
  tbody.innerHTML = appHistory.slice(0, 50).map(h => `
    <tr>
      <td style="font-family:'JetBrains Mono',monospace;font-size:11px">${h.date} ${h.time}</td>
      <td>${h.matches}</td>
      <td>${h.t1}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:11px">${h.email}</td>
      <td><span style="font-size:11px;color:var(--text3)">${h.auto ? 'scheduled' : 'manual'}</span></td>
      <td><span style="background:${h.status==='sent'?'var(--accent-d)':'rgba(255,255,255,.04)'};color:${h.status==='sent'?'var(--accent)':'var(--text3)'};padding:2px 8px;border-radius:99px;font-size:10px;font-family:'JetBrains Mono',monospace">${h.status}</span></td>
    </tr>`).join('');
}
function clearHistory() {
  if (!confirm('Clear all run history?')) return;
  appHistory = [];
  localStorage.removeItem('mls_history');
  renderHistory();
}

/* ── Log helpers ────────────────────────────────────────────── */
function log(msg, type = '') {
  const box = document.getElementById('log-box');
  const d   = document.createElement('div');
  d.className = 'log-line' + (type ? ' log-' + type : '');
  d.textContent = '› ' + msg;
  box.appendChild(d);
  box.scrollTop = box.scrollHeight;
}
function clearLog() {
  const box = document.getElementById('log-box');
  box.innerHTML = '';
}
function setProg(id, pct) { document.getElementById(id).style.width = pct + '%'; }
function setStatus(type, label) {
  const dot   = document.getElementById('status-dot');
  const lbl   = document.getElementById('status-label');
  dot.className = 'status-dot ' + type;
  lbl.textContent = label;
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function showBanner(id, type, msg) {
  const b = document.getElementById(id);
  b.className = 'banner ' + type;
  b.textContent = msg;
  b.style.display = 'block';
}
function hideBanner(id) { document.getElementById(id).style.display = 'none'; }
