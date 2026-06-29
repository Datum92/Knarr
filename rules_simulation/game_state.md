# Game State 資料模型

```json
{
  "schema_version": "0.3",
  "game_id": "local-text-sim",
  "mode": "human_vs_computer",
  "player_count": 2,
  "modules": {
    "core": true,
    "relic_variant": true,
    "active_relic": "knarr_relic_gold_bracelet"
  },
  "status": "in_progress",
  "phase": "setup",
  "round": 0,
  "turn": 0,
  "turn_order": ["human", "computer"],
  "active_player_id": null,
  "board": "data/boards.json#board_main",
  "ship_tiles_by_id": "data/ship_tiles.json",
  "players": {
    "human": {
      "controller": "human",
      "score": 0,
      "reputation": 0,
      "ship_tile_side_id": "knarr_core_ship_tile_1_side_001",
      "traded_this_turn": false,
      "tokens": {"recruit_token": 1, "silver_bracelet": 1},
      "hand": [],
      "crew_area": {"blue": [], "yellow": [], "green": [], "red": [], "purple": []},
      "destinations": [],
      "reserved_destinations": []
    }
  },
  "zones": {
    "crew_deck": [],
    "crew_discard": [],
    "crew_market": [],
    "trade_post_deck": [],
    "trade_post_market": [],
    "settlement_deck": [],
    "settlement_market": []
  },
  "effect_queue": [],
  "log": []
}
```

## UI 邊界

未來 UI 僅支援 2 人玩家 vs 電腦。UI 不直接修改 state，只呼叫合法 action API。本階段未製作 UI。
