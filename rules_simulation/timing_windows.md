# Timing Windows

| Window | 時機 | 範例 |
|---|---|---|
| `setup` | 遊戲設置時 | 篩牌、抽起始船員、命運標記決定起始玩家 |
| `turn_start` | 玩家回合開始 | 設定 active player |
| `reputation.score` | 聲望階段 | 依聲望軌給分 |
| `action.recruit.commit` | 招募船員放入船員區後 | 取得可見資源、檢查金臂鐲 |
| `action.recruit.take_market_card` | 招募後拿公開船員 | 大煮釜替代效果 |
| `action.explore.pay_cost` | 探索支付費用 | 同色任意 4 張與招募標記替代 |
| `action.explore.after` | 取得目的地後 | 右上角獎勵、聖物觸發 |
| `trade.resolve` | 貿易結算 | 依銀臂鐲數量取得欄位 |
| `cleanup.refill` | 清理補牌 | 目的地牌庫空時不補 |
| `victory.check` | 回合結束後 | 40 分終局與平手判斷 |
