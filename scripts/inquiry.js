(() => {
  const form = document.querySelector('#inquiry');
  if (!form) return;
  const status = document.querySelector('#status');
  const button = form.querySelector('button[type="submit"]');
  let widget, ready = false, payloadSignature, requestId;
  const unavailable = 'Online inquiries are temporarily unavailable. Your inquiry has not been sent. Please try again later.';
  fetch('/api/inquiry', { cache: 'no-store' }).then(async response => {
    const config = await response.json();
    if (!response.ok || config.ready !== true || !config.siteKey) throw new Error('unavailable');
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.onload = () => { widget = window.turnstile.render('#inquiry-verification', { sitekey: config.siteKey, action: 'inquiry' }); ready = true; };
    script.onerror = () => { status.textContent = 'Verification could not load. Please reload this page.'; };
    document.head.appendChild(script);
  }).catch(() => { status.textContent = unavailable; });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (button.disabled || !form.reportValidity()) return;
    if (!ready) { status.textContent = unavailable; return; }
    const token = window.turnstile.getResponse(widget);
    if (!token) { status.textContent = 'Please complete verification before submitting.'; return; }
    const data = Object.fromEntries(new FormData(form).entries());
    delete data['cf-turnstile-response'];
    const signature = JSON.stringify(data);
    if (signature !== payloadSignature) { payloadSignature = signature; requestId = crypto.randomUUID(); }
    button.disabled = true; button.textContent = 'Submitting…'; form.setAttribute('aria-busy', 'true'); status.textContent = 'Submitting your inquiry…';
    try {
      const response = await fetch('/api/inquiry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, token, requestId }), signal: AbortSignal.timeout(25000) });
      const result = await response.json();
      if (!response.ok || result.ok !== true || !result.reference) throw new Error(result.message || 'Your inquiry could not be sent. Please try again.');
      status.textContent = result.message; form.reset(); payloadSignature = undefined; requestId = undefined;
    } catch (error) {
      status.textContent = error.name === 'TimeoutError' || error.name === 'AbortError' ? 'We could not confirm sending. Keep this page open and try again.' : error.message || 'Your inquiry could not be sent. Please try again.';
    } finally { window.turnstile.reset(widget); button.disabled = false; button.textContent = 'Submit inquiry →'; form.removeAttribute('aria-busy'); }
  });
})();
