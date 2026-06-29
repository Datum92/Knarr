# 遊戲配件資料化

| 類型 | ID/資料檔 | 說明 |
|---|---|---|
| 船員卡 | `data/cards.json` type=`crew` | 已校對頂端資源圖標、人數標記與 2P 可用性。 |
| 貿易點 | `data/cards.json` subtype=`trade_post` | 探索費、右上角獎勵與底部貿易欄已完成 high-confidence 校對。 |
| 定居點 | `data/cards.json` subtype=`settlement` | 探索費、右上角獎勵與底部貿易欄已完成 high-confidence 校對。 |
| 主板 | `data/boards.json` | 聲望軌給分表已資料化。 |
| 船隻板塊 | `data/ship_tiles.json` | 8 面船隻板塊以 side_id 建立貿易欄與船帆印刷圖標資料。 |
| 聖物 | `data/artifacts.json` | 已更新金臂鐲立即補目的地裁定。 |
| 起始設置 | `data/setup_presets.json` | 2 人玩家 vs 電腦 preset，指定文字模擬使用的船隻板塊面。 |
| 圖標校對表 | `data/card_icon_audit.csv` | 人工校對表，目的地卡已更新為 high confidence。 |

## 資源圖標

| ID | 中文 | 引擎處理 |
|---|---|---|
| `victory_point` | 勝利分數 | 增加分數。 |
| `silver_bracelet` | 銀臂鐲標記 | 增加銀臂鐲，最多 3。 |
| `recruit_token` | 招募標記 | 增加招募標記，最多 3。 |
| `reputation` | 聲望值 | 推進聲望軌；回合開始依 `data/boards.json` 的最高已達給分格得分。 |
| `draw_crew_card` | 抽取並放置船員 | 從船員牌庫頂放置 1 張船員到船員區，不取得該卡資源。 |
