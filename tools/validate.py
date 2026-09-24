"""語錄內容校對：python tools/validate.py

檢查 data/quotes/*.json 是否符合 SOP 的規格，有問題時列出並以 exit code 1 結束。
- 期間 2026-10-01 至 2027-12-31，每天一則，不缺也不重複
- 必填欄位：quote_zh、quote_ja、work、character、episode（可空白）、mood、text、source_url
- mood 必須是 12 種之一
- 中譯 45 字以內、短文 60～90 字
- 中譯裡不可有「」（要引用時用『』），兩人對話的 `「…」「…」` 格式除外
- check 欄不可殘留【待確認】（使用者 2026-09-24 決定改成挑最有根據的一個）
- 同一部作品最多 12 則（葬送的芙莉蓮例外）
- 同一句台詞不可重複使用（比對日文原句前 10 字）
"""
import collections
import datetime
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
START, END = datetime.date(2026, 10, 1), datetime.date(2027, 12, 31)
MOODS = {"departure", "perseverance", "friendship", "farewell", "longing", "kindness",
         "growth", "dream", "courage", "solitude", "acceptance", "everyday"}
REQUIRED = ["quote_zh", "quote_ja", "work", "character", "episode", "mood", "text", "source_url"]
WORK_LIMIT, EXEMPT = 12, {"葬送のフリーレン"}


def main(quote_dir=ROOT / "data" / "quotes"):
    errors = []
    entries = {}
    for f in sorted(Path(quote_dir).glob("*.json")):
        for k, e in json.loads(f.read_text(encoding="utf-8")).items():
            if k in entries:
                errors.append(f"{k} 日期重複（{f.name}）")
            entries[k] = e

    d = START
    while d <= END:
        if d.isoformat() not in entries:
            errors.append(f"{d} 缺少語錄")
        d += datetime.timedelta(days=1)

    works = collections.Counter()
    seen = {}
    for k, e in sorted(entries.items()):
        for field in REQUIRED:
            if field not in e or (field != "episode" and not str(e[field]).strip()):
                errors.append(f"{k} 缺少欄位 {field}")
        if e.get("mood") not in MOODS:
            errors.append(f"{k} mood 不合法：{e.get('mood')}")
        zh, text = e.get("quote_zh", ""), e.get("text", "")
        if len(zh) > 45:
            errors.append(f"{k} 中譯 {len(zh)} 字，超過 45")
        if not 60 <= len(text) <= 90:
            errors.append(f"{k} 短文 {len(text)} 字，不在 60～90")
        is_dialogue = zh.startswith("「") and zh.endswith("」") and "」「" in zh
        if "「" in zh and not is_dialogue:
            errors.append(f"{k} 中譯裡有「」，請改用『』：{zh}")
        if "待確認" in e.get("check", ""):
            errors.append(f"{k} check 還有【待確認】")
        works[e.get("work_ja") or e.get("work")] += 1
        key = e.get("quote_ja", "")[:10]
        if key in seen:
            errors.append(f"{k} 與 {seen[key]} 的台詞重複：{key}")
        seen[key] = k

    for w, n in works.items():
        if n > WORK_LIMIT and w not in EXEMPT:
            errors.append(f"《{w}》共 {n} 則，超過 {WORK_LIMIT} 則上限")

    print(f"共 {len(entries)} 則、{len(works)} 部作品；期間 {START}～{END}（應為 {(END - START).days + 1} 天）")
    if errors:
        print(f"發現 {len(errors)} 個問題：")
        for m in errors:
            print("  -", m)
        return 1
    print("全部通過")
    return 0


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:]))
