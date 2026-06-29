# 回合狀態機

| 階段 ID | 玩家可以做什麼 | 系統檢查 | 可能觸發 | 下一階段 |
|---|---|---|---|---|
| `setup` | 選玩家、模組、船隻面 | 依人數篩船員、洗牌、翻市場、發起始船員與手牌 | 聖物設置、命運標記抽起始玩家 | `turn_start` |
| `turn_start` | 無 | 設定 active player | 回合開始效果 | `reputation` |
| `reputation` | 無 | 依聲望軌給分 | 分數增加 | `pre_action_trade_window` |
| `pre_action_trade_window` | 貿易或略過 | 本回合是否已貿易、銀臂鐲足夠 | 貿易欄資源 | `main_action` |
| `main_action` | 招募或探索 | 行動合法、費用足夠、目標存在 | 船員資源、目的地獎勵、聖物 | `post_action_trade_window` |
| `post_action_trade_window` | 若尚未貿易，可貿易或略過 | 本回合是否已貿易 | 貿易欄資源 | `cleanup` |
| `cleanup` | 無 | 補公開區、標記上限、牌庫狀態 | 棄置超額、不補空目的地市場 | `check_victory` |
| `check_victory` | 無 | 是否達 40 分、是否完成終局輪次 | 終局觸發/結算 | `turn_start` 或 `game_end` |
| `game_end` | 無 | 分數最高者獲勝；分數平手即共享勝利 | 無 | 結束 |
