const $ = (id) => document.getElementById(id);
const post = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  .then(async (r) => ({ ok: r.ok, d: await r.json().catch(() => ({})) }));
const swap = (toAct) => { $('f').hidden = toAct; $('act').hidden = !toAct; };

$('toAct').onclick = (e) => { e.preventDefault(); $('ae').value = $('u').value; swap(true); };
$('toLogin').onclick = (e) => { e.preventDefault(); swap(false); };

$('f').addEventListener('submit', async (e) => {
  e.preventDefault(); $('err').textContent = '';
  const { ok, d } = await post('/api/login', { email: $('u').value, password: $('p').value });
  if (ok) return (location.href = '/dashboard');
  $('err').textContent = d.error || 'حدث خطأ';
  if (d.code === 'not_activated') { $('ae').value = $('u').value; swap(true); $('amsg').textContent = d.error; }
});

$('send').onclick = async () => {
  const m = $('amsg'); m.style.color = '#14161a'; m.textContent = 'جارٍ الإرسال...';
  const { ok, d } = await post('/api/auth/request-code', { email: $('ae').value });
  if (!ok) { m.style.color = '#C8102E'; m.textContent = d.error || 'حدث خطأ'; return; }
  m.style.color = '#0B6B3A'; m.textContent = 'إن كان البريد مسموحًا فسيصلك رمز خلال دقيقة (افحص Spam أيضًا).';
  $('step2').hidden = false; $('ac').focus();
};

$('act').addEventListener('submit', async (e) => {
  e.preventDefault();
  const m = $('amsg'); m.style.color = '#C8102E';
  const { ok, d } = await post('/api/auth/activate', { email: $('ae').value, code: $('ac').value, password: $('ap').value });
  if (ok) return (location.href = '/dashboard');
  m.textContent = d.error || 'حدث خطأ';
});
