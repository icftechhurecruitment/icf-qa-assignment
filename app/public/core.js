(() => {
    'use strict';
    const params = new URLSearchParams(location.search);
    const rnd = () => Math.random().toString(36).slice(2, 10);
  
    // ----- session (per browser profile) -----
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('cs.session') || '{}'); } catch { /* ignore */ }
    const seedParam = params.get('seed'); // reviewer/debug use: stable catalog, order, promo timing
    const session = {
      id: saved.id || rnd() + rnd(),
      seed: seedParam || saved.seed || String(Math.floor(Math.random() * 1e9)),
    };
    localStorage.setItem('cs.session', JSON.stringify(session));
  
    // ----- helpers -----
    function h(tag, props = {}, ...kids) {
      const el = document.createElement(tag);
      for (const [k, v] of Object.entries(props || {})) {
        if (v == null || v === false) continue;
        if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'class') el.className = v;
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      }
      for (const kid of kids.flat()) {
        if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
      }
      return el;
    }
    const money = (cents) => '$' + (cents / 100).toFixed(2);
  
    async function api(path, body) {
      const res = await fetch(path, {
        method: body ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json', 'X-Session': session.id },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    }
  
    // ----- state & rendering -----
    const state = { user: null, balanceCents: 0, subs: [], creators: null, promoDelayMs: 6000 };
    let refs = null;
    let promoStarted = false;
    const stack = [];
  
    function render() {
      refs.header.replaceChildren(View.header(state, actions));
      refs.creators.replaceChildren(View.creators(state, actions));
      refs.subs.replaceChildren(View.subs(state, actions));
    }
    function applyMe(d) {
      state.user = d.user || null;
      state.balanceCents = d.balanceCents || 0;
      state.subs = d.subscriptions || [];
    }
  
    // ----- toasts (auto-dismiss after 4s) -----
    function toast(kind, message) {
      const el = View.toast(kind, message);
      refs.toasts.append(el);
      setTimeout(() => el.remove(), 4000);
    }
  
    // ----- dialogs (stackable). The element returned by View.dialog is the backdrop. -----
    function openDialog(kind, props = {}) {
      closeDialog(kind);
      const el = View.dialog(kind, props, actions);
      el.addEventListener('mousedown', (e) => { if (e.target === el && kind !== 'age') closeDialog(kind); });
      document.body.append(el);
      stack.push({ kind, el });
      document.body.classList.add('modal-open');
      (el.querySelector('input, button') || el).focus();
    }
    function closeDialog(kind) {
      const i = stack.findIndex((d) => d.kind === kind);
      if (i === -1) return;
      stack[i].el.remove();
      stack.splice(i, 1);
      document.body.classList.toggle('modal-open', stack.length > 0);
    }
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !stack.length) return;
      const top = stack[stack.length - 1];
      if (top.kind !== 'age') closeDialog(top.kind);
    });
  
    function startPromoTimer() {
      if (promoStarted) return;
      promoStarted = true;
      setTimeout(() => openDialog('promo'), state.promoDelayMs);
    }
  
    // ----- actions used by the view -----
    const actions = {
      closeDialog,
      confirmAge() { localStorage.setItem('cs.ageOk', '1'); closeDialog('age'); startPromoTimer(); },
      leave() { location.href = 'about:blank'; },
      openSignup: () => openDialog('signup'),
      openTopup: () => openDialog('topup'),
      openPlans: (creator) =>
        openDialog('plans', { creator, subscribed: state.subs.some((s) => s.creatorId === creator.id) }),
  
      async signUp(email, password) {
        const r = await api('/api/signup', { email, password });
        if (!r.ok) return { ok: false, errors: r.data.errors || { form: 'Something went wrong.' } };
        state.user = r.data.user;
        state.balanceCents = r.data.balanceCents;
        state.subs = [];
        closeDialog('signup');
        render();
        toast('success', `Welcome! Your starting balance is ${money(r.data.balanceCents)}.`);
        return { ok: true };
      },
  
      async topUp(raw) {
        const n = Number(String(raw).replace(',', '.'));
        if (!raw || !Number.isFinite(n)) return { ok: false, error: 'Enter a valid amount.' };
        const r = await api('/api/topup', { amountCents: Math.round(n * 100) });
        if (!r.ok) return { ok: false, error: r.data.error || 'Top-up failed.' };
        state.balanceCents = r.data.balanceCents;
        closeDialog('topup');
        render();
        toast('success', `Added ${money(r.data.amountCents)}. New balance: ${money(r.data.balanceCents)}.`);
        return { ok: true };
      },
  
      async subscribe(creator, plan) {
        if (!state.user) { toast('error', 'Please sign up to subscribe.'); openDialog('signup'); return { ok: false }; }
        const r = await api('/api/subscribe', { creatorId: creator.id, planId: plan.id });
        if (!r.ok) { toast('error', r.data.error || 'Subscription failed.'); return { ok: false }; }
        state.balanceCents = r.data.balanceCents;
        state.subs = r.data.subscriptions;
        closeDialog('plans');
        render();
        toast('success', `Subscribed to ${creator.name} (${plan.label}) for ${money(r.data.chargedCents)}.`);
        return { ok: true };
      },
    };
  
    async function start() {
      refs = View.mount(document.body);
      render(); // shows "Loading creators…"
      const order = seedParam || rnd(); // new card order on every page load
      const [me, cat] = await Promise.all([
        api('/api/me'),
        api(`/api/creators?seed=${encodeURIComponent(session.seed)}&order=${encodeURIComponent(order)}`),
      ]);
      applyMe(me.data);
      state.creators = cat.data.creators || [];
      state.promoDelayMs = cat.data.promoDelayMs || 6000;
      render();
      if (localStorage.getItem('cs.ageOk') === '1') startPromoTimer();
      else openDialog('age');
    }
  
    window.App = { h, money, state, actions };
    window.addEventListener('DOMContentLoaded', start);
  })();