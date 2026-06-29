# 玩家行動

## `recruit_crew`

| 欄位 | 內容 |
|---|---|
| 可用階段 | `main_action` |
| 條件 | 船員在手牌中；顏色可辨識；本回合尚未主行動 |
| 費用 | 通常無；若任選公開船員，支付 1 枚招募標記 |
| 結果 | 船員進入同色縱列；取得該縱列可見資源；依新船員顏色拿公開船員，或花招募標記任選；補公開船員 |
| 觸發 | 船員資源、金臂鐲第 3 張同色預留目的地、大煮釜等聖物 |
| 失敗 | 不改 state，回傳 `INVALID_CREW_CARD`、`MARKET_SLOT_EMPTY` 或 `INSUFFICIENT_RECRUIT_TOKEN` |

## `explore_destination`

| 欄位 | 內容 |
|---|---|
| 可用階段 | `main_action` |
| 條件 | 選到公開或預留目的地；能支付探索費 |
| 費用 | 使用者確認：同色任意 4 張船員卡；每枚招募標記可代替任意 1 張 |
| 結果 | 取得目的地；取得右上角獎勵；若同類型目的地牌庫仍有牌則補市場，耗盡則不補 |
| 失敗 | 不改 state，回傳 `INSUFFICIENT_CREW_COST` 或 `DESTINATION_NOT_AVAILABLE` |

## `trade`

| 欄位 | 內容 |
|---|---|
| 可用階段 | `pre_action_trade_window`、`post_action_trade_window` |
| 條件 | 本回合尚未貿易；支付 1-3 枚銀臂鐲 |
| 費用 | 銀臂鐲；支付 1/2/3 枚時分別取得左欄、左+中欄、左+中+右欄 |
| 結果 | 取得 `data/ship_tiles.json` 中所選船隻面的欄位資源，以及所有已取得目的地卡底部對應欄位資源 |
| 失敗 | 不改 state，回傳 `ALREADY_TRADED`、`INVALID_TRADE_AMOUNT`、`INSUFFICIENT_BRACELET` |
