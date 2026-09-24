"""把某月的語錄 JSON 轉成給人審閱的 Markdown。用法：python tools/review_md.py 2026-11"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
month = sys.argv[1]
d = json.loads((ROOT / "data" / "quotes" / f"{month}.json").read_text(encoding="utf-8"))
y, m = month.split("-")
# 2026 年沿用「N月審閱表.md」；2027 年起加年份，避免 2027-10 覆蓋 2026-10 的審閱表
name = f"{int(m)}月審閱表.md" if y == "2026" else f"{y}年{int(m)}月審閱表.md"
L = [f"# {y} 年 {int(m)} 月語錄審閱表", "", "每則：日期｜作品・角色・話數｜情緒。用字或話數說法不一時，採用哪一個、為什麼，寫在查證備註。", ""]
for k, e in d.items():
    src = "・".join(x for x in [f"《{e['work']}》{e['character']}", e["episode"]] if x)
    L += [f"## {k[5:].replace('-', '/')}　{src}　`{e['mood']}`", "", f"> {e['quote_zh']}  ", f"> {e['quote_ja']}", "", e["text"], ""]
    L += [f"查證備註：{e['check']}（[來源]({e['source_url']})）" if e["check"] else f"[來源]({e['source_url']})", ""]
(ROOT / name).write_text("\n".join(L), encoding="utf-8")
