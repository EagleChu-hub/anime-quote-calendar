# 2026 年 9 月 25～30 日的 6 則（使用者 2026-09-25 要求補上上線前這幾天）。執行後產生 data/quotes/2026-09.json。
# 欄位：quote_zh 中譯、quote_ja 日文原句、work／character／episode 出處、mood 情緒、text 短文、
#       work_ja 日文作品名（紀錄用）、source_url 查證日文原句的網頁、check 查證備註
import collections
import json
from pathlib import Path

E = []


def q(date, work, work_ja, character, episode, mood, ja, zh, text, url, check=""):
    E.append(dict(date=date, quote_zh=zh, quote_ja=ja, work=work, work_ja=work_ja, character=character,
                  episode=episode, mood=mood, text=text, source_url=url, check=check))


q("2026-09-25", "夏日大作戰", "サマーウォーズ", "陣內榮", "", "longing",
  "大事なのは昔のように、人と人が声をかけ合ってコミュニケーションをとること", "重要的是像從前那樣，人和人互相打聲招呼、好好說說話。",
  "今天是中秋節，月亮最圓，也最適合團聚。人不在身邊也沒關係，打通電話、傳張月亮的照片給家人，說一聲中秋快樂。聲音傳到了，就是團圓。",
  "https://eiga-square.jp/title/summer_wars/quotes/8", "映畫スクエア名言一覽第 8 則")
q("2026-09-26", "葬送的芙莉蓮", "葬送のフリーレン", "芙莉蓮", "第 1 季 第 21 話", "dream",
  "魔法は探し求めている時が一番楽しいんだよ", "魔法啊，就是在尋找它的時候最快樂。",
  "週末，找一件純粹因為好奇而做的事吧：翻一本沒看過的書，走一條沒走過的路。芙莉蓮拒絕了現成的魔法，因為尋找的過程本身，就是最大的樂趣。",
  "https://anime-lines.com/archives/203",
  "年輕的芙莉蓮拒絕賽莉耶授予魔法的回憶場景；第 21 話「魔法の世界」依 MANTANWEB 與 manga-games 的第 21 話介紹")
q("2026-09-27", "迷宮飯", "ダンジョン飯", "森西", "", "everyday",
  "好きでやっていることだ、何も辛くはないよ", "這是我喜歡才做的事，一點也不辛苦。",
  "有些事做起來很累，卻一點也不苦，因為是自己喜歡的。星期天，留一段時間給那件事吧，種花、做菜、整理房間都好。喜歡的事，會把力氣還給你。",
  "https://animemanga33.com/archives/61219", "在魔像背上種菜的場景（原作第 2 集，動畫有演出）；話數未查到")
q("2026-09-28", "暗殺教室", "暗殺教室", "殺老師", "第 1 季 第 2 話", "kindness",
  "私は地球を滅ぼしますが、その前に君達の先生です", "我會毀滅地球，但在那之前，我是你們的老師。",
  "今天是教師節。說要毀滅地球的殺老師，卻比誰都認真當老師。想想那位曾經改變過你的老師，傳個訊息說聲謝謝吧，對方一定會很開心。",
  "https://animemanga33.com/archives/68898", "animemanga33 標為第 2 話")
q("2026-09-29", "夏目友人帳", "夏目友人帳", "夏目貴志", "第 1 季 第 7 話", "friendship",
  "嬉しいものなんだな。誰かから何かを頼まれるって", "原來被人拜託事情，是這麼開心的一件事啊。",
  "被拜託，其實也是被信任。一直怕給人添麻煩的夏目，被人開口請託時，才發現自己是被需要的。今天試著請身邊的人幫個小忙，再好好說聲謝謝。",
  "https://animemanga33.com/archives/22475", "animemanga33 標為第一期第 7 話")
q("2026-09-30", "ARIA（水星領航員）", "ARIA", "水無燈里", "第 3 季 第 4 話", "departure",
  "いつでも、どこでも、なんどでも。チャレンジしたいって思ったときが真っ白なスタートです。",
  "不管何時、何地、第幾次，想挑戰的那一刻，就是全新的起點。",
  "九月的最後一天。這個月沒做到的事，不用急著怪自己。明天就是十月，一個全新的開始。挑一件想重新挑戰的事，寫在明天待辦清單的第一行吧。",
  "https://kenchi555.hatenablog.com/entry/20080203/1201994460",
  "ARIA The ORIGINATION 第 4 話「その 明日を目指すものたちは…」；原句後面還有「自分で自分をおしまいにしない限り…」，這裡只節錄前兩句。原作漫畫寫法為「何時でも何処でも何度でも」，採用動畫台詞的寫法")

out = {}
for e in E:
    out[e.pop("date")] = e
Path(__file__).resolve().parent.parent.joinpath("data/quotes/2026-09.json").write_text(
    json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

print("則數", len(out), "作品數", len({e["work"] for e in out.values()}))
print(collections.Counter(e["mood"] for e in out.values()))
for d, e in out.items():
    zl, tl = len(e["quote_zh"]), len(e["text"])
    flag = ("中譯超過45 " if zl > 45 else "") + ("短文不在60-90 " if not 60 <= tl <= 90 else "")
    if flag:
        print(d, e["work"], zl, tl, flag)
