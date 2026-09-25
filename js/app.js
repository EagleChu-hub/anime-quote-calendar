(function () {
  const $ = (id) => document.getElementById(id);
  const canvas = $('card');
  const stage = $('stage');
  const pad = LunarInfo.pad;
  const params = new URLSearchParams(location.search);
  // 預覽用：?scene=範本id&time=day|dusk|night|rain 指定場景；?sample 用示意台詞
  const force = { scene: params.get('scene'), time: params.get('time') };

  const months = {}; // 'YYYY-MM' → 該月內容（載入中為 Promise）
  let samples = null;
  let current = startDate();

  function startDate() {
    const m = /^#(\d{4})(\d{2})(\d{2})$/.exec(location.hash);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  const monthOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  const keyOf = (d) => `${monthOf(d)}-${pad(d.getDate())}`;
  function entryOf(d) {
    if (samples) return samples[Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000) % samples.length];
    const m = months[monthOf(d)];
    return (m && !(m instanceof Promise) && m[keyOf(d)]) || null;
  }

  function loadMonth(d) {
    const k = monthOf(d);
    if (!months[k]) {
      months[k] = loadJSON(`data/quotes/${k}.json`).then((data) => (months[k] = data || {}));
    }
    return Promise.resolve(months[k]);
  }

  // 場景去重：從固定起點 EPOCH（2026-09-25，收錄第一天）開始逐日推算每天用的範本，每天避開前 AVOID 天用過的。
  // 結果只取決於日期和內容，所以螢幕、存圖、任何裝置看到的都一樣；算過的存在 sceneMemo。
  const EPOCH = new Date(2026, 8, 25);
  const AVOID = 5;
  const sceneMemo = [];
  const dayNo = (d) => Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(2026, 8, 25)) / 86400000);
  async function recentScenes(d) {
    const target = dayNo(d);
    for (let i = sceneMemo.length; i < target; i++) {
      const di = new Date(EPOCH.getFullYear(), EPOCH.getMonth(), EPOCH.getDate() + i);
      await loadMonth(di);
      const e = entryOf(di) || Card.EMPTY;
      const avoid = sceneMemo.slice(Math.max(0, i - AVOID), i).reverse();
      sceneMemo.push(await Scene.pickId(LunarInfo.info(di), e.mood || 'everyday', avoid));
    }
    return target <= 0 ? [] : sceneMemo.slice(Math.max(0, target - AVOID), target).reverse();
  }

  let scene = null; // 目前這一天的場景（Scene.prepare 的結果）

  function draw(ctx, scale) {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    Card.render(ctx, entryOf(current), LunarInfo.info(current), scene);
  }

  function layout() {
    const r = stage.getBoundingClientRect();
    const h = Math.max(200, Math.min(r.height, r.width * 16 / 9));
    const w = h * 9 / 16;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }

  let renderToken = 0;
  async function render() {
    const token = ++renderToken;
    await loadMonth(current);
    if (token !== renderToken) return;
    const info = LunarInfo.info(current);
    const entry = entryOf(current) || Card.EMPTY;
    $('date-label').textContent = `${info.year}/${pad(info.month)}/${pad(info.day)}`;
    $('date-input').value = `${info.year}-${pad(info.month)}-${pad(info.day)}`;
    const src = Card.sourceLine(entry);
    $('card-text').textContent = `${info.year}年${info.month}月${info.day}日 ${info.week}，農曆${info.lunarDate}。`
      + `「${entry.quote_zh}」${src ? '── ' + src + '。' : ''}${entry.text}`;

    let prepared = null;
    try {
      prepared = await Scene.prepare(info, entry.mood || 'everyday', force, await recentScenes(current));
      // 等這張卡用到的字形載入後再畫，避免先以後備字型閃一下
      await Promise.race([
        Promise.all(Card.fontsFor(entry, info, prepared.tokens)),
        new Promise((r) => setTimeout(r, 2500)),
      ]);
    } catch (e) {
      console.error('場景或字型載入失敗', e);
    }
    if (!prepared || token !== renderToken) return;
    scene = prepared;
    draw(canvas.getContext('2d'), canvas.width / Card.W);
    canvas.classList.remove('fading');
    document.documentElement.dataset.time = scene.time;
  }

  function go(days) {
    current = new Date(current.getFullYear(), current.getMonth(), current.getDate() + days);
    canvas.classList.add('fading');
    render();
  }

  $('prev').addEventListener('click', () => go(-1));
  $('next').addEventListener('click', () => go(1));
  $('today').addEventListener('click', () => {
    const now = new Date();
    current = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    render();
  });
  $('date-input').addEventListener('change', (e) => {
    const [y, m, d] = e.target.value.split('-').map(Number);
    if (y && m && d) { current = new Date(y, m - 1, d); render(); }
  });
  window.addEventListener('hashchange', () => { current = startDate(); render(); });
  document.addEventListener('keydown', (e) => {
    if (!$('sheet').hidden || !$('about-sheet').hidden || !$('remind-sheet').hidden || e.target.tagName === 'INPUT') return;
    if (e.key === 'ArrowLeft') go(-1);
    if (e.key === 'ArrowRight') go(1);
  });

  // 左右滑動換日
  let touchX = null, touchY = null;
  stage.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; touchY = e.touches[0].clientY; }, { passive: true });
  stage.addEventListener('touchend', (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX, dy = e.changedTouches[0].clientY - touchY;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
    touchX = null;
  });

  $('save').addEventListener('click', async () => {
    if (!scene) return;
    const btn = $('save');
    btn.disabled = true;
    btn.textContent = '產生中…';
    try {
      const blob = await CardExport.makeImage((ctx) => draw(ctx, 1));
      const i = LunarInfo.info(current);
      CardExport.openSheet(blob, `空鏡日曆-${i.year}${pad(i.month)}${pad(i.day)}.png`, shareInfo(i));
    } finally {
      btn.disabled = false;
      btn.textContent = '存圖';
    }
  });

  // 分享到脆、LINE 的文字與連結；連結帶 #YYYYMMDD，點開就是這一天
  function shareInfo(i) {
    const e = entryOf(current);
    const url = `${location.origin}${location.pathname}#${i.year}${pad(i.month)}${pad(i.day)}`;
    if (!e) return { text: '空鏡日曆', url };
    const src = Card.sourceLine(e);
    return { text: `「${e.quote_zh}」${src ? '── ' + src : ''}`, url };
  }

  // 關於與授權
  const aboutSheet = $('about-sheet');
  const closeAbout = () => { aboutSheet.hidden = true; $('about').focus(); };
  $('about').addEventListener('click', () => { aboutSheet.hidden = false; $('about-close').focus(); });
  $('about-close').addEventListener('click', closeAbout);
  aboutSheet.addEventListener('click', (e) => { if (e.target === aboutSheet) closeAbout(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !aboutSheet.hidden) closeAbout(); });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { layout(); render(); }, 120);
  });

  // 跨日時自動換到新的一天（App 一直開著的情況）
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (+today !== +current && Math.abs(today - current) <= 86400000 * 2) { current = today; render(); }
  });

  async function loadJSON(url) {
    try {
      const r = await fetch(url);
      return r.ok ? r.json() : null;
    } catch (e) { return null; }
  }

  (async function init() {
    layout();
    const f = await loadJSON('data/festivals-tw.json');
    if (f) LunarInfo.setFestivals(f);
    if (params.has('sample')) samples = await loadJSON('tools/sample_quotes.json');
    await render();
  })();

  // 本機開發時不啟用離線快取，避免改了程式卻一直看到舊版
  if ('serviceWorker' in navigator && !['localhost', '127.0.0.1'].includes(location.hostname)) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* 不支援的環境略過 */ });
  }
})();
