/* ============================================================
   Nexas Admin, shell and pages
   The rail and top bar are injected here so every page carries the
   same chrome and a new page is one HTML file with a mount point.
   ============================================================ */
(function () {
  "use strict";

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
    download: 'M12 4v11M7 11l5 5 5-5|M5 20h14',
    chart: 'M4 19h16|M7 16V9M12 16V5M17 16v-5',
    live: 'M12 12v.01|M8.5 8.5a5 5 0 000 7|M15.5 8.5a5 5 0 010 7|M5.5 5.5a9 9 0 000 13|M18.5 5.5a9 9 0 010 13',
    shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
    plus: 'M12 5v14M5 12h14',
    stop: 'M8 8h8v8H8z',
    globe: 'M3 12h18|M12 3a15 15 0 010 18 15 15 0 010-18',
    out: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4|M16 17l5-5-5-5M21 12H9',
    logs: 'M5 4h14v16H5z|M8.5 9h7M8.5 13h7M8.5 17h4',
    refresh: 'M20 12a8 8 0 11-2.5-5.8|M20 4v4h-4'
  };

  function icon(name, size) {
    var parts = (ICONS[name] || '').split('|');
    var body = '';
    if (name === 'users') body += '<circle cx="9" cy="8" r="3.4"></circle><circle cx="17" cy="9" r="2.6"></circle>';
    if (name === 'search') body += '<circle cx="11" cy="11" r="6.4"></circle>';
    if (name === 'ban') body += '<circle cx="12" cy="12" r="8.5"></circle>';
    if (name === 'globe') body += '<circle cx="12" cy="12" r="9"></circle>';
    for (var i = 0; i < parts.length; i++) if (parts[i]) body += '<path d="' + parts[i] + '"></path>';
    return '<svg width="' + (size || 17) + '" height="' + (size || 17) + '" viewBox="0 0 24 24" ' +
      'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
  }

  /* ---------- formatting ---------- */
  var nf0 = new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 });
  var nf1 = new Intl.NumberFormat('en-KE', { maximumFractionDigits: 1 });
  var nf2 = new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* The business banks in shillings, so the console reports in
     shillings. Trading balances are held in USD, so anything coming
     from an account is converted once, here, and never again further
     down, a figure converted twice is the classic way a dashboard
     ends up an order of magnitude out. */
  var KES_PER_USD = 129;

  function fromUsd(usdMinor) {
    return Math.round((Number(usdMinor) || 0) * KES_PER_USD);
  }

  function money(minor, cur) {
    return nf2.format((Number(minor) || 0) / 100) + ' ' + (cur || 'KSh');
  }
  function shortMoney(minor, cur) {
    var v = (Number(minor) || 0) / 100;
    var unit = cur || 'KSh';
    if (v >= 1000000) return unit + ' ' + nf1.format(v / 1000000) + 'M';
    if (v >= 10000) return unit + ' ' + nf0.format(v / 1000) + 'K';
    return unit + ' ' + nf0.format(v);
  }
  /* For anything stored in USD: convert, then format. */
  function usd(usdMinor) { return money(fromUsd(usdMinor)); }
  function usdShort(usdMinor) { return shortMoney(fromUsd(usdMinor)); }
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
    if (!ts) return '\u2014';
    var s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
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
    vip: 'info', standard: 'off',
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
     signpost, not a lock, anyone can open devtools and write the key
     themselves. It exists so the wrong screen is not the default, and
     it is shaped so that swapping in POST /auth/login is one function.
     The real control is the server refusing to answer without an
     operator token. */
  var SESSION_KEY = 'nexas.admin.session';
  var API = window.AdminAPI || { live: false };

  function session() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch (e) { return null; }
  }
  function keepSession(operator) {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(operator)); } catch (e) {}
    return operator;
  }

  /* Always the server. There is no local list to fall back to, so a
     console with no API configured cannot be signed into at all, which is the correct answer rather than a convenient one. */
  async function signIn(email, password) {
    if (!API.live) {
      throw new Error('No API is configured. Set apiBase in assets/js/config.js.');
    }
    return keepSession(await API.signIn(email, password));
  }

  async function signOut() {
    if (API.live) { try { await API.signOut(); } catch (e) {} }
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
    location.replace('login.html');
  }

  /* ---------- charts ----------
     One palette, all within the purple family, so a chart never
     introduces a colour that means nothing. Status colours are kept out
     of here on purpose: red in a composition chart reads as a warning
     when it only means "a different slice".  */
  var SLICE = ['#5B45C9', '#8B79E0', '#B7ACE8', '#D5CDF2', '#EAE6FA'];

  /* A donut rather than a pie: the hole holds the total, which is the
     number people actually want, and comparing arc lengths is easier
     without wedges meeting at a point. */
  function donut(segments, opts) {
    opts = opts || {};
    var total = segments.reduce(function (a, s) { return a + (s.value || 0); }, 0);
    var R = 52, W = 22, C = 2 * Math.PI * R, offset = 0;

    var arcs = total > 0 ? segments.map(function (s, i) {
      var len = (s.value || 0) / total * C;
      var arc = '<circle cx="70" cy="70" r="' + R + '" fill="none" ' +
        'stroke="' + (s.color || SLICE[i % SLICE.length]) + '" stroke-width="' + W + '" ' +
        'stroke-dasharray="' + len.toFixed(2) + ' ' + (C - len).toFixed(2) + '" ' +
        'stroke-dashoffset="' + (-offset).toFixed(2) + '" ' +
        'transform="rotate(-90 70 70)"><title>' +
        esc(s.label) + ': ' + esc(s.display || '') + '</title></circle>';
      offset += len;
      return arc;
    }).join('') : '<circle cx="70" cy="70" r="' + R + '" fill="none" ' +
        'stroke="var(--surface-3)" stroke-width="' + W + '"></circle>';

    return '<div class="donut-wrap">' +
      '<div class="donut">' +
        '<svg viewBox="0 0 140 140" role="img" aria-label="' +
          esc(opts.label || 'Breakdown') + '">' + arcs + '</svg>' +
        '<div class="donut-mid">' +
          '<b>' + (opts.centre || '') + '</b>' +
          '<span>' + esc(opts.centreNote || '') + '</span>' +
        '</div>' +
      '</div>' +
      '<ul class="donut-key">' + segments.map(function (s, i) {
        var share = total > 0 ? (s.value || 0) / total * 100 : 0;
        return '<li>' +
          '<i style="background:' + (s.color || SLICE[i % SLICE.length]) + '"></i>' +
          '<span>' + esc(s.label) + '</span>' +
          '<b>' + esc(s.display || '') + '</b>' +
          '<u>' + share.toFixed(share >= 10 ? 0 : 1) + '%</u>' +
        '</li>';
      }).join('') + '</ul>' +
    '</div>';
  }

  /* A trend needs a line, not a donut: a share chart cannot say whether
     something is rising. */
  function trend(points, series, opts) {
    opts = opts || {};
    var W = 640, H = 170, padX = 6, padY = 12;
    var peak = 1;
    series.forEach(function (s) {
      points.forEach(function (p) { peak = Math.max(peak, p[s.key] || 0); });
    });

    function x(i) {
      return padX + (points.length < 2 ? 0 : i / (points.length - 1) * (W - padX * 2));
    }
    function y(v) { return H - padY - (v / peak) * (H - padY * 2); }

    var body = series.map(function (s, si) {
      var pts = points.map(function (p, i) { return x(i).toFixed(1) + ',' + y(p[s.key] || 0).toFixed(1); });
      var area = 'M' + x(0).toFixed(1) + ',' + (H - padY) + ' L' + pts.join(' L') +
        ' L' + x(points.length - 1).toFixed(1) + ',' + (H - padY) + ' Z';
      var colour = s.color || SLICE[si];
      return (s.fill === false ? '' :
        '<path d="' + area + '" fill="' + colour + '" opacity=".1"></path>') +
        '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + colour +
        '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></polyline>';
    }).join('');

    var labels = points.map(function (p, i) {
      if (points.length > 8 && i % 2) return '';
      return '<span style="left:' + (x(i) / W * 100).toFixed(2) + '%">' +
        new Date(p.t).getDate() + '</span>';
    }).join('');

    return '<div class="trend">' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" ' +
        'role="img" aria-label="' + esc(opts.label || 'Trend') + '">' +
        '<line x1="0" y1="' + (H - padY) + '" x2="' + W + '" y2="' + (H - padY) +
          '" stroke="var(--line)" stroke-width="1"></line>' +
        body +
      '</svg>' +
      '<div class="trend-x">' + labels + '</div>' +
    '</div>';
  }

  /* ---------- roles ----------
     What each one is allowed to do, in one place, so a page never
     invents its own idea of who may act. */
  var ROLES = {
    super_admin:    { label: 'Super admin',     rank: 5,
      note: 'Everything, including creating and removing other admins.' },
    manager:        { label: 'Manager',         rank: 4,
      note: 'Users, finances and sessions. Cannot change who is an admin.' },
    finance:        { label: 'Finance',         rank: 3,
      note: 'Approves payouts and reads every money figure.' },
    operator:       { label: 'Operator',        rank: 2,
      note: 'Day to day: identity checks, account status, deposits.' },
    marketing:      { label: 'Marketing',       rank: 2,
      note: 'Sessions and the income they bring in. No access to accounts.' },
    session_handler:{ label: 'Session handler', rank: 1,
      note: 'Starts and ends live sessions and records what was spent.' }
  };
  function roleLabel(role) { return (ROLES[role] || {}).label || role || 'Operator'; }
  function can(operator, minimumRole) {
    var mine = (ROLES[(operator || {}).role] || {}).rank || 0;
    return mine >= ((ROLES[minimumRole] || {}).rank || 99);
  }

  /* ---------- loader ----------
     Flat purple bars, same shape as the one in the trading app so a
     wait looks the same wherever it happens. */
  function loader(cls) {
    return '<span class="loader ' + (cls || '') + '" role="status" aria-label="Working">' +
      '<i></i><i></i><i></i><i></i></span>';
  }

  /* ---------- data ----------
     Every page asks through here. With an API configured it is the
     server; without one every call returns nothing, so the screens show
     their empty state instead of inventing figures. */
  var EMPTY_STATS = {
    users: 0, activeUsers: 0, suspended: 0, kycPending: 0,
    heldMinor: 0, depositsMinor: 0, depositCount: 0, failedCount: 0,
    pendingCount: 0, payoutsPending: 0, payoutsPendingMinor: 0,
    paidOutMinor: 0, oldestPending: null, settlementRate: 0
  };

  function none() { return Promise.resolve(null); }

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
    domains: API.domains,
    createDomain: API.createDomain,
    updateDomain: API.updateDomain,
    sessions: API.sessions,
    startSession: API.startSession,
    endSession: API.endSession,
    staff: API.staff,
    inviteStaff: API.inviteStaff,
    updateStaff: API.updateStaff,
    health: API.health,
    logs: API.logs,
    verifications: API.verifications,
    decideVerification: API.decideVerification,
    wallet: API.wallet,
    saveWallet: API.saveWallet,
    resetWallet: API.resetWallet,
    clearWallet: API.clearWallet
  } : {
    live: false,
    stats: function () { return Promise.resolve(EMPTY_STATS); },
    daily: function () { return Promise.resolve([]); },
    users: function () { return Promise.resolve({ total: 0, users: [] }); },
    user: none,
    updateUser: none,
    payments: function () { return Promise.resolve({ total: 0, payments: [] }); },
    recheckPayment: none,
    withdrawals: function () { return Promise.resolve({ total: 0, withdrawals: [] }); },
    approveWithdrawal: none,
    rejectWithdrawal: none,
    domains: function () { return Promise.resolve([]); },
    createDomain: none,
    updateDomain: none,
    sessions: function () { return Promise.resolve([]); },
    startSession: none,
    endSession: none,
    staff: function () { return Promise.resolve([]); },
    inviteStaff: none,
    updateStaff: none,
    health: none,
    logs: function () { return Promise.resolve([]); },
    verifications: function () { return Promise.resolve([]); },
    decideVerification: none,
    wallet: function () { return Promise.resolve({ wallet: null, statement: [] }); },
    saveWallet: none,
    resetWallet: none,
    clearWallet: none
  };

  /* ---------- chrome ---------- */
  var NAV = [
    { section: 'Overview' },
    { id: 'dashboard', label: 'Dashboard', href: 'index.html', icon: 'dash' },
    { id: 'finances', label: 'Finances', href: 'finances.html', icon: 'chart' },
    { section: 'Manage' },
    { id: 'users', label: 'Users', href: 'users.html', icon: 'users' },
    { id: 'payments', label: 'Deposits', href: 'payments.html', icon: 'money' },
    { id: 'withdrawals', label: 'Withdrawals', href: 'withdrawals.html', icon: 'payout' },
    { id: 'verifications', label: 'Verifications', href: 'verifications.html', icon: 'shield' },
    { id: 'domains', label: 'Domains', href: 'domains.html', icon: 'globe' },
    { section: 'Growth' },
    { id: 'sessions', label: 'Sessions', href: 'sessions.html', icon: 'live' },
    { section: 'System' },
    { id: 'logs', label: 'Logs', href: 'logs.html', icon: 'logs' },
    { section: 'Team' },
    /* Only a super admin can make another admin. The nav hides it for
       everyone else, and the page checks again on open, a hidden link
       is tidiness, not a control. */
    { id: 'admins', label: 'Admins', href: 'admins.html', icon: 'shield',
      roles: ['super_admin', 'manager'] }
  ];

  /* Returns false when it has sent the browser to the sign-in page, so
     a page script can stop rather than rendering into nothing. */
  function mountChrome() {
    var operator = session();
    if (!operator) { location.replace('login.html'); return false; }

    var page = document.body.getAttribute('data-page');
    var title = document.body.getAttribute('data-title') || '';

    var rail = '<aside class="rail" id="rail">' +
      '<nav class="rail-nav">' +
        /* Drop a heading whose links were all filtered out. A lone
           "Team" label with nothing under it looks like a page that
           failed to load. */
        NAV.filter(function (item, i) {
          if (item.roles && item.roles.indexOf(operator.role) === -1) return false;
          if (!item.section) return true;
          for (var j = i + 1; j < NAV.length; j++) {
            if (NAV[j].section) break;
            if (!NAV[j].roles || NAV[j].roles.indexOf(operator.role) > -1) return true;
          }
          return false;
        }).map(function (item) {
          if (item.section) return '<div class="rail-sect">' + item.section + '</div>';
          return '<a href="' + item.href + '" class="' + (item.id === page ? 'on' : '') + '">' +
            icon(item.icon, 16) + item.label + '</a>';
        }).join('') +
      '</nav>' +
      '<div class="rail-foot">' +
        (Data.live ? '' :
          '<div class="rail-source">No API configured</div>') +
        '<a class="rail-me' + (page === 'profile' ? ' on' : '') + '" href="profile.html">' +
          '<i>' + initials(operator.name) + '</i>' +
          '<span><b>' + esc(operator.name) + '</b>' +
          '<span>' + esc(roleLabel(operator.role)) + '</span></span>' +
          icon('chev', 15) +
        '</a>' +
        /* Kept in the rail as well as on the profile page: signing out
           is something people reach for without wanting to navigate
           somewhere else first. */
        '<button class="rail-out" id="signOut">' + icon('out', 16) + 'Sign out</button>' +
      '</div>' +
    '</aside>';

    var top = '<header class="topbar">' +
      '<button class="iconbtn rail-toggle" id="railToggle" aria-label="Menu">' + icon('menu', 19) + '</button>' +
      '<h1>' + esc(title) + '</h1>' +
      '<span class="spacer"></span>' +
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
  /* One shape for "there is nothing here yet", so a quiet page never
     looks like a broken one. */
  function emptyBlock(title, note, action) {
    return '<div class="empty-state">' +
      '<b>' + esc(title) + '</b>' +
      (note ? '<span>' + esc(note) + '</span>' : '') +
      (action || '') +
    '</div>';
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
    usd: usd, usdShort: usdShort, fromUsd: fromUsd, rate: KES_PER_USD,
    roles: ROLES, roleLabel: roleLabel, can: can, signOut: signOut,
    date: date, dateTime: dateTime, ago: ago, initials: initials, esc: esc,
    pill: pill, kpi: kpi, card: card, table: table, who: who,
    donut: donut, trend: trend, slice: SLICE,
    data: Data, loadingBlock: loadingBlock, errorBlock: errorBlock,
    emptyBlock: emptyBlock,
    openDrawer: openDrawer, closeAll: closeAll, toast: toast,
    mountChrome: mountChrome,
    session: session, signIn: signIn, signOut: signOut, loader: loader
  };
})();
