/* ============================================================
   Mock data
   Stands in for the API until the console is wired to the backend.

   Seeded on purpose: a fixed PRNG means the same numbers on every
   reload. Random-per-load figures make it impossible to tell a layout
   bug from a data change, and make screenshots useless.

   Money is in minor units (cents), same as the backend, so nothing has
   to be reinterpreted when this file is replaced by real calls.
   ============================================================ */
(function () {
  "use strict";

  /* mulberry32 — small, fast, deterministic */
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  var rand = rng(20260915);
  function pick(a) { return a[Math.floor(rand() * a.length)]; }
  function between(lo, hi) { return Math.floor(rand() * (hi - lo + 1)) + lo; }

  var FIRST = ['Amara', 'Joseph', 'Wanjiku', 'Brian', 'Faith', 'Kelvin', 'Achieng', 'Peter',
    'Mercy', 'Dennis', 'Njeri', 'Samuel', 'Halima', 'Victor', 'Esther', 'Collins',
    'Naomi', 'Elias', 'Ruth', 'Stephen', 'Chebet', 'Ibrahim', 'Grace', 'Oscar'];
  var LAST = ['Kimani', 'Otieno', 'Mwangi', 'Wafula', 'Kiptoo', 'Achieng', 'Njoroge',
    'Mutua', 'Chebet', 'Barasa', 'Omondi', 'Wanjala', 'Kariuki', 'Hassan'];
  var COUNTRIES = [
    { code: 'KE', name: 'Kenya', cur: 'KES', dial: '254' },
    { code: 'UG', name: 'Uganda', cur: 'UGX', dial: '256' },
    { code: 'TZ', name: 'Tanzania', cur: 'TZS', dial: '255' },
    { code: 'NG', name: 'Nigeria', cur: 'NGN', dial: '234' }
  ];

  var DAY = 86400000;
  var NOW = Date.UTC(2026, 8, 15, 9, 0, 0);   /* fixed clock, so do the dates */

  /* ---------------- users ---------------- */
  var users = [];
  for (var i = 0; i < 48; i++) {
    var first = pick(FIRST), last = pick(LAST);
    var country = pick(COUNTRIES);
    var joined = NOW - between(0, 210) * DAY;
    var kyc = pick(['verified', 'verified', 'verified', 'pending', 'unverified', 'rejected']);
    var status = rand() > 0.94 ? 'suspended' : 'active';

    users.push({
      id: 'U' + (10420 + i),
      name: first + ' ' + last,
      email: (first + '.' + last).toLowerCase() + '@' + pick(['gmail.com', 'outlook.com', 'yahoo.com']),
      phone: country.dial + between(700000000, 799999999),
      country: country.code,
      countryName: country.name,
      currency: country.cur,
      kyc: kyc,
      status: status,
      /* an unverified account is usually a small or empty one */
      balanceMinor: kyc === 'verified' ? between(0, 480000) : between(0, 40000),
      demoMinor: 1000000,
      joined: joined,
      lastSeen: NOW - between(0, 14) * DAY,
      trades: between(0, 940),
      referrals: rand() > 0.7 ? between(1, 9) : 0
    });
  }

  /* ---------------- payments ---------------- */
  var payments = [];
  var PROVIDERS = [
    { id: 'payhero', label: 'M-Pesa', method: 'mpesa' },
    { id: 'payhero', label: 'M-Pesa', method: 'mpesa' },
    { id: 'paystack', label: 'Card', method: 'card' }
  ];

  for (var p = 0; p < 140; p++) {
    var u = pick(users);
    var prov = pick(PROVIDERS);
    var created = NOW - Math.floor(rand() * 30 * DAY);
    /* most attempts succeed; the rest split between failed and pending */
    var roll = rand();
    var status = roll > 0.16 ? 'success' : roll > 0.06 ? 'failed' : 'pending';
    var localMinor = pick([10000, 20000, 50000, 100000, 250000, 500000, 1000000]);

    payments.push({
      id: 'P' + (90210 + p),
      reference: (prov.method === 'mpesa' ? 'MP-' : 'CD-') +
        created.toString(36).toUpperCase().slice(-5) + '-' + between(1000, 9999),
      userId: u.id,
      userName: u.name,
      userEmail: u.email,
      provider: prov.id,
      providerLabel: prov.label,
      method: prov.method,
      amountMinor: localMinor,
      currency: 'KES',
      creditedMinor: status === 'success' ? Math.round(localMinor / 129) : null,
      status: status,
      failureReason: status === 'failed'
        ? pick(['Request cancelled by user', 'Insufficient funds', 'Request timed out'])
        : null,
      created: created
    });
  }
  payments.sort(function (a, b) { return b.created - a.created; });

  /* ---------------- withdrawals ---------------- */
  var withdrawals = [];
  for (var w = 0; w < 26; w++) {
    var wu = pick(users.filter(function (x) { return x.kyc === 'verified'; }));
    var wCreated = NOW - Math.floor(rand() * 18 * DAY);
    var wRoll = rand();
    var wStatus = wRoll > 0.55 ? 'paid' : wRoll > 0.25 ? 'pending' : wRoll > 0.12 ? 'approved' : 'rejected';

    withdrawals.push({
      id: 'W' + (7710 + w),
      userId: wu.id,
      userName: wu.name,
      userEmail: wu.email,
      amountMinor: pick([100000, 150000, 250000, 400000, 600000, 900000]),
      currency: 'USD',
      method: 'mpesa',
      destination: wu.phone,
      status: wStatus,
      created: wCreated,
      settled: wStatus === 'paid' || wStatus === 'rejected' ? wCreated + between(1, 8) * 3600000 : null
    });
  }
  withdrawals.sort(function (a, b) { return b.created - a.created; });

  /* ---------------- daily totals, last 14 days ---------------- */
  var daily = [];
  for (var d = 13; d >= 0; d--) {
    var dayStart = NOW - d * DAY;
    var dayPayments = payments.filter(function (x) {
      return x.status === 'success' && Math.abs(x.created - dayStart) < DAY / 2;
    });
    var depositMinor = dayPayments.reduce(function (a, x) { return a + x.amountMinor; }, 0);
    daily.push({
      t: dayStart,
      depositsMinor: depositMinor || between(180000, 900000),
      withdrawalsMinor: between(60000, 520000),
      signups: between(0, 7)
    });
  }

  /* ---------------- derived figures ---------------- */
  function sum(list, key) {
    return list.reduce(function (a, x) { return a + (x[key] || 0); }, 0);
  }

  var settled = payments.filter(function (x) { return x.status === 'success'; });

  var stats = {
    users: users.length,
    activeUsers: users.filter(function (u) { return u.status === 'active'; }).length,
    suspended: users.filter(function (u) { return u.status === 'suspended'; }).length,
    kycPending: users.filter(function (u) { return u.kyc === 'pending'; }).length,
    heldMinor: sum(users, 'balanceMinor'),
    depositsMinor: sum(settled, 'amountMinor'),
    depositCount: settled.length,
    failedCount: payments.filter(function (x) { return x.status === 'failed'; }).length,
    pendingCount: payments.filter(function (x) { return x.status === 'pending'; }).length,
    payoutsPending: withdrawals.filter(function (x) { return x.status === 'pending'; }).length,
    payoutsPendingMinor: sum(
      withdrawals.filter(function (x) { return x.status === 'pending'; }), 'amountMinor'),
    paidOutMinor: sum(
      withdrawals.filter(function (x) { return x.status === 'paid'; }), 'amountMinor')
  };

  /* Settlement rate is the number an operator actually watches: a drop
     means a provider is failing, not that people stopped trying. */
  stats.settlementRate = payments.length
    ? settled.length / payments.length * 100
    : 0;

  window.MockData = {
    now: NOW,
    users: users,
    payments: payments,
    withdrawals: withdrawals,
    daily: daily,
    stats: stats,

    user: function (id) {
      return users.filter(function (u) { return u.id === id; })[0] || null;
    },
    paymentsFor: function (id) {
      return payments.filter(function (p) { return p.userId === id; }).slice(0, 8);
    },
    withdrawalsFor: function (id) {
      return withdrawals.filter(function (w) { return w.userId === id; }).slice(0, 8);
    }
  };
})();
