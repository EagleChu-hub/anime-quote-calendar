# 空鏡日曆

每天一句日本動畫台詞（日文原句、中文翻譯、出處），配上一段短文和一幅沒有人物的原創風景。
收錄 2026-10-01 至 2027-12-31，共 457 天。可安裝成 PWA，也能存成 1080×1920 圖卡。

網站：https://eaglechu-hub.github.io/anime-quote-calendar/

## 版權

- 台詞的著作權屬於各作品的原作者與製作公司。本站只做簡短引用（每天一則）並標明作品、角色與集數，目的是介紹與推薦作品，非營利。
- 中文翻譯由本站依日文原句自行翻譯；短文為原創撰寫。
- 風景元素與圖示為原創繪製，畫面中沒有任何角色，也不描摹任何作品的畫面。
- 權利人如認為引用不妥，請開 [Issue](https://github.com/EagleChu-hub/anime-quote-calendar/issues) 告知，我們會儘速移除。

## 使用的開源資源

- 字型：Noto Sans TC、Zen Kaku Gothic New（SIL Open Font License，經 Google Fonts 載入）
- 農曆與節氣：[lunar-javascript](https://github.com/6tail/lunar-javascript)（MIT License）

## 開發

- 本機預覽：`python tools/dev_server.py`，開 http://localhost:8765
- 內容：`data/quotes/YYYY-MM.json`，由 `tools/draft_YYYY_MM.py` 產生
- 校對：`python tools/validate.py`
