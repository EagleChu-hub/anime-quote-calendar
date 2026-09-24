// 空鏡場景：依 data/scenes.json 的範本，把 assets/elements 的代號色 SVG 換成時段配色後，
// 疊在程式畫的天空漸層上。規格見 design-return/NOTES.md 第 4 節。流程分兩段：
//   prepare()：挑範本與時段、抽亂數、載入並換色所有元素（非同步）
//   draw()：   畫天空、元素與疊加層（同步，螢幕與匯出共用）
(function (global) {
  const W = 1080, H = 1920;
  const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
  const TIMES = ['day', 'dusk', 'night', 'rain'];
  // 時段的基本權重；情緒偏好的時段權重乘以 MOOD_BOOST
  const TIME_WEIGHT = { day: 1, dusk: 0.7, night: 0.7, rain: 0.15 };
  const MOOD_TIME = {
    departure: ['day'], perseverance: ['day', 'rain'], friendship: ['day', 'dusk'], farewell: ['dusk'],
    longing: ['night', 'dusk'], kindness: ['dusk', 'rain'], growth: ['day'], dream: ['night', 'day'],
    courage: ['day'], solitude: ['night', 'rain'], acceptance: ['dusk'], everyday: ['dusk', 'day'],
  };
  const MOOD_BOOST = 2.5;

  const seasonOf = (m) => ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'][m - 1];
  const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const toHex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => { const B = hex(b); return toHex(hex(a).map((v, i) => Math.round(v + (B[i] - v) * t))); };
  const rgba = (h, a) => { const c = hex(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
  const pick = (v, r) => (Array.isArray(v) ? v[0] + (v[1] - v[0]) * r() : v);
  const dayIndexOf = (info) => Math.floor(Date.UTC(info.year, info.month - 1, info.day) / 86400000);

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  let data = null; // { scenes, tokens }
  async function load() {
    if (data) return data;
    const get = async (u) => {
      const r = await fetch(u);
      if (!r.ok) throw new Error(u + ' 載入失敗');
      return r.json();
    };
    const [scenes, tokens, second, extra] = await Promise.all([
      get('data/scenes.json'), get('data/tokens.json'),
      get('data/scenes-2.json').catch(() => []), get('data/scenes-extra.json').catch(() => null),
    ]);
    scenes.push(...second); // 第二批：自然風景
    // scenes-extra.json：Claude Code 補的範本，以及調整原範本可用的季節
    if (extra) {
      for (const s of scenes) {
        const more = extra.extendSeasons && extra.extendSeasons[s.id];
        if (more) s.seasons = [...new Set([...s.seasons, ...more])];
        const less = extra.removeSeasons && extra.removeSeasons[s.id];
        if (less) s.seasons = s.seasons.filter((x) => !less.includes(x));
      }
      scenes.push(...(extra.scenes || []));
    }
    data = { scenes, tokens };
    return data;
  }

  // 時段配色套上季節微調：color = mix(原色, tint, amount)，只作用在 targets 列出的欄位
  function paletteFor(tokens, time, season) {
    const p = JSON.parse(JSON.stringify(tokens.palettes[time]));
    const s = tokens.seasons[season];
    if (s && s.amount) {
      for (const path of s.targets) {
        const [a, b] = path.split('.');
        if (b) p[a][b] = mix(p[a][b], s.tint, s.amount);
        else p[a] = mix(p[a], s.tint, s.amount);
      }
    }
    return p;
  }

  // ---- 元素：抓一次原始 SVG，依（檔案, 配色）換色後快取成 Image ----
  const texts = new Map();
  const images = new Map();

  function svgText(path) {
    if (!texts.has(path)) {
      texts.set(path, fetch(path).then((r) => {
        if (!r.ok) throw new Error(path + ' 載入失敗');
        return r.text();
      }));
    }
    return texts.get(path);
  }

  // 六個代號色換成實際顏色；遮罩（<mask>）裡的黑白代表透明度，不能動
  function recolor(svg, map) {
    const re = /<mask[\s\S]*?<\/mask>|#(010101|020202|030303|FEFEFE|FFCC00|FF0000)\b/gi;
    return svg.replace(re, (m) => (m.startsWith('<mask') ? m : map[m.toUpperCase()] || m));
  }

  function codeMap(tokens, p) {
    const map = {};
    for (const [code, key] of Object.entries(tokens.codeColors)) {
      const [a, b] = key.split('.');
      map[code.toUpperCase()] = b ? p[a][b] : p[a];
    }
    return map;
  }

  function image(path, map, key) {
    const k = `${path}|${key}`;
    if (!images.has(k)) {
      images.set(k, (async () => {
        const s = recolor(await svgText(path), map);
        const anchor = (s.match(/data-anchor="(\w+)"/) || [0, 'center'])[1];
        const img = new Image();
        img.src = URL.createObjectURL(new Blob([s], { type: 'image/svg+xml' }));
        await img.decode();
        return { img, anchor, ratio: (img.naturalHeight || img.height) / (img.naturalWidth || img.width) };
      })());
    }
    return images.get(k);
  }

  // ---- 挑範本：符合情緒的候選依固定順序逐日輪替，找不到就依序放寬條件 ----
  // 放寬時先保住季節再放掉情緒：冬天出現向日葵比情緒稍微不準更突兀
  // avoid：前幾天用過的範本 id（最近的在前）。跳過它們；全部都用過時，改用最久沒出現的那一個
  function choose(scenes, info, mood, avoid = []) {
    const season = seasonOf(info.month);
    const bySeason = scenes.filter((s) => s.seasons.includes(season));
    let list = bySeason.filter((s) => s.moods.includes(mood));
    if (!list.length) list = bySeason;
    if (!list.length) list = scenes;
    const fresh = list.filter((s) => !avoid.includes(s.id));
    list = fresh.length ? fresh : [list.reduce((a, b) => (avoid.indexOf(b.id) > avoid.indexOf(a.id) ? b : a))];

    const order = list.slice();
    const r = rng(97 + SEASONS.indexOf(season) * 13 + mood.length * 7);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const dayIndex = dayIndexOf(info);
    const scene = order[dayIndex % order.length];

    // 時段：範本允許的時段裡，依基本權重與情緒偏好加權抽一個
    const prefer = MOOD_TIME[mood] || [];
    const opts = scene.time.filter((t) => TIMES.includes(t));
    const weights = opts.map((t) => TIME_WEIGHT[t] * (prefer.includes(t) ? MOOD_BOOST : 1));
    let x = rng(dayIndex * 7 + 3)() * weights.reduce((a, b) => a + b, 0);
    let time = opts[opts.length - 1];
    for (let i = 0; i < opts.length; i++) {
      if ((x -= weights[i]) < 0) { time = opts[i]; break; }
    }
    return { scene, time, season };
  }

  /**
   * @param info  LunarInfo.info() 的結果
   * @param mood  當天台詞的情緒標籤
   * @param force 可選 { scene: id, time }，用來預覽指定的範本與時段
   */
  // 只算出這一天會用哪個範本（給 app 推算前幾天用過的範本）
  async function pickId(info, mood, avoid = []) {
    const { scenes } = await load();
    return choose(scenes, info, mood, avoid).scene.id;
  }

  async function prepare(info, mood, force = {}, avoid = []) {
    const { scenes, tokens } = await load();
    let { scene, time, season } = choose(scenes, info, mood, avoid);
    if (force.scene) scene = scenes.find((s) => s.id === force.scene) || scene;
    if (force.time && TIMES.includes(force.time)) time = force.time;
    else if (!scene.time.includes(time)) time = scene.time[0];

    const p = paletteFor(tokens, time, season);
    const map = codeMap(tokens, p);
    const key = `${time}|${season}`;
    const rand = rng((info.year * 10000 + info.month * 100 + info.day) * 31 + 7);

    const jobs = [];
    for (const L of scene.layers) {
      // 每一層都依序抽 x、y、scale、flip；被 only 跳過的也要抽，讓同一天換時段時景物位置不變
      const x = pick(L.x, rand);
      const y = pick(L.y, rand);
      const scale = pick(L.scale ?? 1, rand);
      const flip = L.flip === 'random' ? rand() < 0.5 : L.flip === 'x' || L.flip === true;
      if (L.only && !(Array.isArray(L.only) ? L.only : [L.only]).includes(time)) continue;
      jobs.push(image(`assets/elements/${L.asset}.svg`, map, key)
        .then((a) => ({ ...a, x, y, w: L.width * scale, flip, opacity: L.opacity ?? 1 })));
    }
    return { id: scene.id, name: scene.name, time, season, palette: p, tokens, layers: await Promise.all(jobs) };
  }

  let grainCanvas = null;
  function grainPattern(ctx) {
    if (!grainCanvas) {
      grainCanvas = document.createElement('canvas');
      grainCanvas.width = grainCanvas.height = 256;
      const g = grainCanvas.getContext('2d');
      const img = g.createImageData(256, 256);
      const r = rng(20261001);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.round(r() * 255);
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
    }
    return ctx.createPattern(grainCanvas, 'repeat');
  }

  function draw(ctx, prep) {
    const { palette: p, tokens } = prep;

    // 天空：三色直線漸層，最後一個 stop 以下延續底色
    const s = p.sky;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    [s.top, s.mid, s.bottom].forEach((c, i) => g.addColorStop(s.stops[i], c));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    for (const L of prep.layers) {
      const w = L.w * W, h = w * L.ratio;
      ctx.save();
      ctx.globalAlpha = L.opacity;
      ctx.translate(L.x * W, L.y * H);
      if (L.flip) ctx.scale(-1, 1);
      ctx.drawImage(L.img, -w / 2, L.anchor === 'bottom' ? -h : -h / 2, w, h);
      ctx.restore();
    }

    // 疊加層：頂端淡暗罩 → 底部暗角 → 顆粒
    const o = tokens.overlays;
    if (p.overlay.topScrim > 0) {
      const t = ctx.createLinearGradient(0, o.topScrim.y0, 0, o.topScrim.y1);
      t.addColorStop(0, rgba(o.topScrim.color, p.overlay.topScrim));
      t.addColorStop(1, rgba(o.topScrim.color, 0));
      ctx.fillStyle = t;
      ctx.fillRect(0, o.topScrim.y0, W, o.topScrim.y1 - o.topScrim.y0);
    }
    const v = ctx.createLinearGradient(0, o.vignette.y0, 0, o.vignette.y1);
    for (const [at, a] of o.vignette.stops) v.addColorStop(at, rgba(o.vignette.color, a * p.overlay.vignette));
    ctx.fillStyle = v;
    ctx.fillRect(0, o.vignette.y0, W, o.vignette.y1 - o.vignette.y0);

    if (o.grain && o.grain.opacity > 0) {
      ctx.save();
      ctx.globalAlpha = o.grain.opacity;
      ctx.globalCompositeOperation = o.grain.blend || 'overlay';
      ctx.fillStyle = grainPattern(ctx);
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  global.Scene = { prepare, pickId, draw, seasonOf, rng, load, TIMES };
})(window);
