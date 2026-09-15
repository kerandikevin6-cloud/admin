/* ============================================================
   Nexas Admin — shell and pages
   The rail and top bar are injected here so every page carries the
   same chrome and a new page is one HTML file with a mount point.
   ============================================================ */
(function () {
  "use strict";

  var D = window.MockData;

  /* ---------- icons: line art, drawn once ---------- */
  var ICONS = {
    dash: 'M4 13h7V4H4zM13 20h7v-9h-7zM4 20h7v-4H4zM13 8h7V4h-7z',
    users: 'M3 20a6 6 0 0112 0|M15.5 13.2A5.2 5.2 0 0121 20',
    money: 'M3 7h18v11H3z|M3 11h18',
    payout: 'M12 19V5|M5 12l7-7 7 7',
    ledger: 'M5 4h11l3 3v13H5z|M9 10h7M9 14h7',
    search: 'M20 20l-3.6-3.6',
    close: 'M6 6l12 12M18 6L6 18',
    menu: 'M3 6h18M3 12h18M3 18h18',
    chev: 'M9 6l6 6-6 6',
    check: 'M5 13l4 4L19 7',
    ban: 'M5.6 5.6l12.8 12.8',
    download: 'M12 4v11M7 11l5 5 5-5|M5 20h14'
  };

  function icon(name, size) {
    var parts = (ICONS[name] || '').split('|');
    var body = '';
    if (name === 'users') body += '<circle cx="9" cy="8" r="3.4"></circle><circle cx="17" cy="9" r="2.6"></circle>';
    if (name === 'search') body += '<circle cx="11" cy="11" r="6.4"></circle>';
    if (name === 'ban') body += '<circle cx="12" cy="12" r="8.5"></circle>';
    for (var i = 0; i < parts.length; i++) if (parts[i]) body += '<path d="' + parts[i] + '"></path>';
    return '<svg width="' + (size || 17) + '" height="' + (size || 17) + '" viewBox="0 0 24 24" ' +
      'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
  }

  /* ---------- formatting ---------- */
  var nf0 = new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 });
  var nf2 = new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function money(minor, cur) {
    return nf2.format((Number(minor) || 0) / 100) + ' ' + (cur || 'USD');
  }
  function shortMoney(minor, cur) {
    var v = (Number(minor) || 0) / 100;
    if (v >= 1000000) return nf0.format(v / 1000000) + 'M ' + (cur || 'USD');
    if (v >= 10000) return nf0.format(v / 1000) + 'K ' + (cur || 'USD');
    return nf0.format(v) + ' ' + (cur || 'USD');
  }
  function count(n) { return nf0.format(Number(n) || 0); }

  function date(ts) {
    return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function dateTime(ts) {
    return new Date(ts).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    });
  }
  function ago(ts) {
    var reference = (window.AdminAPI && window.AdminAPI.live) ? Date.now() : D.now;
    var s = Math.max(0, Math.floor((reference - ts) / 1000));
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    var d = Math.floor(s / 86400);
    return d + (d === 1 ? ' day ago' : ' days ago');
  }
  function initials(name) {
    return name.split(/\s+/).map(function (p) { return p.charAt(0); }).join('').slice(0, 2).toUpperCase();
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ---------- status pills ---------- */
  var PILL = {
    success: 'ok', paid: 'ok', verified: 'ok', active: 'ok', approved: 'info',
    pending: 'wait', unverified: 'off',
    failed: 'bad', rejected: 'bad', suspended: 'bad', cancelled: 'off'
  };
  function pill(value) {
    return '<span class="pill ' + (PILL[value] || 'off') + '">' + esc(value) + '</span>';
  }

  /* ---------- operators and the session ----------
     sessionStorage, not localStorage: an operator console should not
     stay signed in after the browser is closed.

     Be clear about what this is. A check that runs in the browser is a
     signpost, not a lock — anyone can open devtools and write the key
     themselves. It exists so the wrong screen is not the default, and
     it is shaped so that swapping in POST /auth/login is one function.
     The real control is the server refusing to answer without an
     operator token. */
  var SESSION_KEY = 'nexas.admin.session';
  var API = window.AdminAPI || { live: false };

  /* Stand-in operators, used only while no API is configured. Once
     config.js points at the server these are ignored entirely and the
     real check is the role on the profile row. */
  var OPERATORS = [
    { email: 'ops@nexas.trade', password: 'console1234', name: 'Operations', role: 'operator' },
    { email: 'finance@nexas.trade', password: 'console1234', name: 'Finance', role: 'finance' },
    { email: 'admin@nexas.trade', password: 'console1234', name: 'Administrator', role: 'admin' }
  ];

  function session() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch (e) { return null; }
  }
  function keepSession(operator) {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(operator)); } catch (e) {}
    return operator;
  }

  /* Returns the operator, or throws with something worth showing. */
  async function signIn(email, password) {
    if (API.live) return keepSession(await API.signIn(email, password));

    /* A deliberate pause offline too: instant failure invites a script
       to sit here trying combinations, and the real endpoint will not be
       instant either, so the interface should not expect it to be. */
    await new Promise(function (r) { setTimeout(r, 450); });

    var match = OPERATORS.filter(function (o) {
      return o.email === email && o.password === password;
    })[0];
    if (!match) return null;

    return keepSession({
      email: match.email, name: match.name, role: match.role, signedInAt: Date.now()
    });
  }

  async function signOut() {
    if (API.live) { try { await API.signOut(); } catch (e) {} }
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
    location.replace('login.html');
  }

  /* ---------- loader ----------
     Flat purple bars, same shape as the one in the trading app so a
     wait looks the same wherever it happens. */
  function loader(cls) {
    return '<span class="loader ' + (cls || '') + '" role="status" aria-label="Working">' +
      '<i></i><i></i><i></i><i></i></span>';
  }

  /* ---------- data ----------
     Every page asks for data through here rather than reaching into
     MockData, so the switch between mock and API is one object. */
  var Data = API.live ? {
    live: true,
    stats: API.stats,
    daily: API.daily,
    users: API.users,
    user: API.user,
    updateUser: API.updateUser,
    payments: API.payments,
    recheckPayment: API.recheckPayment,
    withdrawals: API.withdrawals,
    approveWithdrawal: API.approveWithdrawal,
    rejectWithdrawal: API.rejectWithdrawal,
    now: function () { return Date.now(); }
  } : {
    live: false,
    stats: async function () { return D.stats; },
    daily: async function () { return D.daily; },
    users: async function (params) {
      params = params || {};
      var list = D.users.filter(function (u) {
        if (params.kyc && params.kyc !== 'all' && u.kyc !== params.kyc) return false;
        if (params.status && params.status !== 'all' && u.status !== params.status) return false;
        if (!params.q) return true;
        var q = params.q.toLowerCase();
        return u.name.toLowerCase().indexOf(q) > -1 ||
               u.email.toLowerCase().indexOf(q) > -1 ||
               u.phone.indexOf(q) > -1 ||
               u.id.toLowerCase().indexOf(q) > -1;
      });
      return { total: list.length, users: list };
    },
    user: async function (id) {
      return {
        user: D.user(id),
        payments: D.paymentsFor(id),
        withdrawals: D.withdrawalsFor(id)
      };
    },
    updateUser: async function (id, patch) {
      var u = D.user(id);
      if (patch.kycStatus) u.kyc = patch.kycStatus;
      if (patch.status) u.status = patch.status;
      return u;
    },
    payments: async function (params) {
      params = params || {};
      var list = D.payments.filter(function (p) {
        if (params.status && params.status !== 'all' && p.status !== params.status) return false;
        if (params.method && params.method !== 'all' && p.method !== params.method) return false;
        if (!params.q) return true;
        var q = params.q.toLowerCase();
        return p.reference.toLowerCase().indexOf(q) > -1 ||
               p.userName.toLowerCase().indexOf(q) > -1 ||
               p.userEmail.toLowerCase().indexOf(q) > -1;
      });
      return { total: list.length, payments: list };
    },
    recheckPayment: async function (id) {
      return D.payments.filter(function (p) { return p.id === id; })[0];
    },
    withdrawals: async function (params) {
      params = params || {};
      var list = D.withdrawals.filter(function (w) {
        return !params.status || params.status === 'all' || w.status === params.status;
      });
      return { total: list.length, withdrawals: list };
    },
    approveWithdrawal: async function (id) {
      var w = D.withdrawals.filter(function (x) { return x.id === id; })[0];
      w.status = 'paid'; w.settled = D.now;
      return w;
    },
    rejectWithdrawal: async function (id) {
      var w = D.withdrawals.filter(function (x) { return x.id === id; })[0];
      w.status = 'rejected'; w.settled = D.now;
      var u = D.user(w.userId);
      if (u) u.balanceMinor += w.amountMinor;   /* the hold comes back */
      return w;
    },
    now: function () { return D.now; }
  };

  /* ---------- chrome ---------- */
  var NAV = [
    { section: 'Overview' },
    { id: 'dashboard', label: 'Dashboard', href: 'index.html', icon: 'dash' },
    { section: 'Manage' },
    { id: 'users', label: 'Users', href: 'users.html', icon: 'users' },
    { id: 'payments', label: 'Deposits', href: 'payments.html', icon: 'money' },
    { id: 'withdrawals', label: 'Withdrawals', href: 'withdrawals.html', icon: 'payout' }
  ];

  /* Returns false when it has sent the browser to the sign-in page, so
     a page script can stop rather than rendering into nothing. */
  function mountChrome() {
    var operator = session();
    if (!operator) { location.replace('login.html'); return false; }

    var page = document.body.getAttribute('data-page');
    var title = document.body.getAttribute('data-title') || '';

    var rail = '<aside class="rail" id="rail">' +
      '<div class="rail-brand"><b>Nexas</b><span>Admin</span></div>' +
      '<nav class="rail-nav">' +
        NAV.map(function (item) {
          if (item.section) return '<div class="rail-sect">' + item.section + '</div>';
          return '<a href="' + item.href + '" class="' + (item.id === page ? 'on' : '') + '">' +
            icon(item.icon, 16) + item.label + '</a>';
        }).join('') +
      '</nav>' +
      '<div class="rail-foot">' +
        '<div>' + (Data.live ? 'Live data' : 'Mock data. Not connected to the API.') + '</div>' +
        '<button class="btn-quiet btn-sm rail-out" id="signOut">Sign out</button>' +
      '</div>' +
    '</aside>';

    var top = '<header class="topbar">' +
      '<button class="iconbtn rail-toggle" id="railToggle" aria-label="Menu">' + icon('menu', 19) + '</button>' +
      '<h1>' + esc(title) + '</h1>' +
      '<span class="spacer"></span>' +
      '<div class="who"><i>' + initials(operator.name) + '</i>' +
        '<span>' + esc(operator.name) + '</span></div>' +
    '</header>';

    document.body.insertAdjacentHTML('afterbegin',
      '<div class="shell">' + rail +
        '<div class="main">' + top + '<div class="page" id="page"></div></div>' +
      '</div>' +
      '<div class="scrim" id="scrim"></div>' +
      '<aside class="drawer" id="drawer" aria-label="Details"></aside>');

    document.getElementById('railToggle').addEventListener('click', function () {
      document.getElementById('rail').classList.add('on');
      document.getElementById('scrim').classList.add('on');
    });
    document.getElementById('signOut').addEventListener('click', signOut);
    document.getElementById('scrim').addEventListener('click', closeAll);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeAll();
    });

    return true;
  }

  function closeAll() {
    document.getElementById('rail').classList.remove('on');
    document.getElementById('drawer').classList.remove('on');
    document.getElementById('scrim').classList.remove('on');
  }

  function openDrawer(markup) {
    var d = document.getElementById('drawer');
    d.innerHTML = markup;
    d.classList.add('on');
    document.getElementById('scrim').classList.add('on');
    var close = d.querySelector('[data-close]');
    if (close) close.addEventListener('click', closeAll);
  }

  var toastTimer;
  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'toast';
      t.id = 'toast';
      t.setAttribute('role', 'status');
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('on'); }, 2400);
  }

  /* ---------- shared blocks ---------- */
  function kpi(label, value, note, tone) {
    return '<div class="kpi">' +
      '<div class="kpi-label">' + label + '</div>' +
      '<div class="kpi-value">' + value + '</div>' +
      (note ? '<div class="kpi-note ' + (tone || '') + '">' + note + '</div>' : '') +
    '</div>';
  }

  function card(title, bodyMarkup, actions, noPad) {
    return '<section class="card">' +
      (title ? '<div class="card-head"><h2>' + title + '</h2><span class="spacer"></span>' +
        (actions || '') + '</div>' : '') +
      (noPad ? bodyMarkup : '<div class="card-body">' + bodyMarkup + '</div>') +
    '</section>';
  }

  /* Panels that are waiting say so, rather than showing an empty table
     that reads as "there is nothing here". */
  function loadingBlock(label) {
    return '<div class="empty" style="display:flex;flex-direction:column;' +
      'align-items:center;gap:12px;color:var(--purple)">' + loader() +
      '<span class="muted">' + esc(label || 'Loading') + '</span></div>';
  }
  function errorBlock(message, retryId) {
    return '<div class="empty">' +
      '<div style="color:var(--neg);margin-bottom:10px">' + esc(message) + '</div>' +
      (retryId ? '<button class="btn btn-ghost btn-sm" id="' + retryId + '">Try again</button>' : '') +
    '</div>';
  }

  function table(headers, rows) {
    if (!rows.length) return '<div class="empty">Nothing to show</div>';
    return '<div class="table-wrap"><table><thead><tr>' +
      headers.map(function (h) {
        return '<th' + (h.right ? ' class="right"' : '') + '>' + h.label + '</th>';
      }).join('') +
      '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
  }

  function who(name, sub) {
    return '<div class="cell-main">' + esc(name) + '</div>' +
      '<div class="cell-sub">' + esc(sub) + '</div>';
  }

  window.Admin = {
    icon: icon, money: money, shortMoney: shortMoney, count: count,
    date: date, dateTime: dateTime, ago: ago, initials: initials, esc: esc,
    pill: pill, kpi: kpi, card: card, table: table, who: who,
    data: Data, loadingBlock: loadingBlock, errorBlock: errorBlock,
    openDrawer: openDrawer, closeAll: closeAll, toast: toast,
    mountChrome: mountChrome,
    session: session, signIn: signIn, signOut: signOut, loader: loader
  };
})();
