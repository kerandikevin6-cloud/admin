/* ============================================================
   Admin API client

   Every figure in the console comes through here. Set apiBase in
   config.js and the screens read the live database; leave it empty and
   they render their empty states rather than inventing anything.
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
      /* Which rail this account is on. Absent means Standard: real money. */
      tier: u.tier || 'standard',
      demoMode: !!u.demoMode,
      balanceMinor: u.balanceMinor, demoMinor: u.demoMinor,
      trades: u.trades, referrals: 0,
      joined: ms(u.joined), lastSeen: ms(u.lastSeen) || ms(u.joined)
    };
  }
  function normalisePayment(p) {
    return {
      id: p.id, reference: p.reference,
      userId: p.userId, userName: p.userName || '', userEmail: p.userEmail || '',
      provider: p.provider, providerLabel: p.providerLabel, method: p.method,
      amountMinor: p.amountMinor, currency: p.currency,
      creditedMinor: p.creditedMinor, status: p.status,
      failureReason: p.failureReason,
      /* Only a chain transfer carries these, and they are the only
         evidence there is for one. */
      txHash: p.txHash || null, network: p.network || null,
      created: ms(p.created), settled: ms(p.settled)
    };
  }
  function normaliseWithdrawal(w) {
    return {
      id: w.id, userId: w.userId,
      userName: w.userName || '', userEmail: w.userEmail || '',
      userKyc: w.userKyc, userStatus: w.userStatus,
      userPhone: w.userPhone, userTrades: w.userTrades,
      userTier: w.userTier || 'standard', userDemoMode: !!w.userDemoMode,
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

    /* A chain transfer, credited by hand after somebody has looked it
       up. The only route in the product that moves money into an account
       on a person's say-so. */
    creditPayment: async function (id, note) {
      var out = await call('/admin/payments/' + encodeURIComponent(id) + '/credit',
        { method: 'POST', body: { note: note } });
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

    /* ---------- system ---------- */
    /* ---------- verifications ---------- */
    verifications: async function (status) {
      var out = await call('/admin/verifications?status=' + encodeURIComponent(status || 'pending'));
      return (out.verifications || []).map(function (v) {
        v.at = ms(v.at);
        v.reviewedAt = ms(v.reviewedAt);
        v.userJoined = ms(v.userJoined);
        return v;
      });
    },

    decideVerification: async function (id, action, note) {
      return call('/admin/verifications/' + encodeURIComponent(id),
        { method: 'POST', body: { action: action, note: note } });
    },

    /* ---------- support tickets ---------- */
    tickets: async function (status) {
      var out = await call('/admin/tickets?status=' + encodeURIComponent(status || 'open'));
      return (out.tickets || []).map(function (t) {
        t.at = ms(t.at);
        t.repliedAt = ms(t.repliedAt);
        return t;
      });
    },

    replyTicket: async function (id, reply, close) {
      return call('/admin/tickets/' + encodeURIComponent(id),
        { method: 'POST', body: { reply: reply, close: !!close } });
    },

    /* ---------- the VIP demo wallet ---------- */
    wallet: async function (userId) {
      var out = await call('/admin/users/' + encodeURIComponent(userId) + '/wallet');
      return { wallet: out.wallet || null, statement: out.statement || [] };
    },

    saveWallet: async function (userId, body) {
      var out = await call('/admin/users/' + encodeURIComponent(userId) + '/wallet',
        { method: 'PUT', body: body });
      return out.wallet;
    },

    resetWallet: async function (userId, balanceMinor) {
      var out = await call('/admin/users/' + encodeURIComponent(userId) + '/wallet/reset',
        { method: 'POST', body: { balanceMinor: balanceMinor } });
      return out.wallet;
    },

    clearWallet: async function (userId) {
      return call('/admin/users/' + encodeURIComponent(userId) + '/wallet',
        { method: 'DELETE' });
    },

    health: async function () {
      return call('/admin/health');
    },

    logs: async function (params) {
      var q = [];
      if (params && params.level && params.level !== 'all') q.push('level=' + params.level);
      if (params && params.source && params.source !== 'all') q.push('source=' + encodeURIComponent(params.source));
      if (params && params.q) q.push('q=' + encodeURIComponent(params.q));
      q.push('limit=' + ((params && params.limit) || 100));
      var out = await call('/admin/logs?' + q.join('&'));
      return (out.entries || []).map(function (e) {
        e.at = ms(e.at);
        return e;
      });
    },

    domains: async function () {
      var out = await call('/admin/domains');
      return out.domains || [];
    },
    createDomain: async function (body) {
      var out = await call('/admin/domains', { method: 'POST', body: body });
      return out.domain;
    },
    updateDomain: async function (host, patch) {
      var out = await call('/admin/domains/' + encodeURIComponent(host),
        { method: 'PATCH', body: patch });
      return out.domain;
    },

    sessions: async function () {
      var out = await call('/admin/sessions');
      return (out.sessions || []).map(function (x) {
        x.startedAt = ms(x.startedAt);
        x.endedAt = ms(x.endedAt);
        return x;
      });
    },
    startSession: async function (body) {
      var out = await call('/admin/sessions', { method: 'POST', body: body });
      out.session.startedAt = ms(out.session.startedAt);
      return out.session;
    },
    endSession: async function (id) {
      var out = await call('/admin/sessions/' + encodeURIComponent(id) + '/end',
        { method: 'POST' });
      out.session.startedAt = ms(out.session.startedAt);
      out.session.endedAt = ms(out.session.endedAt);
      return out.session;
    },

    staff: async function () {
      var out = await call('/admin/staff');
      return (out.staff || []).map(function (x) {
        x.created = ms(x.created);
        x.lastSeen = ms(x.lastSeen);
        return x;
      });
    },
    inviteStaff: async function (body) {
      var out = await call('/admin/staff', { method: 'POST', body: body });
      return out.staff;
    },
    updateStaff: async function (id, patch) {
      var out = await call('/admin/staff/' + encodeURIComponent(id),
        { method: 'PATCH', body: patch });
      return out.staff;
    },

    rejectWithdrawal: async function (id, note) {
      var out = await call('/admin/withdrawals/' + encodeURIComponent(id) + '/reject',
        { method: 'POST', body: { note: note } });
      return normaliseWithdrawal(out.request);
    }
  };
})();
