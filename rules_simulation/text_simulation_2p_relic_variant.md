# 2 人文字模擬：核心 + 聖物變體

> 模式：`modules = { core: true, relic_variant: true }`
> 聖物：依規則雙人建議，使用「蜜酒杯」。
> 目的：驗證 module toggle、setup effect 與探索後聖物效果窗口。

## 初始設置差異

核心設置同 `text_simulation_2p_core.md`。額外設置：

1. `active_relic_id = knarr_relic_mead_cup`
2. 其他聖物卡本局不使用。

## Round 1 - P1

P1 招募藍色船員。因蜜酒杯條件是「執行探索行動」，本回合不觸發。

## Round 1 - P2

P2 招募紅色船員。未觸發蜜酒杯。

## Round 2 - P1

| 階段 | 事件 | State 摘要 |
|---|---|---|
| `reputation` | P1 依聲望得分。 | 分數更新 |
| `main_action` | P1 探索 1 張代表性貿易點，支付船員或招募標記。 | P1 目的地 +1 |
| `action.explore.claim_destination` | 取得目的地右上角代表性獎勵。 | 資源更新 |
| `action.after_main` | 檢查蜜酒杯：本回合執行探索，條件成立。 | 聖物進入可執行窗口 |
| `relic.mead_cup` | P1 選擇棄置 1 張公開船員卡，從船員牌庫頂補 1 張。 | 公開船員市場刷新 1 張 |
| `cleanup` | 補牌、上限、勝利檢查。 | 無終局 |

## 流程驗證結果

| 檢查 | 結果 |
|---|---|
| 模組可開關 | 通過 |
| 聖物設置時只選 1 張 | 通過 |
| 聖物 timing window 能接在探索後 | 通過 |
| 聖物效果不直接修改 UI | 通過，作為 state action 處理 |

## 發現的問題

金臂鐲已依使用者裁定資料化：預留目的地後立即補同類型目的地市場。本檔為蜜酒杯舊流程示例，正式 2 人玩家 vs 電腦文字模擬請以 `text_simulation_2p_player_vs_computer.md` 為準。
