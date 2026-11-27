(() => {
    const { h, money } = App;
  
    const closeBtn = (actions, kind) =>
      h('button', { class: 'modal__close', type: 'button', 'aria-label': 'Close', onClick: () => actions.closeDialog(kind) }, '×');
  
    const overlay = (kind, label, ...content) =>
      h('div', { class: `overlay overlay--${kind}` },
        h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': label }, ...content));
  
    const field = (text, input, err) => h('div', { class: 'field' }, h('label', {}, text, input), err);
  
    function signupDialog(actions) {
      const email = h('input', { type: 'email', name: 'email', placeholder: 'you@example.com', autocomplete: 'off' });
      const password = h('input', { type: 'password', name: 'password', placeholder: 'At least 8 characters', autocomplete: 'new-password' });
      const emailErr = h('p', { class: 'field-error' });
      const pwErr = h('p', { class: 'field-error' });
      const formErr = h('p', { class: 'field-error' });
      const submit = h('button', { class: 'btn', type: 'submit' }, 'Create account');
      const form = h('form', {
        novalidate: true,
        onSubmit: async (e) => {
          e.preventDefault();
          submit.disabled = true;
          const r = await actions.signUp(email.value.trim(), password.value);
          if (r.ok) return;
          emailErr.textContent = r.errors.email || '';
          pwErr.textContent = r.errors.password || '';
          formErr.textContent = r.errors.form || '';
          submit.disabled = false;
        },
      },
        field('Email', email, emailErr),
        field('Password', password, pwErr),
        formErr,
        h('div', { class: 'modal__actions' }, submit,
          h('button', { class: 'btn btn--ghost', type: 'button', onClick: () => actions.closeDialog('signup') }, 'Cancel')));
      return overlay('signup', 'Sign up', closeBtn(actions, 'signup'), h('h2', {}, 'Create your account'), form);
    }
  
    function topupDialog(actions) {
      const amount = h('input', { type: 'number', name: 'amount', min: '10', max: '500', step: '0.01', placeholder: 'e.g. 25' });
      const err = h('p', { class: 'field-error' });
      const submit = h('button', { class: 'btn', type: 'submit' }, 'Top up');
      const form = h('form', {
        novalidate: true,
        onSubmit: async (e) => {
          e.preventDefault();
          submit.disabled = true;
          const r = await actions.topUp(amount.value);
          if (r.ok) return;
          err.textContent = r.error || '';
          submit.disabled = false;
        },
      },
        field('Amount (USD)', amount, err),
        h('div', { class: 'modal__actions' }, submit,
          h('button', { class: 'btn btn--ghost', type: 'button', onClick: () => actions.closeDialog('topup') }, 'Cancel')));
      return overlay('topup', 'Add funds', closeBtn(actions, 'topup'), h('h2', {}, 'Add funds'), form);
    }
  
    function plansDialog(props, actions) {
      const { creator, subscribed } = props;
      let selected = creator.plans[0];
      const total = h('strong', {}, money(selected.priceCents));
      const subscribeBtn = h('button', {
        class: 'btn', type: 'button',
        onClick: async () => {
          subscribeBtn.disabled = true;
          await actions.subscribe(creator, selected);
          subscribeBtn.disabled = false;
        },
      }, 'Subscribe');
      const options = creator.plans.map((p, i) =>
        h('label', { class: 'plan' },
          h('input', {
            type: 'radio', name: 'plan', checked: i === 0,
            onChange: () => { selected = p; total.textContent = money(p.priceCents); },
          }),
          h('span', { class: 'plan__name' }, p.label), ' ',
          h('span', { class: 'plan__price' }, money(p.priceCents)),
          p.discountPct ? h('span', { class: 'plan__save' }, ` Save ${p.discountPct}%`) : null));
      return overlay('plans', `Subscribe to ${creator.name}`,
        closeBtn(actions, 'plans'),
        h('h2', {}, `Subscribe to ${creator.name}`),
        subscribed ? h('p', { class: 'notice' }, `You already have an active subscription to ${creator.name}.`) : null,
        h('fieldset', {}, h('legend', {}, 'Choose a plan'), options),
        h('p', {}, 'Total due today: ', total),
        h('div', { class: 'modal__actions' }, subscribeBtn,
          h('button', { class: 'btn btn--ghost', type: 'button', onClick: () => actions.closeDialog('plans') }, 'Cancel')));
    }
  
    window.View = {
      mount(root) {
        const header = h('header', { class: 'topbar' });
        const creators = h('section', { class: 'creators-section', 'aria-label': 'Creators' });
        const subs = h('section', { class: 'subs-section', 'aria-label': 'My subscriptions' });
        const toasts = h('div', { class: 'toasts' });
        root.append(
          header,
          h('main', { class: 'page' },
            h('h1', {}, 'Creator Shop'),
            h('p', { class: 'lead' }, 'Subscribe to your favourite creators.'),
            creators, subs),
          toasts);
        return { header, creators, subs, toasts };
      },
  
      header(state, actions) {
        return h('div', { class: 'topbar__inner' },
          h('span', { class: 'brand' }, 'Creator Shop'),
          state.user
            ? h('div', { class: 'account' },
                h('span', { class: 'account__email' }, state.user.email),
                h('span', { class: 'account__balance' }, 'Balance: ', h('strong', {}, money(state.balanceCents))),
                h('button', { class: 'btn btn--ghost', onClick: actions.openTopup }, 'Add funds'))
            : h('button', { class: 'btn', onClick: actions.openSignup }, 'Sign up'));
      },
  
      creators(state, actions) {
        if (!state.creators) return h('p', { class: 'muted' }, 'Loading creators…');
        return h('div', {},
          h('h2', {}, 'Creators'),
          h('div', { class: 'grid' }, state.creators.map((c) => {
            const sub = state.subs.find((s) => s.creatorId === c.id);
            return h('article', { class: 'card', 'aria-label': c.name },
              h('div', { class: 'card__avatar', 'aria-hidden': 'true' }, c.name[0]),
              h('div', { class: 'card__body' },
                h('h3', { class: 'card__title' }, c.name),
                h('p', { class: 'card__text' }, c.tagline),
                h('p', { class: 'card__price' }, 'From ', money(c.plans[0].priceCents), ' / month'),
                sub ? h('span', { class: 'badge' }, `Subscribed · ${sub.planLabel}`) : null,
                h('div', {},
                  h('button', { class: 'btn', 'aria-label': `View plans for ${c.name}`, onClick: () => actions.openPlans(c) }, 'View plans'))));
          })));
      },
  
      subs(state) {
        return h('div', {},
          h('h2', {}, 'My subscriptions'),
          state.subs.length
            ? h('ul', { class: 'subs' }, state.subs.map((s) => h('li', {}, `${s.creatorName} — ${s.planLabel} — ${money(s.priceCents)}`)))
            : h('p', { class: 'muted' }, 'No active subscriptions yet.'));
      },
  
      toast(kind, message) {
        return h('div', { class: `toast toast--${kind}`, role: kind === 'error' ? 'alert' : 'status' }, message);
      },
  
      dialog(kind, props, actions) {
        switch (kind) {
          case 'age':
            return overlay('age', 'Age verification',
              h('h2', {}, 'Are you 18 or older?'),
              h('p', {}, 'This site is intended for adults. Please confirm your age to continue.'),
              h('div', { class: 'modal__actions' },
                h('button', { class: 'btn', onClick: actions.confirmAge }, 'I am 18 or older'),
                h('button', { class: 'btn btn--ghost', onClick: actions.leave }, 'Leave')));
          case 'promo':
            return overlay('promo', 'Weekend special',
              closeBtn(actions, 'promo'),
              h('h2', {}, 'Weekend special'),
              h('p', {}, 'Annual plans are the best value. See who is online now.'),
              h('div', { class: 'modal__actions' },
                h('button', { class: 'btn', onClick: () => actions.closeDialog('promo') }, 'Maybe later')));
          case 'signup': return signupDialog(actions);
          case 'topup': return topupDialog(actions);
          case 'plans': return plansDialog(props, actions);
          default: return h('div', {});
        }
      },
    };
  })();