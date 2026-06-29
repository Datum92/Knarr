# 卡牌效果分類

| 類型 | 說明 | Knarr 例子 |
|---|---|---|
| `immediate` | 取得後立即處理 | 目的地右上角獎勵 |
| `activated` | 玩家主動選擇使用 | 貿易 |
| `triggered` | 條件達成時觸發 | 金臂鐲、銀錢幣、護身符 |
| `replacement` | 修改某步驟 | 大煮釜招募後拿公開船員 |
| `setup` | 設置時生效 | 命運標記抽起始玩家、依人數篩船員 |

## 圖標資料化原則

- 船員頂端圖標：已寫入 `top_resource_icon`。
- 船員左下人數標記：已寫入 `player_count_marker` 與 `valid_player_counts`。
- 目的地探索費：統一為 `same_color_any` + `crew_cards: 4`。
- 目的地右上獎勵與底部貿易欄：已依 high-res review sheet 校對，confidence 為 `high`。
