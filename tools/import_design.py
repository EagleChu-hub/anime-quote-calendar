"""把 Claude Design 交回的美術匯入程式使用的位置。

用法：python tools/import_design.py
- 第一批 design-return/：
  - elements/*.svg → assets/elements/（移除存檔時自動加上的 <metadata> 來源標記，縮小檔案）
  - scenes.json、tokens.json → data/
  - icon/app-icon.svg → assets/icon/
- 第二批 design-return-2/（自然風景）：
  - elements/*.svg → assets/elements/（只有新元素，不覆蓋舊的）
  - scenes.json → data/scenes-2.json
data/scenes-extra.json 是 Claude Code 自己補的，這支程式不會動它。
"""
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "elements"


def strip(svg: str) -> str:
    return re.sub(r"<metadata>.*?</metadata>", "", svg, flags=re.S)


def copy_elements(src: Path) -> int:
    total = 0
    for f in sorted((src / "elements").glob("*.svg")):
        s = strip(f.read_text(encoding="utf-8"))
        (OUT / f.name).write_text(s, encoding="utf-8")
        total += len(s.encode("utf-8"))
    return total


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    first = ROOT / "design-return"
    total = copy_elements(first)
    (ROOT / "assets" / "icon").mkdir(parents=True, exist_ok=True)
    icon = strip((first / "icon" / "app-icon.svg").read_text(encoding="utf-8"))
    (ROOT / "assets" / "icon" / "app-icon.svg").write_text(icon, encoding="utf-8")
    for name in ("scenes.json", "tokens.json"):
        shutil.copyfile(first / name, ROOT / "data" / name)

    second = ROOT / "design-return-2"
    if second.exists():
        total += copy_elements(second)
        shutil.copyfile(second / "scenes.json", ROOT / "data" / "scenes-2.json")

    print(f"元素 {len(list(OUT.glob('*.svg')))} 個，共 {total / 1024:.0f} KB")


if __name__ == "__main__":
    main()
