# 2 人文字模擬：核心遊戲

> 目的：驗證第 1-7 階段資料結構、狀態機與行動流程能跑通。
> 模式：`modules = { core: true, relic_variant: false }`
> 注意：此模擬使用暫定設置與代表性卡牌圖標，不視為官方完整對局。

## 初始設置

- 玩家：P1、P2。
- P1 起始手牌：`knarr_core_crew_002` 藍、`knarr_core_crew_012` 黃、`knarr_core_crew_022` 綠。
- P2 起始手牌：`knarr_core_crew_032` 紅、`knarr_core_crew_042` 紫、`knarr_core_crew_013` 黃。
- 公開船員市場：藍、黃、綠、紅、紫各 1 張。
- 公開目的地市場：3 張貿易點、3 張定居點。
- 雙方分數 0、聲望 0、招募標記 0、銀臂鐲 0。

## Round 1 - P1

| 階段 | 事件 | State 摘要 |
|---|---|---|
| `reputation` | P1 聲望 0，得 0 分。 | P1 分數 0 |
| `pre_action_trade_window` | P1 無銀臂鐲，略過貿易。 | `traded_this_turn=false` |
| `main_action` | P1 招募藍色船員 `knarr_core_crew_002`。 | P1 藍色縱列 1 張 |
| `action.recruit.gain_resources` | 依該縱列可見頂端圖標取得 1 個代表性資源：聲望 +1。 | P1 聲望 1 |
| `action.recruit.take_market_card` | P1 依藍色拿取公開船員 1 張，市場補 1 張。 | P1 手牌維持 3 張 |
| `post_action_trade_window` | 仍無銀臂鐲，略過。 | 無 |
| `cleanup` | 標記未超過上限，牌庫未空。 | 無 |
| `check_victory` | P1 未達 40 分。 | 下一玩家 P2 |

## Round 1 - P2

| 階段 | 事件 | State 摘要 |
|---|---|---|
| `reputation` | P2 聲望 0，得 0 分。 | P2 分數 0 |
| `pre_action_trade_window` | 無銀臂鐲，略過。 | 無 |
| `main_action` | P2 招募紅色船員 `knarr_core_crew_032`。 | P2 紅色縱列 1 張 |
| `action.recruit.gain_resources` | 取得代表性資源：銀臂鐲 +1。 | P2 銀臂鐲 1 |
| `action.recruit.take_market_card` | P2 依紅色拿公開船員，市場補牌。 | P2 手牌維持 3 張 |
| `post_action_trade_window` | P2 花 1 銀臂鐲貿易，取得最左欄代表性資源：勝利分數 +1。 | P2 分數 1、銀臂鐲 0 |
| `cleanup` | 標記未超過上限。 | 無 |
| `check_victory` | P2 未達 40 分。 | Round 2 |

## Round 2 - P1

| 階段 | 事件 | State 摘要 |
|---|---|---|
| `reputation` | P1 聲望 1，聲望階段暫以 +1 分處理。 | P1 分數 1 |
| `pre_action_trade_window` | 無銀臂鐲，略過。 | 無 |
| `main_action` | P1 招募黃色船員。 | P1 黃色縱列 1 張 |
| `action.recruit.gain_resources` | 取得代表性資源：招募標記 +1。 | P1 招募 1 |
| `post_action_trade_window` | 無銀臂鐲，略過。 | 無 |
| `check_victory` | 未達 40 分。 | P2 |

## Round 2 - P2

| 階段 | 事件 | State 摘要 |
|---|---|---|
| `reputation` | P2 聲望 0，得 0 分。 | P2 分數 1 |
| `pre_action_trade_window` | 無銀臂鐲，略過。 | 無 |
| `main_action` | P2 探索 1 張低費用貿易點，支付紅色船員 1 張。 | P2 紅色縱列 -1、目的地 +1 |
| `action.explore.claim_destination` | 取得目的地右上角代表性獎勵：勝利分數 +2。 | P2 分數 3 |
| `cleanup` | 補 1 張貿易點。 | 市場維持 6 張 |
| `check_victory` | 未達 40 分。 | 模擬停止 |

## 流程驗證結果

| 檢查 | 結果 |
|---|---|
| 狀態機階段是否能前進 | 通過 |
| 招募是否有條件與結果 | 通過 |
| 探索是否有條件、費用與結果 | 通過，但卡牌圖標需校對 |
| 貿易是否受每回合一次限制 | 通過 |
| 補牌與清理是否有固定窗口 | 通過 |
| 勝利條件是否可檢查 | 通過 |

## 發現的問題

正式模擬必須補齊每張卡的圖標資料，否則探索費用與貿易欄只能用代表性資源測試流程，不能驗證完整平衡。
