/* ============================================================
   Admin API client

   One switch decides where the console gets its data. Set a base URL in
   config.js and every screen talks to the server; leave it empty and the
   same screens run on the mock in mock.js.

   That is deliberate. The console has to stay openable while the API is
   down or half-built, and a design that only works when the server is up
   cannot be developed against.
   ============================================================ */
(function () {
  "use strict";

  var CFG = window.NexasAdminConfig || {};
  var BASE = (CFG.apiBase || '').replace(/\/+$/, '');
  var LIVE = !!BASE;

  var TOKEN_KEY = 'nexas.admin.token';

  function token() {
    try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
  }
  function setToken(t) {
    try {
      if (t) sessionStorage.setItem(TOKEN_KEY, t);
      else sessionStorage.removeItem(TOKEN_KEY);
    } catch (e) {}
  }

  /* One place turns a response into either data or a thrown Error with a
     message worth showing someone. */
  async function call(path, options) {
    options = options || {};
    var res;
    try {
      res = await fetch(BASE + path, {
        method: options.method || 'GET',
        headers: Object.assign(
          { 'Content-Type': 'application/json' },
          token() ? { Authorization: 'Bearer ' + token() } : {},
          options.headers || {}
        ),
        body: options.body ? JSON.stringify(options.body) : undefined
      });
    } catch (e) {
      throw new Error('Could not reach the API. Check the connection.');
    }

    var body = await res.json().catch(function () { return {}; });

    if (res.status === 401) {
      /* The session died underneath us. Clear it and send them back to
         sign in rather than showing a screen of failed panels. */
      setToken(null);
      try { sessionStorage.removeItem('nexas.admin.session'); } catch (e) {}
      if (!/login\.html$/.test(location.pathname)) location.replace('login.html');
      throw new Error('Session expired');
    }

    if (!res.ok || body.ok === false) {
      throw new Error((body.error && body.error.message) || 'That did not work');
    }
    return body;
  }

  /* ---------- query strings ---------- */
  function qs(params) {
    var parts = [];
    Object.keys(params || {}).forEach(function (k) {
      var v = params[k];
      if (v === undefined || v === null || v === '' || v === 'all') return;
      parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
    });
    return parts.length ? '?' + parts.join('&') : '';
  }

  /* ---------- dates ----------
     The server sends ISO strings; the console works in milliseconds. */
  function ms(v) {
    if (v == null) return null;
    if (typeof v === 'number') return v;
    var t = Date.parse(v);
    return isNaN(t) ? null : t;
  }

  function normaliseUser(u) {
    return {
      id: u.id, name: u.name, email: u.email, phone: u.phone,
      country: u.country, countryName: u.country, currency: 'KES',
      kyc: u.kyc, status: u.status, role: u.role,
      balanceMinor: u.balanceMinor, demoMinor: u.demoMinor,
      trades: u.trades, referrals: 0,
      joined: ms(u.joined), lastSeen: ms(u.lastSeen) || ms(u.joined)
    };
  }
  function normalisePayment(p) {
    return {
      id: p.id, reference: p.reference,
      userId: p.userId, userName: p.userName || '—', userEmail: p.userEmail || '',
      provider: p.provider, providerLabel: p.providerLabel, method: p.method,
      amountMinor: p.amountMinor, currency: p.currency,
      creditedMinor: p.creditedMinor, status: p.status,
      failureReason: p.failureReason,
      created: ms(p.created), settled: ms(p.settled)
    };
  }
  function normaliseWithdrawal(w) {
    return {
      id: w.id, userId: w.userId,
      userName: w.userName || '—', userEmail: w.userEmail || '',
      userKyc: w.userKyc, userStatus: w.userStatus,
      userPhone: w.userPhone, userTrades: w.userTrades,
      amountMinor: w.amountMinor, currency: w.currency,
      method: w.method, destination: w.destination,
      status: w.status, created: ms(w.created), settled: ms(w.settled)
    };
  }

  window.AdminAPI = {
    live: LIVE,
    base: BASE,
    token: token,
    setToken: setToken,

    /* ---------- auth ---------- */
    signIn: async function (email, password) {
      var out = await call('/auth/login', {
        method: 'POST', body: { email: email, password: password }
      });
      setToken(out.session.accessToken);

      /* Signing in is not the same as being allowed in. Ask the API who
         this is; a customer's own credentials must not open the console. */
      try {
        var me = await call('/admin/me');
        return {
          email: me.operator.email, name: me.operator.name,
          role: me.operator.role, signedInAt: Date.now(),
          refreshToken: out.session.refreshToken
        };
      } catch (e) {
        setToken(null);
        throw new Error('This account cannot use the console.');
      }
    },

    signOut: async function () {
      try { await call('/auth/logout', { method: 'POST' }); } catch (e) {}
      setToken(null);
    },

    /* ---------- data ---------- */
    stats: async function () {
      var out = await call('/admin/stats');
      var s = out.stats || {};
      return {
        users: s.users || 0,
        activeUsers: s.activeUsers || 0,
        suspended: s.suspended || 0,
        kycPending: s.kycPending || 0,
        heldMinor: Number(s.heldMinor || 0),
        depositsMinor: Number(s.depositsMinor || 0),
        depositCount: s.depositCount || 0,
        failedCount: s.failedCount || 0,
        pendingCount: s.pendingCount || 0,
        payoutsPending: s.payoutsPending || 0,
        payoutsPendingMinor: Number(s.payoutsPendingMinor || 0),
        paidOutMinor: Number(s.paidOutMinor || 0),
        oldestPending: ms(s.oldestPending),
        settlementRate: (s.depositCount + s.failedCount)
          ? s.depositCount / (s.depositCount + s.failedCount) * 100
          : 0
      };
    },

    daily: async function (days) {
      var out = await call('/admin/daily' + qs({ days: days || 14 }));
      return (out.daily || []).map(function (d) {
        return {
          t: Date.parse(d.day),
          depositsMinor: d.depositsMinor,
          withdrawalsMinor: d.withdrawalsMinor,
          signups: d.signups
        };
      });
    },

    users: async function (params) {
      var out = await call('/admin/users' + qs(params));
      return { total: out.total, users: (out.users || []).map(normaliseUser) };
    },

    user: async function (id) {
      var out = await call('/admin/users/' + encodeURIComponent(id));
      return {
        user: normaliseUser(out.user),
        payments: (out.payments || []).map(normalisePayment),
        withdrawals: (out.withdrawals || []).map(normaliseWithdrawal)
      };
    },

    updateUser: async function (id, patch) {
      var out = await call('/admin/users/' + encodeURIComponent(id), {
        method: 'PATCH', body: patch
      });
      return normaliseUser(out.user);
    },

    payments: async function (params) {
      var out = await call('/admin/payments' + qs(params));
      return { total: out.total, payments: (out.payments || []).map(normalisePayment) };
    },

    recheckPayment: async function (id) {
      var out = await call('/admin/payments/' + encodeURIComponent(id) + '/recheck',
        { method: 'POST' });
      return normalisePayment(out.payment);
    },

    withdrawals: async function (params) {
      var out = await call('/admin/withdrawals' + qs(params));
      return { total: out.total, withdrawals: (out.withdrawals || []).map(normaliseWithdrawal) };
    },

    approveWithdrawal: async function (id, note) {
      var out = await call('/admin/withdrawals/' + encodeURIComponent(id) + '/approve',
        { method: 'POST', body: { note: note } });
      return normaliseWithdrawal(out.request);
    },

    rejectWithdrawal: async function (id, note) {
      var out = await call('/admin/withdrawals/' + encodeURIComponent(id) + '/reject',
        { method: 'POST', body: { note: note } });
      return normaliseWithdrawal(out.request);
    }
  };
})();
