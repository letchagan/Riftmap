(function () {
  "use strict";
  var BRAND = "Riftmap"; // rename the site here
  var D = window.HB_DATA;
  var $ = function (id) { return document.getElementById(id); };
  var app = $("app"), tip = $("tip");
  
  var REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- helpers ----------
  var fmt = function (n) { return Math.round(n).toLocaleString("en-US"); };
  var money = function (n) { return "$" + fmt(n); };
  var pct = function (f) { return (f * 100).toFixed(f < 0.1 ? 1 : 0) + "%"; };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var enc = encodeURIComponent;
  var sum = function (a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var polar = function (r, a) { return [r * Math.cos(a), r * Math.sin(a)]; };
  var f1 = function (n) { return Math.round(n * 10) / 10; };
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var SEVN = ["None", "Low", "Medium", "High", "Critical"];
  function sevCounts(str) { var o = [0, 0, 0, 0, 0]; for (var i = 0; i < (str || "").length; i++) { var n = +str[i]; o[n >= 0 && n <= 4 ? n : 0]++; } return o; }
  function sevLevel(str) {
    var c = sevCounts(str), t = c[1] + c[2] + c[3] + c[4];
    if (!t) return 0;
    return clamp(Math.round((c[1] + c[2] * 2 + c[3] * 3 + c[4] * 4) / t), 1, 4);
  }
  function sevDots(k) { return '<span class="sev" data-k="' + (k || 0) + '" role="img" aria-label="' + (k ? SEVN[k] : "unknown") + ' severity" title="' + (k ? SEVN[k] + " severity" : "no severity data") + '"><i></i><i></i><i></i><i></i></span>'; }
  function bar(v, max, i) { return '<span class="bc"><i style="width:' + (max ? Math.max(1.5, v / max * 100) : 0) + "%;--i:" + (i || 0) + '"></i></span>'; }
  function row(href, name, v, max, i, extra, numText) {
    var open = href ? '<a href="' + href + '"' : '<button type="button"';
    return open + ' class="row" style="--i:' + i + '"' + (extra || "") + '><span class="nm">' + name + "</span>" + bar(v, max, i) + '<span class="num">' + (numText != null ? numText : fmt(v)) + "</span>" + (href ? "</a>" : "</button>");
  }
  function showTip(e, html) {
    tip.innerHTML = html; tip.hidden = false;
    var x = e.clientX + 16, y = e.clientY + 16, r = tip.getBoundingClientRect();
    if (x + r.width > innerWidth - 10) x = e.clientX - r.width - 16;
    if (y + r.height > innerHeight - 10) y = e.clientY - r.height - 16;
    tip.style.left = x + "px"; tip.style.top = y + "px";
  }
  function hideTip() { tip.hidden = true; }
  var toastT;
  function toast(m) { var t = $("toast"); t.textContent = m; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove("show"); }, 1900); }
  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { toast("Copied " + text); }, function () { toast("Copy is blocked here"); });
    else toast("Copy is not available");
  }

  // ---------- data ----------
  var classes = D.classes.slice();
  var byId = {};
  classes.forEach(function (c, i) {
    c.idx = i; byId[c.id] = c;
    c.avg = c.count ? c.bounty / c.count : 0;
    c.weaknesses.forEach(function (w, j) { w.cls = c.id; w.j = j; w.lvl = sevLevel(w.sev); });
  });
  var byCount = classes.slice().sort(function (a, b) { return b.count - a.count; });
  byCount.forEach(function (c, i) { c.rank = i; });
  var allWeak = [];
  classes.forEach(function (c) { allWeak = allWeak.concat(c.weaknesses); });
  var programs = D.topPrograms.map(function (p, i) { p.idx = i; p.bounty = p.bounty || 0; p.classes = p.classes || []; return p; });
  var letterOf = function (name) { var ch = String(name || "#").trim().charAt(0).toUpperCase(); return /[A-Z]/.test(ch) ? ch : "#"; };
  var LETTERS = {};
  programs.forEach(function (p) { var L = letterOf(p.name); (LETTERS[L] = LETTERS[L] || []).push(p); });
  var letterKeys = Object.keys(LETTERS).sort(function (a, b) { return a === "#" ? 1 : b === "#" ? -1 : a.localeCompare(b); });
  letterKeys.forEach(function (L) { LETTERS[L].sort(function (a, b) { return a.name.localeCompare(b.name); }); });
  var years = D.cveYears.map(function (y) {
    var t = [0, 0, 0, 0, 0];
    y.months.slice(0, 12).forEach(function (m) { for (var k = 0; k < 5; k++) t[k] += m[k] || 0; });
    return { year: y.year, t: t, months: y.months.slice(0, 12) };
  }).filter(function (y) { return y.t[4] > 0; });
  var cveList = (D.cveList || []).slice();
  function progsForClass(id) {
    return programs.map(function (p) { var h = p.classes.filter(function (x) { return x[0] === id; })[0]; return h ? { p: p, n: h[1] } : null; })
      .filter(Boolean).sort(function (a, b) { return b.n - a.n; });
  }
  function linksFor(id) {
    return D.links.filter(function (l) { return l[0] === id || l[1] === id; }).map(function (l) { return { c: byId[l[0] === id ? l[1] : l[0]], n: l[2] }; }).filter(function (x) { return x.c; });
  }
  function similar(p, n) {
    var va = {}; p.classes.forEach(function (x) { va[x[0]] = x[1]; });
    var na = Math.sqrt(sum(p.classes.map(function (x) { return x[1] * x[1]; })));
    return programs.filter(function (q) { return q !== p && q.classes.length; }).map(function (q) {
      var dot = 0; q.classes.forEach(function (x) { dot += (va[x[0]] || 0) * x[1]; });
      var nb = Math.sqrt(sum(q.classes.map(function (x) { return x[1] * x[1]; })));
      return { q: q, s: na && nb ? dot / (na * nb) : 0 };
    }).sort(function (a, b) { return b.s - a.s || b.q.count - a.q.count; }).slice(0, n);
  }

  // ---------- chrome: brand cog, background dial, nav ----------
  (function contours() { // background: slow topographic contour lines
    var s = '<g class="rot">';
    for (var n = 0; n < 7; n++) {
      var R = 150 + n * 46, d = "";
      for (var k = 0; k <= 120; k++) {
        var a = k / 120 * Math.PI * 2, r = R + 14 * Math.sin(3 * a + n * 0.8) + 8 * Math.sin(5 * a - n * 0.5);
        d += (k ? "L" : "M") + f1(440 + r * Math.cos(a)) + "," + f1(440 + r * Math.sin(a));
      }
      s += '<path d="' + d + 'Z" fill="none" stroke="' + (n % 3 === 2 ? "#24404a" : "#16232d") + '" stroke-width="' + (n % 3 === 2 ? 1.3 : 1) + '"' + (n % 2 ? ' stroke-dasharray="2 6"' : "") + "/>";
    }
    s += '<circle cx="440" cy="440" r="3" fill="#24404a"/></g>';
    $("dialbg").setAttribute("viewBox", "0 0 880 880"); $("dialbg").innerHTML = s;
  })();
  var nav = $("nav");
  function setNav(items, active) {
    var sig = items.map(function (i) { return i.k; }).join();
    if (nav.dataset.sig !== sig) {
      nav.innerHTML = '<span class="thumb"></span>' + items.map(function (it) {
        return it.href ? '<a href="' + it.href + '" data-k="' + it.k + '">' + it.label + "</a>" : '<button type="button" data-k="' + it.k + '">' + it.label + "</button>";
      }).join("");
      nav.dataset.sig = sig;
    }
    nav.querySelectorAll("[data-k]").forEach(function (el) { var on = el.dataset.k === active; el.classList.toggle("on", on); if (on) el.setAttribute("aria-current", "page"); else el.removeAttribute("aria-current"); });
    placeThumb();
  }
  function placeThumb() {
    var on = nav.querySelector(".on"), th = nav.querySelector(".thumb");
    if (!th) return;
    if (!on) { th.style.width = "0"; return; }
    th.style.left = on.offsetLeft + "px"; th.style.width = on.offsetWidth + "px";
  }
  window.addEventListener("resize", placeThumb);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeThumb);
  var PAGE_NAV = [{ k: "map", label: "Atlas", href: "#/" }, { k: "browse", label: "Index", href: "#/browse" }, { k: "bypasses", label: "Evasions", href: "#/bypasses" }, { k: "payloads", label: "Payloads", href: "#/payloads" }, { k: "cves", label: "CVEs", href: "#/cves" }];
  var MAP_NAV = [{ k: "vuln", label: "Classes" }, { k: "programs", label: "Programs" }, { k: "cves", label: "CVEs" }];
  nav.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-k]");
    if (b && MAP) MAP.setMode(b.dataset.k, true);
  });

  // ================= MAP =================
  var MAP = null;
  var R0 = 196, RMAX = 112, RING = 332, RLABEL = 352;

  // Lay groups out around the circle; each item becomes a strip of parallel lines.
  function layout(groups) {
    var gapI = 2.4, gapG = 15, C = Math.PI * 2 * R0;
    var nI = sum(groups.map(function (g) { return g.items.length; }));
    var total = function () { return sum(groups.map(function (g) { return sum(g.items.map(function (it) { return it.lines; })); })); };
    var T = total(), sp = (C - nI * gapI - groups.length * gapG) / T;
    if (sp < 1) {
      groups.forEach(function (g) { g.items.forEach(function (it) { it.lines = Math.max(1, Math.round(it.lines * sp)); }); });
      T = total(); sp = (C - nI * gapI - groups.length * gapG) / T;
    }
    sp = Math.min(sp, 1.9);
    var used = T * sp + nI * gapI, extra = (C - used) / groups.length;
    var first = sum(groups[0].items.map(function (it) { return it.lines * sp + gapI; }));
    var a = -Math.PI / 2 - first / 2 / R0;
    groups.forEach(function (g) {
      g.a0 = a;
      g.items.forEach(function (it) {
        var w = it.lines * sp;
        it.w = w; it.ang = a + (w / 2 + gapI / 2) / R0;
        a += (w + gapI) / R0;
      });
      g.a1 = a; g.mid = (g.a0 + g.a1) / 2;
      a += extra / R0;
    });
    return sp;
  }
  function noise(i, j) { return 0.5 + 0.5 * Math.sin(i * 0.37 + j * 1.7) * Math.cos(i * 0.11 + j * 0.53); }

  var LABEL_GAP = 30;
  // Push labels apart vertically on each side so they never overlap, then hang them off the ring.
  function placeLabels(groups) {
    [1, -1].forEach(function (side) {
      var ls = groups.filter(function (g) { var c = Math.cos(g.mid); return side > 0 ? c >= 0 : c < 0; })
        .map(function (g) { return { g: g, y: RLABEL * Math.sin(g.mid) }; }).sort(function (a, b) { return a.y - b.y; });
      for (var i = 1; i < ls.length; i++) ls[i].y = Math.max(ls[i].y, ls[i - 1].y + LABEL_GAP);
      var lim = RLABEL + 40;
      if (ls.length && ls[ls.length - 1].y > lim) { ls[ls.length - 1].y = lim; for (var k = ls.length - 2; k >= 0; k--) ls[k].y = Math.min(ls[k].y, ls[k + 1].y - LABEL_GAP); }
      ls.forEach(function (l) {
        var r = RLABEL + 6, x = Math.sqrt(Math.max(r * r - l.y * l.y, 0));
        l.g.lx = side * Math.max(x, 24); l.g.ly = l.y; l.g.side = side;
      });
    });
  }

  function renderGroups(groups, sp, maxCount) {
    var out = "", maxLog = Math.log(maxCount + 1);
    placeLabels(groups);
    groups.forEach(function (g, gi) {
      var rh = 132 + (gi % 3) * 11, hub = polar(rh, g.mid);
      g.hub = hub; g.rh = rh;
      var fans = "", strips = "";
      g.items.forEach(function (it, j) {
        var u = [Math.cos(it.ang), Math.sin(it.ang)], v = [-u[1], u[0]], B = [R0 * u[0], R0 * u[1]];
        var Lw = RMAX * (0.22 + 0.78 * Math.log(it.count + 1) / maxLog), lines = "", maxLen = 0;
        for (var k = 0; k < it.lines; k++) {
          var o = (k - (it.lines - 1) / 2) * sp, len = Lw * (0.6 + 0.4 * noise(k + gi * 7, j));
          maxLen = Math.max(maxLen, len);
          var x0 = B[0] + o * v[0], y0 = B[1] + o * v[1];
          lines += '<line x1="' + f1(x0) + '" y1="' + f1(y0) + '" x2="' + f1(x0 + len * u[0]) + '" y2="' + f1(y0 + len * u[1]) + '"/>';
        }
        var hw = it.w / 2 + 1.5, e = maxLen + 4;
        var poly = [[-hw, -4], [hw, -4], [hw, e], [-hw, e]].map(function (q) { return f1(B[0] + q[0] * v[0] + q[1] * u[0]) + "," + f1(B[1] + q[0] * v[1] + q[1] * u[1]); }).join(" ");
        strips += '<g class="strip" data-g="' + gi + '" data-j="' + j + '">' + lines + '<polygon class="hit" points="' + poly + '"/></g>';
        var nf = it.lines > 12 ? 5 : it.lines > 4 ? 3 : 1;
        for (var q = 0; q < nf; q++) {
          var off = nf === 1 ? 0 : (q / (nf - 1) - 0.5) * it.w;
          var P = [B[0] + off * v[0] - 2 * u[0], B[1] + off * v[1] - 2 * u[1]];
          var c1 = polar(rh + 28, g.mid), c2 = [P[0] - 26 * u[0], P[1] - 26 * u[1]];
          var L2 = Math.round(Math.hypot(P[0] - hub[0], P[1] - hub[1]) * 1.3);
          fans += '<path class="fan" style="--len:' + L2 + ";--d:" + (gi * 45 + j * 6) + '" d="M' + f1(hub[0]) + "," + f1(hub[1]) + "C" + f1(c1[0]) + "," + f1(c1[1]) + " " + f1(c2[0]) + "," + f1(c2[1]) + " " + f1(P[0]) + "," + f1(P[1]) + '"/>';
        }
      });
      var hubSvg = '<g class="hub" data-g="' + gi + '"><circle class="r" cx="' + f1(hub[0]) + '" cy="' + f1(hub[1]) + '" r="11"/><circle class="o" cx="' + f1(hub[0]) + '" cy="' + f1(hub[1]) + '" r="6.5"/><circle class="i" cx="' + f1(hub[0]) + '" cy="' + f1(hub[1]) + '" r="2"/><circle class="hit" cx="' + f1(hub[0]) + '" cy="' + f1(hub[1]) + '" r="16"/></g>';
      var anchor = g.side > 0 ? "start" : "end", rp = polar(RING + 9, g.mid), lx = g.lx, ly = g.ly;
      var label = '<g class="lbl" data-g="' + gi + '"><path class="leader" d="M' + f1(rp[0]) + "," + f1(rp[1]) + "L" + f1(lx - g.side * 4) + "," + f1(ly) + '"/>' +
        '<text x="' + f1(lx) + '" y="' + f1(ly) + '" text-anchor="' + anchor + '" dy="-.2em">' + esc(g.label) + '</text><text class="sub" x="' + f1(lx) + '" y="' + f1(ly) + '" text-anchor="' + anchor + '" dy="1em">' + esc(g.sub) + "</text></g>";
      out += '<g class="g" data-g="' + gi + '" style="--i:' + gi + '">' + fans + strips + hubSvg + label + "</g>";
    });
    return out;
  }

  function ringSvg() {
    var s = '<circle class="ring" r="' + RING + '"/><circle class="ring" r="' + (R0 - 10) + '" style="stroke-dasharray:1 5"/>';
    for (var i = 0; i < 240; i++) {
      var a = i / 240 * Math.PI * 2, big = i % 10 === 0, p0 = polar(RING, a), p1 = polar(RING + (big ? 7 : 3), a);
      s += '<line class="tick" x1="' + f1(p0[0]) + '" y1="' + f1(p0[1]) + '" x2="' + f1(p1[0]) + '" y2="' + f1(p1[1]) + '"/>';
    }
    var seen = {}, ids = cveList.map(function (c) { return c.id; }).concat((D.cveRing || []).map(function (c) { return c.id; }))
      .filter(function (x) { if (seen[x]) return false; seen[x] = 1; return true; });
    var r = RING - 6;
    s += '<path id="ringPath" d="M0,-' + r + "A" + r + "," + r + " 0 1 1 -0.01,-" + r + '" fill="none"/>';
    s += '<text class="ringtext"><textPath href="#ringPath">' + esc(ids.join("   ·   ")) + "</textPath></text>";
    return s;
  }

  function buildVuln() {
    var maxW = 0;
    var groups = classes.map(function (c) {
      return {
        key: c.id, label: c.name.length > 30 ? c.name.slice(0, 28) + "…" : c.name, sub: fmt(c.count) + " reports", ref: c,
        items: c.weaknesses.map(function (w) { maxW = Math.max(maxW, w.count); return { count: w.count, lines: clamp(Math.round(Math.sqrt(w.count) * 0.75), 1, 26), ref: w }; })
      };
    });
    var sp = layout(groups), body = renderGroups(groups, sp, maxW);
    var maxL = D.links[0][2], links = "", sparks = "", hubOf = {};
    groups.forEach(function (g) { hubOf[g.key] = g.hub; });
    D.links.forEach(function (l, li) {
      var a = hubOf[l[0]], b = hubOf[l[1]]; if (!a || !b) return;
      var m = [(a[0] + b[0]) * 0.18, (a[1] + b[1]) * 0.18];
      links += '<path class="link" id="lk' + li + '" data-a="' + l[0] + '" data-b="' + l[1] + '" d="M' + f1(a[0]) + "," + f1(a[1]) + "Q" + f1(m[0]) + "," + f1(m[1]) + " " + f1(b[0]) + "," + f1(b[1]) + '" stroke-width="' + (0.5 + 2.6 * l[2] / maxL).toFixed(2) + '"/>';
      if (li < 18 && !REDUCED) {
        sparks += '<circle class="spark" r="2.1"><animateMotion dur="' + (7 + (li % 5) * 2.3).toFixed(1) + 's" repeatCount="indefinite" begin="' + (li * 0.7).toFixed(1) + 's" keyPoints="' + (li % 2 ? "0;1" : "1;0") + '" keyTimes="0;1" calcMode="linear"><mpath href="#lk' + li + '"/></animateMotion></circle>';
      } else if (li < 30) {
        var t = 0.3 + (li % 4) * 0.12, pt = [(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * m[0] + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * m[1] + t * t * b[1]];
        sparks += '<circle class="spark" r="2" cx="' + f1(pt[0]) + '" cy="' + f1(pt[1]) + '"/>';
      }
    });
    var orbit = '<g class="orbit">', top = programs.slice().sort(function (a, b) { return b.count - a.count; }).slice(0, 10);
    top.forEach(function (p, i) {
      var side = i % 2 ? 1 : -1, k = Math.floor(i / 2), ang = (side < 0 ? Math.PI : 0) + (k - 2) * 0.2 * (side < 0 ? -1 : 1);
      var pt = polar(505 + (k % 2) * 22, ang);
      var ini = p.name.replace(/[^A-Za-z0-9 ]/g, "").split(/\s+/).filter(Boolean).map(function (w) { return w[0]; }).join("").slice(0, 2).toUpperCase();
      orbit += '<g data-p="' + p.idx + '" transform="translate(' + f1(pt[0]) + "," + f1(pt[1]) + ')"><circle class="p" r="13"/><text text-anchor="middle" dy=".35em" style="font-size:calc(var(--fs,11)*.8px)">' + esc(ini) + '</text><text class="pn sub" text-anchor="middle" y="28">' + esc(p.name) + "</text></g>";
    });
    return { groups: groups, svg: links + body + sparks + '<g class="marks"></g>' + orbit + "</g>" };
  }
  function buildPrograms() {
    var maxC = 0;
    var groups = letterKeys.map(function (L) {
      var ps = LETTERS[L];
      return { key: L, label: L, sub: ps.length + (ps.length === 1 ? " program" : " programs"), items: ps.map(function (p) { maxC = Math.max(maxC, p.count); return { count: p.count, lines: clamp(Math.round(Math.sqrt(p.count) * 0.8), 1, 24), ref: p }; }) };
    });
    var sp = layout(groups);
    return { groups: groups, svg: renderGroups(groups, sp, maxC) };
  }
  function buildCves() {
    var maxC = 0;
    var groups = years.map(function (y) {
      var items = [];
      y.months.forEach(function (m, mi) { if (m[4] > 0) { maxC = Math.max(maxC, m[4]); items.push({ count: m[4], lines: clamp(Math.round(Math.log2(m[4] + 1) * 1.5), 1, 26), month: mi, m: m, year: y.year }); } });
      return { key: String(y.year), label: String(y.year), sub: fmt(y.t[4]) + " CVEs", yr: y, items: items };
    });
    var sp = layout(groups), body = renderGroups(groups, sp, maxC), dots = "", gOf = {};
    groups.forEach(function (g) { gOf[g.key] = g; });
    var perYear = {};
    cveList.forEach(function (c) { var y = c.id.split("-")[1]; perYear[y] = (perYear[y] || 0) + 1; });
    var seenY = {};
    cveList.forEach(function (c, i) {
      var y = c.id.split("-")[1], g = gOf[y] || groups[groups.length - 1], n = perYear[y] || 1, k = seenY[y] = (seenY[y] || 0) + 1;
      var spread = Math.min(1.1, 0.12 * n), a = g.mid + (n === 1 ? 0 : ((k - 1) / (n - 1) - 0.5) * spread) + (noise(i, 3) - 0.5) * 0.06;
      var p = polar(62 + noise(i, 9) * 92 + (k % 3) * 9, a);
      dots += '<circle class="xdot" data-cve="' + i + '" cx="' + f1(p[0]) + '" cy="' + f1(p[1]) + '" r="' + (c.sev >= 4 ? 3 : 2.3) + '"/>';
    });
    return { groups: groups, svg: body + dots };
  }

  function viewMap(params) {
    document.body.classList.add("on-map");
    app.innerHTML = '<div class="maproot"><svg class="map" id="map" role="img" aria-label="Interactive map. Drag to pan, scroll to zoom, click a node to open it."><g>' + ringSvg() + '</g><g class="mode" id="m-vuln"></g><g class="mode off" id="m-programs"></g><g class="mode off" id="m-cves"></g></svg></div>' +
      '<section class="hero" id="hero"></section><div class="stats" id="stats"></div>' +
      '<div class="zoomkeys"><button type="button" data-z="in" title="Zoom in (+)" aria-label="Zoom in">+</button><button type="button" data-z="out" title="Zoom out (−)" aria-label="Zoom out">−</button><button type="button" data-z="reset" title="Reset view (0)" aria-label="Reset view">⟲</button></div>' +
      '<aside class="panel" id="panel" aria-hidden="true"></aside>';
    var svg = $("map"), panel = $("panel");
    var built = {}, S = { mode: null, sel: null, item: null, mark: null, hover: null };
    var view = { cx: 0, cy: 0, k: 1 }, base = { cx: 0, cy: 0, k: 1 }, anim = null;

    function ensure(mode) {
      if (built[mode]) return built[mode];
      var b = mode === "vuln" ? buildVuln() : mode === "programs" ? buildPrograms() : buildCves();
      $("m-" + mode).innerHTML = b.svg; built[mode] = b; return b;
    }
    function size() { return { W: svg.clientWidth || innerWidth, H: svg.clientHeight || innerHeight }; }
    function measure() {
      var z = size(), small = z.W < 900, top = small ? 60 : 76, bottom = small ? 150 : 70;
      var availH = z.H - top - bottom, k0 = Math.min(availH / (2 * 405), (z.W * 0.98) / (2 * (z.W < 560 ? 345 : small ? 500 : 560)));
      base = { k: k0, cx: 0, cy: (z.H / 2 - (top + availH / 2)) / k0 };
      LABEL_GAP = Math.max(24, 2.45 * 11 / k0);
      return z;
    }
    function apply() {
      var z = size(), vw = z.W / view.k, vh = z.H / view.k;
      svg.setAttribute("viewBox", f1(view.cx - vw / 2) + " " + f1(view.cy - vh / 2) + " " + f1(vw) + " " + f1(vh));
      svg.style.setProperty("--fs", (11 / view.k).toFixed(3));
    }
    function animateTo(t, dur) {
      if (anim) cancelAnimationFrame(anim);
      if (REDUCED || dur === 0) { view = { cx: t.cx, cy: t.cy, k: t.k }; apply(); return; }
      var s = { cx: view.cx, cy: view.cy, k: view.k }, t0 = performance.now(); dur = dur || 750;
      (function stepA(now) {
        var x = Math.min(1, (now - t0) / dur), e = x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
        view = { cx: s.cx + (t.cx - s.cx) * e, cy: s.cy + (t.cy - s.cy) * e, k: Math.exp(Math.log(s.k) + (Math.log(t.k) - Math.log(s.k)) * e) }; apply();
        if (x < 1) anim = requestAnimationFrame(stepA);
      })(t0);
    }
    function home(d) { measure(); animateTo(base, d); }
    function focusAngle(ang, zoom) {
      var z = measure(), k = base.k * (zoom || 1.75), P = polar(255, ang), t = { k: k, cx: P[0], cy: P[1] };
      if (z.W >= 900) t.cx += 215 / k; else t.cy += (z.H * 0.35) / k;
      animateTo(t);
    }
    function onResize() { if (S.sel == null) { measure(); view = { cx: base.cx, cy: base.cy, k: base.k }; } apply(); }
    window.addEventListener("resize", onResize);

    // ----- hero + stats -----
    function renderHero() {
      var mk = S.mark != null ? programs[S.mark] : null;
      var h = { vuln: "Where bugs cluster, and how they were found.", programs: "Every disclosing program, A to Z.", cves: "Two decades of CVEs, year by year." }[S.mode];
      var p = {
        vuln: fmt(D.total) + " public HackerOne disclosures from " + fmt(D.programs) + " programs, charted by class and weakness. Pick any node to drill in.",
        programs: "Letters form the hubs and every program is a bundle of lines. Open one to read its bug profile.",
        cves: "Years form the hubs and months the bundles. The pink dots inside are CVEs confirmed as exploited."
      }[S.mode];
      $("hero").innerHTML = "<h1>" + h + "</h1><p>" + p + '</p><p class="act"><button class="u" data-h="explore">Start exploring</button> or <button class="u" data-h="search">search everything.</button></p>' +
        '<p class="links"><a class="u" href="#/browse">Index</a><a class="u" href="#/bypasses">Evasions</a><a class="u" href="#/payloads">Payloads</a><a class="u" href="#/cves">CVEs</a><a class="u" href="#/about">About</a></p>' +
        (mk ? '<div class="crumbs mono">Highlighting <b>' + esc(mk.name) + '</b> · <button class="u" data-h="unmark">clear</button></div>' : "");
    }
    function renderStats() {
      var items, note, ul = ' style="text-decoration:underline;text-decoration-color:var(--line);text-underline-offset:2px"';
      if (S.mode === "vuln") {
        items = ['<div class="stat"><b>' + fmt(D.total) + "</b><span>reports</span></div>", '<div class="stat"><b>' + classes.length + "</b><span>classes</span></div>",
          '<a class="stat" href="#/browse" style="text-decoration:none"><b>' + allWeak.length + "</b><span" + ul + ">weaknesses</span></a>",
          '<button class="stat" data-mode="programs"><b>' + fmt(D.programs) + "</b><span>programs</span></button>", '<div class="stat"><b>' + money(D.totalBounty) + "</b><span>in bounties</span></div>"];
        note = "Bundles are weaknesses; every line stands for a batch of reports. Arcs across the centre link classes that often appear together.";
      } else if (S.mode === "programs") {
        items = ['<div class="stat"><b>' + fmt(programs.length) + "</b><span>programs</span></div>", '<div class="stat"><b>' + fmt(D.total) + "</b><span>reports</span></div>", '<div class="stat"><b>' + letterKeys.length + "</b><span>letters</span></div>",
          '<button class="stat" data-mode="vuln"><b>' + classes.length + "</b><span>classes</span></button>"];
        note = "Bundles are programs; every line stands for a batch of their reports. Open one to highlight it on the class view.";
      } else {
        var cf = D.cveFacts || [];
        items = cf.slice(0, 3).map(function (f, i) { return '<div class="stat"><b' + (i === 2 ? ' style="color:var(--red)"' : "") + ">" + fmt(f[0]) + "</b><span>" + esc(f[1].replace("known to be ", "")) + "</span></div>"; });
        items.push('<a class="stat" href="#/cves" style="text-decoration:none"><b>' + cveList.length + "</b><span" + ul + ">confirmed exploited</span></a>");
        note = "Bundles are months and grow with volume. Dots mark CVEs confirmed as exploited.";
      }
      $("stats").style.setProperty("--n", items.length);
      $("stats").innerHTML = items.join("") + "<p>" + note + "</p>";
    }
    $("hero").addEventListener("click", function (e) {
      var b = e.target.closest("[data-h]"); if (!b) return;
      if (b.dataset.h === "explore") selectGroup(S.mode === "vuln" ? byCount[0].idx : G().length - 1);
      else if (b.dataset.h === "search") openSearch();
      else if (b.dataset.h === "unmark") setMark(null);
    });
    $("stats").addEventListener("click", function (e) { var b = e.target.closest("[data-mode]"); if (b) setMode(b.dataset.mode, true); });

    // ----- modes -----
    function setMode(mode, push) {
      if (!/^(vuln|programs|cves)$/.test(mode)) mode = "vuln";
      setNav(MAP_NAV, mode);
      if (S.mode === mode) return;
      S.mode = mode; ensure(mode);
      ["vuln", "programs", "cves"].forEach(function (m) { $("m-" + m).classList.toggle("off", m !== mode); });
      closePanel(true); S.hover = null; hideTip(); paint();
      renderHero(); renderStats();
      if (push) history.replaceState(null, "", mode === "vuln" ? "#/" : "#/?mode=" + mode);
      home(450);
    }
    function G() { return built[S.mode].groups; }
    function layer() { return $("m-" + S.mode); }

    // ----- highlight -----
    function paint() {
      if (!S.mode) return;
      var on = S.hover != null ? S.hover : S.sel;
      svg.classList.toggle("hov", on != null);
      layer().querySelectorAll(".g").forEach(function (g) { var i = +g.dataset.g; g.classList.toggle("on", i === on || i === S.sel); });
      if (S.mode === "vuln") {
        var key = on != null ? G()[on].key : null;
        layer().querySelectorAll(".link").forEach(function (l) { l.classList.toggle("on", key != null && (l.dataset.a === key || l.dataset.b === key)); });
      }
      layer().querySelectorAll(".strip.sel,.strip.dim").forEach(function (s) { s.classList.remove("sel", "dim"); });
      if (S.sel != null && S.item != null) layer().querySelectorAll('.strip[data-g="' + S.sel + '"]').forEach(function (s) { s.classList.add(+s.dataset.j === S.item ? "sel" : "dim"); });
    }

    // ----- mark a program on the vulnerability map -----
    function setMark(pi) {
      S.mark = pi; ensure("vuln");
      var lv = $("m-vuln"), mk = lv.querySelector(".marks"), gs = built.vuln.groups;
      lv.querySelectorAll(".strip.mk").forEach(function (s) { s.classList.remove("mk"); });
      mk.innerHTML = "";
      if (pi != null) {
        var p = programs[pi], max = p.classes.length ? p.classes[0][1] : 1;
        p.classes.forEach(function (x) {
          var gi = gs.map(function (g) { return g.key; }).indexOf(x[0]); if (gi < 0) return;
          var g = gs[gi];
          mk.insertAdjacentHTML("beforeend", '<circle class="mark" cx="' + f1(g.hub[0]) + '" cy="' + f1(g.hub[1]) + '" r="' + f1(12 + 16 * Math.sqrt(x[1] / max)) + '"><title>' + esc(p.name + ": " + x[1] + " " + x[0]) + "</title></circle>");
          lv.querySelectorAll('.strip[data-g="' + gi + '"]').forEach(function (s) { s.classList.add("mk"); });
        });
      }
      renderHero();
    }

    // ----- panel -----
    function openPanel(html) {
      panel.innerHTML = html; panel.scrollTop = 0;
      panel.classList.add("open"); panel.setAttribute("aria-hidden", "false"); document.body.classList.add("panel-open");
    }
    function closePanel(silent) {
      S.sel = null; S.item = null;
      panel.classList.remove("open"); panel.setAttribute("aria-hidden", "true"); document.body.classList.remove("panel-open");
      paint(); if (!silent) home();
    }
    function head(crumbs, nav2) {
      return '<div class="phead"><span class="crumb">' + crumbs.map(function (c) { return c.act ? '<button class="c" data-act="' + c.act + '">' + esc(c.t) + "</button>" : "<span>" + esc(c.t) + "</span>"; }).join("<span>/</span>") +
        '</span><span class="pbtns">' + (nav2 === false ? "" : '<button data-act="prev" title="Previous (←)" aria-label="Previous">←</button><button data-act="next" title="Next (→)" aria-label="Next">→</button>') + '<button data-act="close" title="Close (Esc)" aria-label="Close">✕</button></span></div>';
    }
    function facts(list) { return '<div class="facts">' + list.map(function (f) { return "<div" + (f[2] ? ' class="hot"' : "") + "><b>" + f[0] + "</b><span>" + f[1] + "</span></div>"; }).join("") + "</div>"; }
    function panelClass(c) {
      var ws = c.weaknesses.slice().sort(function (a, b) { return b.count - a.count; }), maxW = ws.length ? ws[0].count : 1;
      var lk = linksFor(c.id), pr = progsForClass(c.id).slice(0, 8);
      return head([{ t: "Classes", act: "close" }, { t: c.id }]) + '<div class="pbody"><h2 class="t">' + esc(c.name) + '</h2><p class="desc">#' + (c.rank + 1) + " of " + classes.length + " classes · " + ws.length + " weaknesses</p>" +
        facts([[fmt(c.count), "reports"], [money(c.bounty), "in bounties"], [money(c.avg), "per report"], [pct(c.count / D.total), "of all reports"]]) +
        "<div><h2>Weaknesses</h2>" + ws.map(function (x, i) { return row(null, esc(x.name), x.count, maxW, i, ' data-wk="' + x.j + '"'); }).join("") + "</div>" +
        (lk.length ? "<div><h2>Often paired with</h2>" + lk.map(function (x, i) { return row(null, esc(x.c.name), x.n, lk[0].n, i, ' data-cls="' + x.c.idx + '"'); }).join("") + "</div>" : "") +
        (pr.length ? "<div><h2>Top programs</h2>" + pr.map(function (x, i) { return row(null, esc(x.p.name), x.n, pr[0].n, i, ' data-prog="' + x.p.idx + '"'); }).join("") + "</div>" : "") +
        '<div class="acts" style="margin-top:28px"><a class="btn pri" href="#/class/' + enc(c.id) + '">Open as a page</a><a class="btn" href="#/payloads">Payloads</a></div></div>';
    }
    function panelWeak(c, w) {
      var sc = sevCounts(w.sev), tot = sum(sc), mx = Math.max.apply(null, sc.concat([1]));
      return head([{ t: "Classes", act: "close" }, { t: c.id, act: "back" }, { t: "weakness" }]) + '<div class="pbody"><h2 class="t">' + esc(w.name) + '</h2><p class="desc">' + esc(c.name) + " · " + sevDots(w.lvl) + " usually " + (w.lvl ? SEVN[w.lvl].toLowerCase() : "unrated") + "</p>" +
        facts([[fmt(w.count), "reports"], [money(w.bounty), "in bounties"], [money(w.count ? w.bounty / w.count : 0), "per report"], [pct(w.count / c.count), "of " + c.id]]) +
        (tot ? "<div><h2>Severity of " + fmt(tot) + " rated reports</h2>" + [4, 3, 2, 1, 0].map(function (k, i) { return row(null, sevDots(k) + " &nbsp;" + SEVN[k], sc[k], mx, i); }).join("") + "</div>" : '<p class="desc" style="margin-top:20px">No severity breakdown in this snapshot.</p>') +
        '<div class="acts" style="margin-top:28px"><a class="btn pri" href="#/class/' + enc(c.id) + "?w=" + enc(w.name) + '">Open on the class page</a><button class="btn" data-act="back">← ' + esc(c.id) + "</button></div></div>";
    }
    function panelProgram(p, inLetter) {
      var max = p.classes.length ? p.classes[0][1] : 1, sim = similar(p, 5), L = letterOf(p.name);
      return head([{ t: "Programs", act: "toPrograms" }, { t: L, act: inLetter ? "back" : "toLetter", }, { t: p.name.length > 18 ? p.name.slice(0, 16) + "…" : p.name }], inLetter) +
        '<div class="pbody"><h2 class="t">' + esc(p.name) + '</h2><p class="desc">#' + (p.idx + 1) + " of " + programs.length + " programs by reports</p>" +
        facts([[fmt(p.count), "reports"], [money(p.bounty), "in bounties"], [money(p.count ? p.bounty / p.count : 0), "per report"]]) +
        '<div class="acts" style="margin-top:18px"><button class="btn pri" data-act="mark" data-p="' + p.idx + '">' + (S.mark === p.idx ? "Highlighted on the class view ✓" : "Highlight on the class view") + '</button><a class="btn" href="#/program/' + p.idx + '">Open as a page</a></div>' +
        (p.classes.length ? "<div><h2>Bug profile by class</h2>" + p.classes.map(function (x, i) { var c = byId[x[0]]; return row(null, esc(c ? c.name : x[0]), x[1], max, i, c ? ' data-gocls="' + c.idx + '"' : ""); }).join("") + "</div>" : "") +
        (sim.length ? "<div><h2>Programs with a similar profile</h2>" + sim.map(function (s, i) { return row(null, esc(s.q.name), s.s, 1, i, ' data-prog="' + s.q.idx + '"', Math.round(s.s * 100) + "%"); }).join("") + "</div>" : "") + "</div>";
    }
    function panelLetter(g) {
      var ps = g.items.map(function (it) { return it.ref; }), max = Math.max.apply(null, ps.map(function (p) { return p.count; }));
      return head([{ t: "Programs", act: "close" }, { t: g.key }]) + '<div class="pbody"><h2 class="t">' + esc(g.key) + '</h2><p class="desc">' + ps.length + " programs · " + fmt(sum(ps.map(function (p) { return p.count; }))) + " reports</p>" +
        "<div><h2>Programs</h2>" + ps.map(function (p, i) { return row(null, esc(p.name), p.count, max, i, ' data-item="' + i + '"'); }).join("") + "</div></div>";
    }
    function cvesIn(year, month) { return cveList.filter(function (c) { return +c.listed.slice(0, 4) === year && (month == null || +c.listed.slice(5, 7) - 1 === month); }); }
    function cveRows(list) {
      return list.map(function (c, i) { return '<button type="button" class="row" data-cve="' + cveList.indexOf(c) + '" style="grid-template-columns:30px minmax(0,1fr) auto;--i:' + i + '"><span>' + sevDots(c.sev) + '</span><span class="nm">' + esc(c.name) + '</span><span class="num">' + (c.cvss != null ? c.cvss : "–") + "</span></button>"; }).join("");
    }
    function panelYear(g) {
      var y = g.yr, max = Math.max.apply(null, y.months.map(function (m) { return m[4]; }).concat([1])), ex = cvesIn(y.year);
      return head([{ t: "CVEs", act: "close" }, { t: String(y.year) }]) + '<div class="pbody"><h2 class="t">' + y.year + '</h2><p class="desc">' + fmt(y.t[4]) + " CVEs published</p>" +
        facts([[fmt(y.t[0]), "critical"], [fmt(y.t[1]), "high"], [fmt(y.t[2]), "medium"], [fmt(y.t[3]), "low"]]) +
        "<div><h2>By month</h2>" + y.months.map(function (m, i) { return m[4] ? row(null, MONTHS[i] + " " + y.year, m[4], max, i, ' data-month="' + i + '"') : ""; }).join("") + "</div>" +
        (ex.length ? "<div><h2>Confirmed exploited</h2>" + cveRows(ex) + "</div>" : "") + "</div>";
    }
    function panelMonth(it) {
      var m = it.m, mx = Math.max(m[0], m[1], m[2], m[3], 1), ex = cvesIn(it.year, it.month);
      return head([{ t: "CVEs", act: "close" }, { t: String(it.year), act: "back" }, { t: MONTHS[it.month] }]) + '<div class="pbody"><h2 class="t">' + MONTHS[it.month] + " " + it.year + '</h2><p class="desc">' + fmt(m[4]) + " CVEs published</p>" +
        "<div><h2>Bands</h2>" + ["Critical", "High", "Medium", "Low"].map(function (b, i) { return row(null, sevDots(4 - i) + " &nbsp;" + b, m[i] || 0, mx, i); }).join("") + "</div>" +
        (ex.length ? "<div><h2>Confirmed exploited</h2>" + cveRows(ex) + "</div>" : '<p class="desc" style="margin-top:24px">No exploited CVEs from this month in the snapshot.</p>') + "</div>";
    }
    function panelCve(c) {
      return head([{ t: "CVEs", act: "close" }, { t: c.id }], false) + '<div class="pbody"><h2 class="t">' + esc(c.name) + '</h2><p class="desc">' + sevDots(c.sev) + " " + SEVN[c.sev].toLowerCase() + " · " + esc(c.id) + "</p>" +
        facts([[c.cvss != null ? c.cvss : "–", "CVSS"], [c.epss != null ? c.epss + "%" : "–", "likely to be exploited", true], [esc(c.listed), "confirmed exploited"]]) +
        (c.ransom ? '<p class="desc" style="margin-top:14px">Known to be used by ransomware.</p>' : "") +
        '<div class="acts" style="margin-top:24px"><button class="btn pri" data-act="copy" data-id="' + esc(c.id) + '">Copy ID</button><a class="btn" href="#/cves">CVE tracker</a></div></div>';
    }

    // ----- selection -----
    function selectGroup(gi, item, noZoom) {
      var g = G()[gi]; if (!g) return;
      S.sel = gi; S.item = item == null ? null : item; S.hover = null; hideTip();
      var html;
      if (S.mode === "vuln") html = item == null ? panelClass(g.ref) : panelWeak(g.ref, g.ref.weaknesses[item]);
      else if (S.mode === "programs") html = item == null ? panelLetter(g) : panelProgram(g.items[item].ref, true);
      else html = item == null ? panelYear(g) : panelMonth(g.items[item]);
      openPanel(html); paint();
      if (!noZoom) focusAngle(item == null ? g.mid : g.items[item].ang, item == null ? 1.7 : 2.3);
    }
    function showProgram(pi) { openPanel(panelProgram(programs[pi], false)); }
    function step(d) { var n = G().length; selectGroup(S.sel == null ? (d > 0 ? 0 : n - 1) : (S.sel + d + n) % n); }

    panel.addEventListener("click", function (e) {
      var t = e.target.closest("[data-act],[data-wk],[data-cls],[data-prog],[data-gocls],[data-item],[data-month],[data-cve]");
      if (!t) return;
      var a = t.dataset.act;
      if (a === "close") closePanel();
      else if (a === "prev") step(-1);
      else if (a === "next") step(1);
      else if (a === "back") selectGroup(S.sel, null);
      else if (a === "mark") {
        var pi = +t.dataset.p; setMark(S.mark === pi ? null : pi);
        t.textContent = S.mark === pi ? "Highlighted on the class view ✓" : "Highlight on the class view";
        if (S.mark === pi && S.mode !== "vuln") { toast("Highlighting " + programs[pi].name); setMode("vuln", true); } else toast(S.mark === pi ? "Highlighting " + programs[pi].name : "Highlight cleared");
      }
      else if (a === "toPrograms") setMode("programs", true);
      else if (a === "toLetter") { var L = letterOf(panel.querySelector("h2.t").textContent); setMode("programs", true); selectGroup(letterKeys.indexOf(L)); }
      else if (a === "copy") copy(t.dataset.id);
      else if (t.dataset.wk != null) selectGroup(S.sel, +t.dataset.wk);
      else if (t.dataset.cls != null) selectGroup(+t.dataset.cls);
      else if (t.dataset.prog != null) showProgram(+t.dataset.prog);
      else if (t.dataset.gocls != null) { var ci = +t.dataset.gocls; setMode("vuln", true); selectGroup(ci); }
      else if (t.dataset.item != null) selectGroup(S.sel, +t.dataset.item);
      else if (t.dataset.month != null) { var g = G()[S.sel], ix = g.items.map(function (x) { return x.month; }).indexOf(+t.dataset.month); if (ix >= 0) selectGroup(S.sel, ix); }
      else if (t.dataset.cve != null) openPanel(panelCve(cveList[+t.dataset.cve]));
    });
    panel.addEventListener("mouseover", function (e) {
      if (S.sel == null || S.item != null) return;
      var r = e.target.closest("[data-wk],[data-item]");
      layer().querySelectorAll(".strip.sel").forEach(function (s) { s.classList.remove("sel"); });
      if (r) { var j = r.dataset.wk != null ? r.dataset.wk : r.dataset.item, s = layer().querySelector('.strip[data-g="' + S.sel + '"][data-j="' + j + '"]'); if (s) s.classList.add("sel"); }
    });

    // ----- pointer: hover, click, drag, zoom -----
    var drag = null, moved = false;
    svg.addEventListener("pointerdown", function (e) { if (e.button === 0) { drag = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy }; moved = false; } });
    function onMove(e) {
      if (drag) {
        var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (!moved && Math.hypot(dx, dy) > 4) { moved = true; svg.classList.add("dragging"); hideTip(); if (anim) cancelAnimationFrame(anim); }
        if (moved) { view.cx = drag.cx - dx / view.k; view.cy = drag.cy - dy / view.k; apply(); return; }
      }
      if (svg.contains(e.target)) hoverAt(e);
      else if (S.hover != null) { S.hover = null; paint(); hideTip(); }
    }
    function onUp() { if (drag) { svg.classList.remove("dragging"); drag = null; } }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    function hoverAt(e) {
      var t = e.target, orb = t.closest(".orbit [data-p]"), xd = t.closest(".xdot");
      if (orb) { var p = programs[+orb.dataset.p]; showTip(e, "<b>" + esc(p.name) + "</b><span>" + fmt(p.count) + " reports · " + money(p.bounty) + " · click to open</span>"); return; }
      if (xd) { var c = cveList[+xd.dataset.cve]; showTip(e, "<b>" + esc(c.name) + "</b><span>" + c.id + " · CVSS " + (c.cvss != null ? c.cvss : "–") + (c.epss != null ? " · " + c.epss + "% likely" : "") + "</span>"); return; }
      var el = t.closest("[data-g]");
      if (!el || !layer().contains(el)) { if (S.hover != null) { S.hover = null; paint(); } hideTip(); return; }
      var gi = +el.dataset.g, g = G()[gi];
      if (S.hover !== gi) { S.hover = gi; paint(); }
      var strip = t.closest(".strip");
      if (strip) {
        var it = g.items[+strip.dataset.j];
        if (S.mode === "vuln") showTip(e, "<b>" + esc(it.ref.name) + "</b><span>" + fmt(it.count) + " reports · " + money(it.ref.bounty) + " · " + sevDots(it.ref.lvl) + "</span>");
        else if (S.mode === "programs") showTip(e, "<b>" + esc(it.ref.name) + "</b><span>" + fmt(it.count) + " reports · " + money(it.ref.bounty) + "</span>");
        else showTip(e, "<b>" + MONTHS[it.month] + " " + it.year + "</b><span>" + fmt(it.count) + " CVEs · " + fmt(it.m[0]) + " critical · " + fmt(it.m[1]) + " high</span>");
      } else if (S.mode === "vuln") showTip(e, "<b>" + esc(g.ref.name) + "</b><span>" + fmt(g.ref.count) + " reports · " + g.items.length + " weaknesses · click to open</span>");
      else showTip(e, "<b>" + esc(g.label) + "</b><span>" + esc(g.sub) + " · click to open</span>");
    }
    svg.addEventListener("pointerleave", function () { if (!drag) { S.hover = null; paint(); hideTip(); } });
    svg.addEventListener("click", function (e) {
      if (moved) { moved = false; return; }
      var t = e.target, orb = t.closest(".orbit [data-p]"), xd = t.closest(".xdot");
      if (orb) { showProgram(+orb.dataset.p); return; }
      if (xd) { openPanel(panelCve(cveList[+xd.dataset.cve])); return; }
      var el = t.closest("[data-g]");
      if (el && layer().contains(el)) { var strip = t.closest(".strip"); selectGroup(+el.dataset.g, strip ? +strip.dataset.j : null); }
      else if (panel.classList.contains("open")) closePanel();
    });
    svg.addEventListener("dblclick", function (e) { e.preventDefault(); zoomAt(e.clientX, e.clientY, 1.8, true); });
    svg.addEventListener("wheel", function (e) { e.preventDefault(); zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0016), false); }, { passive: false });
    function zoomAt(mx, my, f, animate) {
      var r = svg.getBoundingClientRect(), ox = mx - r.left - r.width / 2, oy = my - r.top - r.height / 2;
      var ux = view.cx + ox / view.k, uy = view.cy + oy / view.k, k = clamp(view.k * f, base.k * 0.55, base.k * 9);
      var t = { k: k, cx: ux - ox / k, cy: uy - oy / k };
      if (animate) animateTo(t, 400); else { if (anim) cancelAnimationFrame(anim); view = t; apply(); }
    }
    app.querySelector(".zoomkeys").addEventListener("click", function (e) {
      var b = e.target.closest("[data-z]"); if (!b) return;
      var r = svg.getBoundingClientRect();
      if (b.dataset.z === "reset") { if (panel.classList.contains("open")) closePanel(); else home(); }
      else zoomAt(r.left + r.width / 2, r.top + r.height / 2, b.dataset.z === "in" ? 1.6 : 1 / 1.6, true);
    });
    function keys(e) {
      if (/INPUT|TEXTAREA/.test(document.activeElement.tagName) || !$("search").hidden || e.ctrlKey || e.metaKey || e.altKey) return;
      var r = svg.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); step(1); }
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); step(-1); }
      else if (e.key === "Escape") { if (panel.classList.contains("open")) closePanel(); else home(); }
      else if (e.key === "+" || e.key === "=") zoomAt(cx, cy, 1.5, true);
      else if (e.key === "-" || e.key === "_") zoomAt(cx, cy, 1 / 1.5, true);
      else if (e.key === "0") { if (panel.classList.contains("open")) closePanel(); else home(); }
      else if (e.key === "1") setMode("vuln", true); else if (e.key === "2") setMode("programs", true); else if (e.key === "3") setMode("cves", true);
      else if (e.key === "Enter" && S.sel != null && S.mode === "vuln") location.hash = "#/class/" + enc(G()[S.sel].key);
    }
    document.addEventListener("keydown", keys);

    measure(); view = { cx: base.cx, cy: base.cy, k: base.k }; apply();
    MAP = {
      setMode: setMode,
      apply: function (p) {
        setMode(p.mode || "vuln", false);
        if (p.mark != null && programs[+p.mark]) { setMode("vuln", false); setMark(+p.mark); }
        if (p.c && byId[p.c] && S.mode === "vuln") setTimeout(function () { selectGroup(byId[p.c].idx); }, 350);
        if (p.y && S.mode === "cves") { var gi = G().map(function (g) { return g.key; }).indexOf(p.y); if (gi >= 0) setTimeout(function () { selectGroup(gi); }, 350); }
      },
      destroy: function () {
        window.removeEventListener("resize", onResize); window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp);
        document.removeEventListener("keydown", keys); if (anim) cancelAnimationFrame(anim);
        document.body.classList.remove("on-map", "panel-open"); MAP = null;
      }
    };
    MAP.apply(params);
  }

  // ================= PAGES =================
  function foot() { return '<footer class="foot"><span>' + esc(BRAND) + ' · works offline. Each report remains the work of its author and the program that disclosed it.</span><span><a href="#/about">About</a> · <a href="#/">Atlas</a></span></footer>'; }
  function page(html, wide) { app.innerHTML = '<div class="page' + (wide ? " wide" : "") + '">' + html + foot() + "</div>"; }
  function factRow(list) { return '<div class="facts">' + list.map(function (f) { return "<div" + (f[2] ? ' class="hot"' : "") + "><b>" + f[0] + "</b><span>" + f[1] + "</span></div>"; }).join("") + "</div>"; }

  function viewBrowse() {
    var maxC = byCount[0].count;
    var topP = programs.slice().sort(function (a, b) { return b.count - a.count; }).slice(0, 15);
    var topW = allWeak.slice().sort(function (a, b) { return b.count - a.count; }).slice(0, 15);
    page("<h1>Index of " + fmt(D.total) + " disclosed bug bounty reports</h1>" +
      '<p class="lede">Look things up by vulnerability class, by weakness or by program. Hit a wall while testing? See the <a href="#/bypasses">evasion notes</a>, the <a href="#/payloads">payload index</a> and the <a href="#/cves">CVE tracker</a>.</p>' +
      factRow([[fmt(D.total), "disclosed reports"], [classes.length, "vulnerability classes"], [allWeak.length, "weaknesses"], [fmt(D.programs), "programs"], [money(D.totalBounty), "in bounties"]]) +
      "<h2>Vulnerability classes</h2>" + classes.map(function (c, i) { return row("#/class/" + enc(c.id), esc(c.name), c.count, maxC, i); }).join("") +
      "<h2>Most-reported weaknesses</h2>" + topW.map(function (w, i) { return row("#/class/" + enc(w.cls) + "?w=" + enc(w.name), esc(w.name) + "<small>" + esc(w.cls) + "</small>", w.count, topW[0].count, i); }).join("") +
      "<h2>Programs with the most reports</h2>" + topP.map(function (p, i) { return row("#/program/" + p.idx, esc(p.name), p.count, topP[0].count, i); }).join("") +
      '<p style="margin-top:18px"><a href="#/programs">All ' + fmt(programs.length) + " programs, A to Z →</a></p>");
  }

  function viewClass(id, params) {
    var c = byId[id]; if (!c) return notFound();
    var lk = linksFor(id), pr = progsForClass(id).slice(0, 12);
    var prev = classes[(c.idx - 1 + classes.length) % classes.length], next = classes[(c.idx + 1) % classes.length];
    var st = { q: "", open: {} }; if (params.w) st.open[params.w] = 1;
    page('<div class="crumbs"><a href="#/browse">Index</a><span>/</span><span>' + esc(c.name) + "</span></div><h1>" + esc(c.name) + "</h1>" +
      '<p class="lede">' + fmt(c.count) + " disclosed reports across " + c.weaknesses.length + " weaknesses, with " + money(c.bounty) + " paid in bounties. The #" + (c.rank + 1) + " class by volume.</p>" +
      '<div class="acts"><a class="btn pri" href="#/?c=' + enc(c.id) + '">Show on the atlas</a><a class="btn" href="#/payloads">Payloads</a></div>' +
      factRow([[fmt(c.count), "reports"], [money(c.bounty), "in bounties"], [money(c.avg), "per report"], [pct(c.count / D.total), "of all reports"]]) +
      "<h2>Weaknesses</h2>" + (c.weaknesses.length > 7 ? '<input class="filter" id="wf" placeholder="Filter weaknesses…" autocomplete="off">' : "") + '<div id="wl"></div>' +
      (lk.length ? "<h2>Often paired with</h2>" + lk.map(function (x, i) { return row("#/class/" + enc(x.c.id), esc(x.c.name), x.n, lk[0].n, i); }).join("") : "") +
      (pr.length ? "<h2>Top programs</h2>" + pr.map(function (x, i) { return row("#/program/" + x.p.idx, esc(x.p.name), x.n, pr[0].n, i); }).join("") : "") +
      '<div class="pager"><a href="#/class/' + enc(prev.id) + '"><small>← previous class</small>' + esc(prev.name) + '</a><a class="next" href="#/class/' + enc(next.id) + '"><small>next class →</small>' + esc(next.name) + "</a></div>", true);
    var list = $("wl"), ws = c.weaknesses.slice().sort(function (a, b) { return b.count - a.count; }), max = ws.length ? ws[0].count : 1;
    function hl(t) { if (!st.q) return esc(t); var i = t.toLowerCase().indexOf(st.q); return i < 0 ? esc(t) : esc(t.slice(0, i)) + '<mark style="background:none;color:var(--hot)">' + esc(t.slice(i, i + st.q.length)) + "</mark>" + esc(t.slice(i + st.q.length)); }
    function detail(w) {
      var sc = sevCounts(w.sev);
      return '<div class="detail"><div><b>' + money(w.bounty) + "</b><span>in bounties</span></div><div><b>" + money(w.count ? w.bounty / w.count : 0) + "</b><span>per report · class " + money(c.avg) + "</span></div><div><b>" + pct(w.count / c.count) + "</b><span>of " + esc(c.id) + " reports</span></div>" +
        (sc[1] + sc[2] + sc[3] + sc[4] ? '<div><b style="font-size:.95rem">' + [4, 3, 2, 1].map(function (k) { return '<span style="color:' + (k === 4 ? "var(--red)" : k === 3 ? "var(--hot)" : "var(--ink)") + '">' + sc[k] + "</span>"; }).join(" · ") + "</b><span>critical · high · medium · low</span></div>" : "") + "</div>";
    }
    function render() {
      var shown = ws.filter(function (w) { return !st.q || w.name.toLowerCase().indexOf(st.q) >= 0; });
      list.innerHTML = shown.length ? shown.map(function (w, i) {
        var open = st.open[w.name];
        return '<button type="button" class="row' + (open ? " on" : "") + '" data-w="' + esc(w.name) + '" aria-expanded="' + !!open + '" style="--i:' + i + '"><span class="nm">' + sevDots(w.lvl) + " &nbsp;" + hl(w.name) + "</span>" + bar(w.count, max, i) + '<span class="num">' + fmt(w.count) + "</span></button>" + (open ? detail(w) : "");
      }).join("") : '<p class="empty">No weaknesses match.</p>';
    }
    list.addEventListener("click", function (e) { var r = e.target.closest(".row"); if (!r) return; var n = r.dataset.w; if (st.open[n]) delete st.open[n]; else st.open[n] = 1; render(); });
    if ($("wf")) $("wf").addEventListener("input", function (e) { st.q = e.target.value.trim().toLowerCase(); render(); });
    render();
    if (params.w) { var el = list.querySelector(".row.on"); if (el) setTimeout(function () { el.scrollIntoView({ block: "center", behavior: REDUCED ? "auto" : "smooth" }); }, 250); }
  }

  var progSort = "az";
  function viewPrograms() {
    page('<div class="crumbs"><a href="#/browse">Index</a><span>/</span><span>Programs</span></div><h1>' + fmt(programs.length) + " programs</h1>" +
      '<p class="lede">Every program with disclosed reports. Jump to a letter, filter by name, or sort by volume and payouts.</p>' +
      '<input class="filter" id="pf" placeholder="Filter programs…" autocomplete="off"><div class="chips" id="ps"><button class="chip" data-s="az">A to Z</button><button class="chip" data-s="count">Most reports</button><button class="chip" data-s="bounty">Most paid</button></div>' +
      '<div class="letters" id="pl"></div><div id="plist"></div>', true);
    var q = "";
    function render() {
      var list = programs.filter(function (p) { return !q || p.name.toLowerCase().indexOf(q) >= 0; });
      var val = function (p) { return progSort === "bounty" ? p.bounty : p.count; };
      var num = function (p) { return progSort === "bounty" ? money(p.bounty) : fmt(p.count); };
      var max = Math.max.apply(null, programs.map(val));
      $("ps").querySelectorAll(".chip").forEach(function (c) { c.classList.toggle("on", c.dataset.s === progSort); });
      var has = {}; list.forEach(function (p) { has[letterOf(p.name)] = 1; });
      $("pl").innerHTML = letterKeys.map(function (L) { return '<button type="button" data-l="' + L + '"' + (has[L] && progSort === "az" ? "" : " disabled") + ">" + L + "</button>"; }).join("");
      if (!list.length) { $("plist").innerHTML = '<p class="empty">No programs match.</p>'; return; }
      if (progSort === "az") {
        $("plist").innerHTML = letterKeys.filter(function (L) { return has[L]; }).map(function (L) {
          return '<div class="lh" id="L-' + L + '">' + L + "</div>" + list.filter(function (p) { return letterOf(p.name) === L; }).sort(function (a, b) { return a.name.localeCompare(b.name); })
            .map(function (p, i) { return row("#/program/" + p.idx, esc(p.name), val(p), max, i, "", num(p)); }).join("");
        }).join("");
      } else {
        $("plist").innerHTML = list.slice().sort(function (a, b) { return val(b) - val(a); }).slice(0, 200).map(function (p, i) { return row("#/program/" + p.idx, esc(p.name), val(p), max, i, "", num(p)); }).join("");
      }
    }
    $("pf").addEventListener("input", function (e) { q = e.target.value.trim().toLowerCase(); render(); });
    $("ps").addEventListener("click", function (e) { var c = e.target.closest(".chip"); if (c) { progSort = c.dataset.s; render(); } });
    $("pl").addEventListener("click", function (e) { var b = e.target.closest("button[data-l]"); if (b) { var t = $("L-" + b.dataset.l); if (t) scrollTo({ top: t.getBoundingClientRect().top + scrollY - 100, behavior: REDUCED ? "auto" : "smooth" }); } });
    render();
  }

  function viewProgram(i) {
    var p = programs[+i]; if (!p) return notFound();
    var max = p.classes.length ? p.classes[0][1] : 1, known = sum(p.classes.map(function (x) { return x[1]; })), sim = similar(p, 8);
    var prev = programs[(p.idx - 1 + programs.length) % programs.length], next = programs[(p.idx + 1) % programs.length];
    page('<div class="crumbs"><a href="#/browse">Index</a><span>/</span><a href="#/programs">Programs</a><span>/</span><span>' + esc(p.name) + "</span></div><h1>" + esc(p.name) + "</h1>" +
      '<p class="lede">' + fmt(p.count) + " disclosed reports and " + money(p.bounty) + " in bounties, #" + (p.idx + 1) + " of " + programs.length + " programs by volume.</p>" +
      '<div class="acts"><a class="btn pri" href="#/?mark=' + p.idx + '">Highlight on the atlas</a><a class="btn" href="#/programs">All programs</a></div>' +
      factRow([[fmt(p.count), "reports"], [money(p.bounty), "in bounties"], [money(p.count ? p.bounty / p.count : 0), "per report"], [pct(p.count / D.total), "of all reports"]]) +
      (p.classes.length ? "<h2>Bug profile by class</h2>" + p.classes.map(function (x, k) { var c = byId[x[0]]; return row(c ? "#/class/" + enc(c.id) : null, esc(c ? c.name : x[0]), x[1], max, k); }).join("") +
        (p.count > known ? '<p class="small" style="margin-top:14px !important">' + fmt(p.count - known) + " more reports fall outside its top classes.</p>" : "") : "") +
      (sim.length ? "<h2>Programs with a similar profile</h2>" + sim.map(function (s, k) { return row("#/program/" + s.q.idx, esc(s.q.name), s.s, 1, k, "", Math.round(s.s * 100) + "%"); }).join("") : "") +
      '<div class="pager"><a href="#/program/' + prev.idx + '"><small>← previous</small>' + esc(prev.name) + '</a><a class="next" href="#/program/' + next.idx + '"><small>next →</small>' + esc(next.name) + "</a></div>", true);
  }

  function viewBypasses() {
    var b = D.bypasses || [], tot = sum(b.map(function (x) { return x.count; })), max = b.length ? b[0].count : 1;
    page('<div class="crumbs"><a href="#/browse">Index</a><span>/</span><span>Evasions</span></div><h1>Evasion notes</h1>' +
      '<p class="lede">Disclosed reports in which a defence was defeated, sorted by the kind of defence. ' + fmt(tot) + " cases in " + b.length + " categories.</p>" +
      '<div class="bgrid">' + b.map(function (x, i) {
        return '<div class="bp" style="animation:rise .5s var(--ease) backwards;animation-delay:' + Math.min(i, 18) * 30 + 'ms"><div class="h"><b>' + esc(x.name) + "</b><small>" + fmt(x.count) + " reports</small></div><p>" + esc(x.desc) + "</p>" + bar(x.count, max, i) + "</div>";
      }).join("") + "</div>" +
      '<p class="small">Categories are assigned by keyword matching on report titles and summaries, so expect a few misplaced reports. Only the category totals ship with this offline copy.</p>', true);
  }

  function viewPayloads(params) {
    var pl = D.payloads || [], tot = sum(pl.map(function (x) { return x.count; }));
    page('<div class="crumbs"><a href="#/browse">Index</a><span>/</span><span>Payloads</span></div><h1>Payload index</h1>' +
      '<p class="lede">Topic-by-topic cheat sheets of inputs to try, filter-evasion variants included. ' + fmt(tot) + " entries across " + pl.length + ' topics. For defences that were defeated in real reports, see the <a href="#/bypasses">evasion notes</a>.</p>' +
      '<input class="filter" id="yf" placeholder="Filter topics…" autocomplete="off" style="margin-top:12px"><div class="cols" id="yl"></div>' +
      '<p class="small">Topic names and counts come from <a href="https://github.com/swisskyrepo/PayloadsAllTheThings" target="_blank" rel="noopener noreferrer">PayloadsAllTheThings</a> by Swissky and contributors (MIT licence). Each topic opens its folder there, which needs a connection. Use it only on systems you are authorised to test.</p>', true);
    function render(q) {
      var l = pl.filter(function (x) { return !q || x.name.toLowerCase().indexOf(q) >= 0; });
      $("yl").innerHTML = l.length ? l.map(function (x) {
        return '<a class="lead" href="https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/' + enc(x.name) + '" target="_blank" rel="noopener noreferrer"' + (params.t === x.name ? ' style="color:var(--hot)"' : "") + "><span>" + esc(x.name) + "</span><small>" + x.count + '</small><span class="ext">↗</span></a>';
      }).join("") : '<p class="empty">No topics match.</p>';
    }
    $("yf").addEventListener("input", function (e) { render(e.target.value.trim().toLowerCase()); });
    render("");
  }

  var cveSort = "new", cveSev = 0;
  function viewCves() {
    var cf = D.cveFacts || [], maxY = Math.max.apply(null, years.map(function (y) { return y.t[4]; }));
    page('<div class="crumbs"><a href="#/browse">Index</a><span>/</span><span>CVEs</span></div><h1>CVE tracker</h1>' +
      '<p class="lede">Vulnerabilities in shipped software, scored for severity and for how likely they are to be exploited. Handy for matching a target’s stack before you test.</p>' +
      '<div class="acts"><a class="btn pri" href="#/?mode=cves">Open the CVE atlas</a></div>' +
      factRow(cf.map(function (f, i) { return [fmt(f[0]), esc(f[1]), i === 2]; })) +
      "<h2>Recently confirmed as exploited</h2>" +
      '<div class="chips" id="cs"><button class="chip" data-s="new">Newest</button><button class="chip" data-s="cvss">Highest CVSS</button><button class="chip" data-s="epss">Most likely</button><span style="width:14px"></span><button class="chip" data-v="0">All</button><button class="chip" data-v="4">Critical</button><button class="chip" data-v="3">High</button></div>' +
      '<ol class="cves" id="cl"></ol>' +
      "<h2>Published by year</h2>" + years.slice().reverse().map(function (y, i) { return row("#/?mode=cves&y=" + y.year, String(y.year), y.t[4], maxY, i); }).join("") +
      '<p class="small">Likelihood is the EPSS chance of exploitation in the next 30 days. The list is a snapshot and does not update offline.</p>', true);
    function render() {
      $("cs").querySelectorAll(".chip").forEach(function (c) { c.classList.toggle("on", c.dataset.s === cveSort || (c.dataset.v != null && +c.dataset.v === cveSev)); });
      var l = cveList.filter(function (c) { return !cveSev || c.sev === cveSev; });
      if (cveSort === "cvss") l.sort(function (a, b) { return (b.cvss || 0) - (a.cvss || 0); });
      else if (cveSort === "epss") l.sort(function (a, b) { return (b.epss || 0) - (a.epss || 0); });
      else l.sort(function (a, b) { return b.listed.localeCompare(a.listed); });
      $("cl").innerHTML = l.length ? l.map(function (c, i) {
        return '<li style="animation:rise .4s var(--ease) backwards;animation-delay:' + Math.min(i, 15) * 25 + 'ms">' + sevDots(c.sev) + '<div><div class="t">' + esc(c.name) + "</div><small>" + esc(c.id) + " · confirmed " + esc(c.listed) + (c.ransom ? " · used by ransomware" : "") + '<button class="copy" data-id="' + esc(c.id) + '">copy ID</button></small></div>' +
          '<span class="num">' + (c.cvss != null ? "<i>CVSS</i> " + c.cvss : "") + '</span><span class="num hot">' + (c.epss != null ? c.epss + "% <i>likely</i>" : "") + "</span></li>";
      }).join("") : '<li class="empty">Nothing matches.</li>';
    }
    $("cs").addEventListener("click", function (e) { var c = e.target.closest(".chip"); if (!c) return; if (c.dataset.s) cveSort = c.dataset.s; else cveSev = +c.dataset.v; render(); });
    $("cl").addEventListener("click", function (e) { var b = e.target.closest(".copy"); if (b) copy(b.dataset.id); });
    render();
  }

  function viewAbout() {
    page("<h1>About " + esc(BRAND) + "</h1>" +
      "<p>" + esc(BRAND) + " charts " + fmt(D.total) + " public bug bounty disclosures from " + fmt(D.programs) + " programs across " + classes.length + " vulnerability classes and " + allWeak.length + " weaknesses. It is a single folder of static files, so it runs straight from disk with no server and no internet connection.</p>" +
      "<h2>Reading the atlas</h2><ul>" +
      "<li>Hubs on the inner circle are vulnerability classes. The bundles fanning out from each hub are its weaknesses; a bigger bundle means more reports.</li>" +
      "<li>Arcs across the centre connect classes that are often reported together; the heavier the arc, the stronger the pairing.</li>" +
      "<li>Switch to Programs for an A-to-Z view, where each bundle is one program. Any program can be highlighted on the class view to show where it gets hit.</li>" +
      "<li>Switch to CVEs to see publication volume by year and month, with a dot for every CVE confirmed as exploited.</li>" +
      "<li>Controls: drag to pan, scroll or <code>+</code> <code>−</code> to zoom, <code>←</code> <code>→</code> to move between hubs, <code>1</code> <code>2</code> <code>3</code> to change view, <code>/</code> or <code>F</code> to search, <code>Esc</code> to close.</li></ul>" +
      "<h2>Data sources</h2>" +
      "<p>Report counts are a " + esc(D.snapshot) + " snapshot of aggregate statistics built on public HackerOne disclosures (the open hackerone-reports dataset). Payload topics are from PayloadsAllTheThings (MIT licence). CVE severity, exploitation status and likelihood draw on nuclei-templates, the CISA KEV catalogue and EPSS. Full report write-ups are not bundled. To refresh the numbers, regenerate <code>assets/data.js</code>.</p>" +
      "<h2>Responsible use</h2>" +
      "<p>Every report here describes a vulnerability that was fixed and then disclosed by the program concerned. Use the material to learn, and only test systems you have permission to test, within each program's scope. " + esc(BRAND) + " is an independent project with no affiliation to HackerOne or to any program listed.</p>" +
      '<p><a href="#/">Open the atlas</a> · <a href="#/browse">Open the index</a></p>');
  }
  function notFound() { page('<h1>Page not found.</h1><p class="lede"><a href="#/">Back to the atlas</a></p>'); }

  // ================= SEARCH =================
  var index = [];
  classes.forEach(function (c) { index.push({ g: "Vulnerability classes", tag: "class", t: c.name, s: fmt(c.count) + " reports · " + c.weaknesses.length + " weaknesses", h: "#/class/" + enc(c.id), w: 5, x: c.id }); });
  allWeak.forEach(function (w) { index.push({ g: "Weaknesses", tag: w.cls, t: w.name, s: fmt(w.count) + " reports · " + money(w.bounty), h: "#/class/" + enc(w.cls) + "?w=" + enc(w.name), w: 4 }); });
  programs.forEach(function (p) { index.push({ g: "Programs", tag: "program", t: p.name, s: fmt(p.count) + " reports · " + money(p.bounty), h: "#/program/" + p.idx, w: 3 }); });
  cveList.forEach(function (c) { index.push({ g: "CVEs", tag: "CVE", t: c.name, s: c.id + " · CVSS " + (c.cvss != null ? c.cvss : "–") + " · listed " + c.listed, h: "#/cves", w: 2, x: c.id }); });
  (D.bypasses || []).forEach(function (b) { index.push({ g: "Bypasses", tag: "bypass", t: b.name, s: fmt(b.count) + " reports · " + b.desc, h: "#/bypasses", w: 2 }); });
  (D.payloads || []).forEach(function (p) { index.push({ g: "Payloads", tag: "payload", t: p.name, s: p.count + " passages", h: "#/payloads?t=" + enc(p.name), w: 1 }); });
  index.forEach(function (x) { x.l = (x.t + " " + (x.x || "") + " " + x.s).toLowerCase(); x.tl = x.t.toLowerCase(); });
  var GROUPS = ["Vulnerability classes", "Weaknesses", "Programs", "CVEs", "Bypasses", "Payloads"];
  var SUGGEST = ["xss", "ssrf", "idor", "account takeover", "sql injection", "2fa", "gitlab", "race condition", "CVE-2026"];
  var sEl = $("search"), q = $("q"), res = $("results"), sel = 0, hits = [];
  function hlS(t, term) { var i = t.toLowerCase().indexOf(term); return i < 0 || !term ? esc(t) : esc(t.slice(0, i)) + "<mark>" + esc(t.slice(i, i + term.length)) + "</mark>" + esc(t.slice(i + term.length)); }
  function runSearch() {
    var term = q.value.trim().toLowerCase(), words = term.split(/\s+/).filter(Boolean);
    hits = [];
    if (!words.length) {
      res.innerHTML = '<div class="shint"><p>Search classes and weaknesses across ' + fmt(D.total) + " reports, " + fmt(programs.length) + " programs, exploited CVEs, bypasses and payload topics. Try:</p><div>" + SUGGEST.map(function (s) { return '<button type="button" data-s="' + esc(s) + '">' + esc(s) + "</button>"; }).join("") + "</div></div>";
      return;
    }
    var all = index.filter(function (x) { return words.every(function (w) { return x.l.indexOf(w) >= 0; }); })
      .sort(function (a, b) { return (b.tl.indexOf(term) === 0) - (a.tl.indexOf(term) === 0) || (b.tl.indexOf(term) >= 0) - (a.tl.indexOf(term) >= 0) || b.w - a.w || a.t.length - b.t.length; });
    var html = "";
    GROUPS.forEach(function (g) {
      var grp = all.filter(function (x) { return x.g === g; }).slice(0, g === "Weaknesses" || g === "Programs" ? 6 : 4);
      if (!grp.length) return;
      html += "<h3>" + g + "</h3>" + grp.map(function (x) { var n = hits.push(x) - 1; return '<a class="sitem" href="' + x.h + '" data-n="' + n + '"><span>' + hlS(x.t, words[0]) + "<i>" + esc(x.tag) + "</i></span><small>" + esc(x.s) + "</small></a>"; }).join("");
    });
    res.innerHTML = hits.length ? html : '<p class="snone">Nothing matches “' + esc(term) + "”.</p>";
    sel = 0; markSel();
  }
  function markSel() { res.querySelectorAll(".sitem").forEach(function (a) { a.classList.toggle("on", +a.dataset.n === sel); }); var on = res.querySelector(".sitem.on"); if (on) on.scrollIntoView({ block: "nearest" }); }
  function openSearch() { sEl.hidden = false; q.value = ""; runSearch(); setTimeout(function () { q.focus(); }, 0); }
  function closeSearch() { sEl.hidden = true; }
  q.addEventListener("input", runSearch);
  q.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown") { e.preventDefault(); if (hits.length) { sel = (sel + 1) % hits.length; markSel(); } }
    else if (e.key === "ArrowUp") { e.preventDefault(); if (hits.length) { sel = (sel - 1 + hits.length) % hits.length; markSel(); } }
    else if (e.key === "Enter") { e.preventDefault(); if (hits[sel]) { closeSearch(); location.hash = hits[sel].h; } }
  });
  res.addEventListener("click", function (e) {
    var s = e.target.closest("[data-s]"); if (s) { q.value = s.dataset.s; runSearch(); q.focus(); return; }
    if (e.target.closest(".sitem")) closeSearch();
  });
  res.addEventListener("mousemove", function (e) { var a = e.target.closest(".sitem"); if (a && +a.dataset.n !== sel) { sel = +a.dataset.n; markSel(); } });
  sEl.addEventListener("click", function (e) { if (e.target === sEl) closeSearch(); });
  $("escBtn").addEventListener("click", closeSearch);
  $("findBtn").addEventListener("click", openSearch);
  document.addEventListener("keydown", function (e) {
    var typing = /INPUT|TEXTAREA/.test(document.activeElement.tagName);
    if (e.key === "Escape" && !sEl.hidden) { e.stopImmediatePropagation(); closeSearch(); }
    else if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && (e.key === "f" || e.key === "F" || e.key === "/")) { e.preventDefault(); openSearch(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openSearch(); }
  }, true);

  // ================= ROUTER =================
  var TITLES = { browse: "Index", programs: "Programs", bypasses: "Evasion notes", payloads: "Payload index", cves: "CVE tracker", about: "About" };
  function route() {
    hideTip();
    var raw = location.hash.replace(/^#\/?/, ""), qi = raw.indexOf("?"), path = qi >= 0 ? raw.slice(0, qi) : raw, params = {};
    (qi >= 0 ? raw.slice(qi + 1) : "").split("&").forEach(function (kv) { if (kv) { var p = kv.split("="); params[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || ""); } });
    var parts = path.split("/").map(decodeURIComponent), p = parts[0] || "";
    if (!p) {
      if (MAP) MAP.apply(params); else viewMap(params);
      document.title = BRAND + ": every disclosed bug bounty report, mapped";
      return;
    }
    if (MAP) MAP.destroy();
    setNav(PAGE_NAV, p === "class" || p === "program" || p === "programs" ? "browse" : p);
    if (p === "browse") viewBrowse();
    else if (p === "class") viewClass(parts[1], params);
    else if (p === "programs") viewPrograms();
    else if (p === "program") viewProgram(parts[1]);
    else if (p === "bypasses") viewBypasses();
    else if (p === "payloads") viewPayloads(params);
    else if (p === "cves") viewCves();
    else if (p === "about") viewAbout();
    else notFound();
    var t = p === "class" && byId[parts[1]] ? byId[parts[1]].name : p === "program" && programs[+parts[1]] ? programs[+parts[1]].name : TITLES[p];
    document.title = (t || "Not found") + " · " + BRAND;
    if (!params.w) scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);
  route();
})();
