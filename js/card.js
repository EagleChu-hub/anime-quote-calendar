// 卡片：全版空鏡風景，上方日期，下方像電影字幕的台詞區。
// 座標、字級、行高都取自 data/tokens.json 的 layout（Claude Design 交付）。
(function (global) {
  const W = 1080, H = 1920;
  const FALLBACK = '"PingFang TC", "Microsoft JhengHei", sans-serif';
  const font = (f, weight, size) => `${weight} ${size}px "${f}", ${FALLBACK}`;

  const EMPTY = {
    quote_zh: '這一天的台詞，還在路上。',
    quote_ja: '',
    work: '', character: '', episode: '',
    text: '還沒有找到適合今天的那一句。抬頭看看天空吧，今天的雲也只會出現這一次。',
    mood: 'everyday',
  };

  function sourceLine(e) {
    if (!e.work) return '';
    const parts = [`《${e.work}》`, e.character].filter(Boolean).join('');
    return e.episode ? `${parts}・${e.episode}` : parts;
  }

  function dateLines(info) {
    const week = info.week;
    const line1 = `${info.year}.${String(info.month).padStart(2, '0')}・${week}`;
    const tags = [...info.festivals, info.jieqi].filter(Boolean);
    const line2 = (tags.length ? tags.join('・') + '・' : '') + '農曆' + info.lunarDate;
    return { line1, line2 };
  }

  function fontsFor(entry, info, tokens) {
    const L = tokens.layout;
    const { line1, line2 } = dateLines(info);
    const zh = [entry.quote_zh, entry.text, sourceLine(entry), line1, line2, '「」0123456789'].join('');
    const ja = (entry.quote_ja || '') + L.mark.text + '「」';
    const q = L.quoteBlock;
    return [
      document.fonts.load(font(L.date.day.font, L.date.day.weight, 60), '0123456789'),
      document.fonts.load(font(q.quote.font, q.quote.weight, 60), zh),
      document.fonts.load(font(q.essay.font, q.essay.weight, 60), zh),
      document.fonts.load(font(q.source.font, q.source.weight, 60), zh),
      document.fonts.load(font(L.date.meta.line1.font, L.date.meta.line1.weight, 60), zh),
      document.fonts.load(font(q.jp.font, q.jp.weight, 60), ja),
    ];
  }

  // 逐字換行（中日文），遵守避頭點：行首不可以是 kinsoku 裡的標點，遇到就把上一行最後一個字帶下來
  function wrap(ctx, text, maxWidth, kinsoku) {
    const chars = Array.from(text);
    const lines = [];
    let line = '';
    for (const ch of chars) {
      if (line && ctx.measureText(line + ch).width > maxWidth && !kinsoku.includes(ch)) {
        lines.push(line);
        line = ch;
      } else if (line && ctx.measureText(line + ch).width > maxWidth) {
        // 標點不能放行首：把上一行最後一字連同標點移到下一行
        const prev = Array.from(line);
        const carry = prev.pop();
        lines.push(prev.join(''));
        line = carry + ch;
      } else {
        line += ch;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  // 平衡換行：行數與貪婪換行相同，但把寬度縮到剛好不增加行數，讓每行長度接近
  function balance(ctx, text, maxWidth, kinsoku) {
    const n = wrap(ctx, text, maxWidth, kinsoku).length;
    if (n <= 1) return [text];
    let lo = maxWidth / n, hi = maxWidth;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      if (wrap(ctx, text, mid, kinsoku).length > n) lo = mid; else hi = mid;
    }
    return wrap(ctx, text, hi, kinsoku);
  }

  // 對話（兩人一來一往）已自帶「」，不再外包一層
  const quoted = (t) => (t.startsWith('「') ? t : `「${t}」`);

  function colorOf(p, key) { return p.text[key || 'primary']; }

  function drawDate(ctx, info, L, p) {
    const d = L.date;
    const dayText = String(info.day).padStart(2, '0');
    ctx.fillStyle = colorOf(p);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = font(d.day.font, d.day.weight, d.day.size);
    ctx.fillText(dayText, d.x, d.top + d.day.baselineFromTop);
    const mx = d.x + ctx.measureText(dayText).width + d.meta.gapFromDay;

    const { line1, line2 } = dateLines(info);
    const m1 = d.meta.line1, m2 = d.meta.line2;
    ctx.font = font(m1.font, m1.weight, m1.size);
    ctx.fillText(line1, mx, d.top + m1.baselineFromTop);
    ctx.font = font(m2.font, m2.weight, m2.size);
    ctx.fillStyle = colorOf(p, m2.opacityKey);
    ctx.fillText(line2, mx, d.top + m2.baselineFromTop);
  }

  function drawMark(ctx, L, p) {
    const m = L.mark;
    ctx.save();
    ctx.font = font(m.font, m.weight, m.size);
    if ('letterSpacing' in ctx) ctx.letterSpacing = m.letterSpacing + 'px';
    const tw = ctx.measureText(m.text).width - (('letterSpacing' in ctx) ? m.letterSpacing : 0);
    const [py, px] = m.padding;
    const w = tw + px * 2, h = m.size + py * 2;
    const x = m.right - w, y = m.top;
    ctx.strokeStyle = colorOf(p, 'secondary');
    ctx.lineWidth = m.border;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = colorOf(p, 'secondary');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(m.text, x + px, y + h / 2 + 1);
    ctx.restore();
  }

  // 台詞區：由下往上堆疊，先量出各段高度，再從 bottom − 總高 開始畫
  function drawQuote(ctx, e, L, p) {
    const q = L.quoteBlock;
    const cx = W / 2, maxW = q.maxWidth, left = cx - maxW / 2;
    const blocks = [];

    let qs = q.quote.size, ql = q.quote.lineHeight;
    ctx.font = font(q.quote.font, q.quote.weight, qs);
    const quoteText = quoted(e.quote_zh);
    let lines = balance(ctx, quoteText, maxW, q.kinsoku);
    if (lines.length > q.quote.maxLines) {
      qs = q.quote.fallbackSize; ql = q.quote.fallbackLineHeight;
      ctx.font = font(q.quote.font, q.quote.weight, qs);
      lines = balance(ctx, quoteText, maxW, q.kinsoku);
    }
    blocks.push({ lines, f: font(q.quote.font, q.quote.weight, qs), lh: ql, gap: 0, color: colorOf(p), align: 'center' });

    if (e.quote_ja) {
      ctx.font = font(q.jp.font, q.jp.weight, q.jp.size);
      blocks.push({ lines: balance(ctx, quoted(e.quote_ja), maxW, q.kinsoku), f: ctx.font, lh: q.jp.lineHeight, gap: q.jp.gapTop, color: colorOf(p, q.jp.colorKey), align: 'center' });
    }
    const src = sourceLine(e);
    if (src) {
      blocks.push({ lines: [src], f: font(q.source.font, q.source.weight, q.source.size), lh: q.source.lineHeight, gap: q.source.gapTop, color: colorOf(p, q.source.colorKey), align: 'center' });
    }
    blocks.push({ divider: true, gap: q.divider.gapTop, h: q.divider.height + q.divider.gapBottom });
    ctx.font = font(q.essay.font, q.essay.weight, q.essay.size);
    let essay = wrap(ctx, e.text, maxW, q.kinsoku);
    // 最後一行太短（例如只剩「點。」）時改用平衡換行，避免孤字
    if (essay.length > 1 && ctx.measureText(essay[essay.length - 1]).width < maxW / 3) essay = balance(ctx, e.text, maxW, q.kinsoku);
    essay = essay.slice(0, q.essay.maxLines);
    blocks.push({ lines: essay, f: ctx.font, lh: q.essay.lineHeight, gap: 0, color: colorOf(p), alpha: q.essay.opacity, align: 'left' });

    const total = blocks.reduce((s, b) => s + b.gap + (b.divider ? b.h : b.lines.length * b.lh), 0);
    let y = q.bottom - total;
    ctx.textBaseline = 'middle';
    for (const b of blocks) {
      y += b.gap;
      if (b.divider) {
        ctx.save();
        ctx.globalAlpha = q.divider.opacity;
        ctx.fillStyle = colorOf(p);
        ctx.fillRect(cx - q.divider.width / 2, y, q.divider.width, q.divider.height);
        ctx.restore();
        y += b.h;
        continue;
      }
      ctx.save();
      ctx.font = b.f;
      ctx.fillStyle = b.color;
      ctx.globalAlpha = b.alpha ?? 1;
      ctx.textAlign = b.align;
      for (const line of b.lines) {
        ctx.fillText(line, b.align === 'center' ? cx : left, y + b.lh / 2);
        y += b.lh;
      }
      ctx.restore();
    }
  }

  /**
   * @param entry 當天內容（沒有時用 EMPTY）
   * @param info  LunarInfo.info()
   * @param prep  Scene.prepare() 的結果
   */
  function render(ctx, entry, info, prep) {
    const e = entry || EMPTY;
    const L = prep.tokens.layout;
    Scene.draw(ctx, prep);
    // 文字加一層很淡的柔影：向日葵、雲的亮面剛好落在文字後面時仍清楚可讀
    ctx.save();
    ctx.shadowColor = 'rgba(4, 9, 16, 0.55)';
    ctx.shadowBlur = 14 * ctx.getTransform().a; // shadowBlur 不受縮放影響，要自己換算成螢幕像素
    drawDate(ctx, info, L, prep.palette);
    drawMark(ctx, L, prep.palette);
    drawQuote(ctx, e, L, prep.palette);
    ctx.restore();
  }

  global.Card = { W, H, render, fontsFor, sourceLine, EMPTY };
})(window);
