from __future__ import annotations

import json
import random
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
COLORS = ["red", "yellow", "green", "blue", "purple"]
COLOR_ZH = {"red": "紅", "yellow": "黃", "green": "綠", "blue": "藍", "purple": "紫"}
RESOURCE_ZH = {
    "victory_point": "勝利分數",
    "silver_bracelet": "銀臂鐲",
    "recruit_token": "招募標記",
    "reputation": "聲望",
    "draw_crew_card": "抽放船員",
}
TOKEN_CAP = {"recruit_token": 3, "silver_bracelet": 3}


class DeckIssue(RuntimeError):
    pass


def load_cards() -> list[dict]:
    return json.loads((ROOT / "data" / "cards.json").read_text(encoding="utf-8"))["cards"]


def load_board() -> dict:
    return json.loads((ROOT / "data" / "boards.json").read_text(encoding="utf-8"))["boards"][0]


def load_ship_tiles() -> dict[str, dict]:
    sides = json.loads((ROOT / "data" / "ship_tiles.json").read_text(encoding="utf-8"))["sides"]
    return {side["id"]: side for side in sides}


def clone_card(card: dict) -> dict:
    return {
        "id": card["id"],
        "type": card["type"],
        "subtype": card.get("subtype"),
        "sequence": card["sequence"],
        "color": card.get("color"),
        "top_resource_icon": card.get("top_resource_icon"),
        "reward_icons": card.get("reward_icons", []),
        "trade_column_icons": card.get("trade_column_icons", []),
        "points": card.get("points"),
    }


def card_label(card: dict | None) -> str:
    if card is None:
        return "空"
    if card.get("type") == "crew":
        return f"{COLOR_ZH.get(card.get('color'), card.get('color'))}船員{card['sequence']:02d}/{RESOURCE_ZH.get(card.get('top_resource_icon'), card.get('top_resource_icon'))}"
    if card.get("subtype") == "trade_post":
        return f"貿易點{card['sequence']:02d}"
    if card.get("subtype") == "settlement":
        return f"定居點{card['sequence']:02d}"
    return card["id"]


def draw_crew(state: dict, rng: random.Random, purpose: str) -> dict:
    if not state["zones"]["crew_deck"]:
        if state["zones"]["crew_discard"]:
            rng.shuffle(state["zones"]["crew_discard"])
            state["zones"]["crew_deck"] = state["zones"]["crew_discard"]
            state["zones"]["crew_discard"] = []
            state["log"].append("船員牌庫耗盡：洗混棄牌堆形成新牌庫。")
        else:
            raise DeckIssue(f"{purpose}: CREW_DECK_EXHAUSTED_NOT_ADJUDICATED")
    return state["zones"]["crew_deck"].pop(0)


def draw_until_distinct(deck: list[dict], count: int) -> list[dict]:
    picked: list[dict] = []
    used: set[str] = set()
    rest: list[dict] = []
    while deck and len(picked) < count:
        card = deck.pop(0)
        if card["color"] not in used:
            picked.append(card)
            used.add(card["color"])
        else:
            rest.append(card)
    deck[:0] = rest
    return picked


def refill_crew_market_slot(state: dict, slot_index: int, rng: random.Random) -> None:
    try:
        state["zones"]["crew_market"][slot_index]["card"] = draw_crew(state, rng, "refill crew market")
    except DeckIssue as exc:
        state["zones"]["crew_market"][slot_index]["card"] = None
        state["issues"].append(str(exc))


def refill_destination(state: dict, subtype: str) -> None:
    market_key = f"{subtype}_market"
    deck_key = f"{subtype}_deck"
    if state["zones"][deck_key]:
        state["zones"][market_key].append(state["zones"][deck_key].pop(0))
    else:
        state["log"].append(f"{'貿易點' if subtype == 'trade_post' else '定居點'}牌庫耗盡：公開市場不補。")


def reputation_award(state: dict, position: int) -> int:
    track = state["board"]["reputation_track"]
    capped_position = max(track["start_position"], min(position, track["max_position"]))
    award = 0
    for threshold in track["score_thresholds"]:
        if capped_position >= threshold["min_position"]:
            award = threshold["score"]
    return award


def add_resource(state: dict, player: dict, icon: str, amount: int = 1, reason: str = "") -> None:
    if icon == "victory_point":
        player["score"] += amount
        state["log"].append(f"{player['name']} 獲得 {amount} 分。{reason}")
    elif icon in ("recruit_token", "silver_bracelet"):
        before = player["tokens"][icon]
        player["tokens"][icon] = min(TOKEN_CAP[icon], before + amount)
        gained = player["tokens"][icon] - before
        state["log"].append(f"{player['name']} 獲得 {gained} 枚{RESOURCE_ZH[icon]}。{reason}")
    elif icon == "reputation":
        before = player["reputation"]
        max_position = state.get("board", {}).get("reputation_track", {}).get("max_position")
        target = before + amount
        if max_position is not None:
            target = min(target, max_position)
        player["reputation"] = target
        gained = target - before
        state["log"].append(f"{player['name']} 聲望 +{gained}。{reason}")
    elif icon == "draw_crew_card":
        for _ in range(amount):
            try:
                card = draw_crew(state, state["rng"], "draw crew from icon")
                player["crew_area"][card["color"]].append(card)
                state["log"].append(f"{player['name']} 因圖標抽放 {card_label(card)}，不拿取該卡資源。{reason}")
            except DeckIssue as exc:
                state["issues"].append(str(exc))
    else:
        state["issues"].append(f"UNKNOWN_RESOURCE_ICON:{icon}")


def apply_reward_icons(state: dict, player: dict, icons: list[dict], reason: str) -> None:
    for item in icons:
        add_resource(state, player, item["icon"], int(item.get("amount", 1)), reason)


def visible_column_icons(player: dict, color: str) -> list[str]:
    return [card["top_resource_icon"] for card in player["crew_area"][color]]


def choose_recruit_card(player: dict) -> dict | None:
    if not player["hand"]:
        return None
    def score(card: dict) -> tuple[int, int, int]:
        col_len = len(player["crew_area"][card["color"]])
        trigger_bonus = 10 if col_len == 2 else 0
        build_bonus = col_len
        vp_bonus = 1 if card.get("top_resource_icon") == "victory_point" else 0
        return (trigger_bonus, build_bonus, vp_bonus)
    return max(player["hand"], key=score)


def choose_explore_payment(player: dict) -> tuple[str, int, int] | None:
    best: tuple[str, int, int] | None = None
    for color in COLORS:
        crew_count = len(player["crew_area"][color])
        tokens = player["tokens"]["recruit_token"]
        if crew_count + tokens >= 4:
            use_cards = min(4, crew_count)
            use_tokens = 4 - use_cards
            candidate = (color, use_cards, use_tokens)
            if best is None or use_cards > best[1]:
                best = candidate
    return best


def choose_destination(state: dict, player: dict) -> tuple[str, int, dict] | None:
    if player["reserved_destinations"]:
        card = player["reserved_destinations"][0]
        return ("reserved", 0, card)
    candidates: list[tuple[str, int, dict]] = []
    for key in ("settlement_market", "trade_post_market"):
        for idx, card in enumerate(state["zones"][key]):
            candidates.append((key, idx, card))
    if not candidates:
        return None
    def value(item: tuple[str, int, dict]) -> int:
        return sum(int(icon.get("amount", 1)) for icon in item[2].get("reward_icons", []) if icon.get("icon") == "victory_point")
    return max(candidates, key=value)


def explore(state: dict, player: dict) -> bool:
    payment = choose_explore_payment(player)
    target = choose_destination(state, player)
    if payment is None or target is None:
        return False
    color, use_cards, use_tokens = payment
    source_key, index, destination = target
    for _ in range(use_cards):
        state["zones"]["crew_discard"].append(player["crew_area"][color].pop())
    player["tokens"]["recruit_token"] -= use_tokens
    if source_key == "reserved":
        player["reserved_destinations"].pop(index)
    else:
        subtype = "settlement" if source_key == "settlement_market" else "trade_post"
        state["zones"][source_key].pop(index)
        refill_destination(state, subtype)
    player["destinations"].append(destination)
    state["log"].append(
        f"{player['name']} 探索取得 {card_label(destination)}，支付 {COLOR_ZH[color]}色船員 {use_cards} 張"
        f"{'與招募標記 ' + str(use_tokens) + ' 枚' if use_tokens else ''}。"
    )
    apply_reward_icons(state, player, destination.get("reward_icons", []), f"來源：{card_label(destination)}")
    return True


def reserve_with_gold_bracelet(state: dict, player: dict) -> None:
    if len(player["reserved_destinations"]) >= 2:
        return
    target = choose_destination(state, player)
    if target is None:
        return
    source_key, index, card = target
    if source_key == "reserved":
        return
    subtype = "settlement" if source_key == "settlement_market" else "trade_post"
    state["zones"][source_key].pop(index)
    player["reserved_destinations"].append(card)
    state["log"].append(f"金臂鐲觸發：{player['name']} 預留 {card_label(card)}。")
    before = len(state["zones"][f"{subtype}_market"])
    refill_destination(state, subtype)
    after = len(state["zones"][f"{subtype}_market"])
    if after > before:
        state["log"].append("金臂鐲裁定：預留後立即補同類型目的地市場。")


def recruit(state: dict, player: dict) -> bool:
    card = choose_recruit_card(player)
    if card is None:
        try:
            card = draw_crew(state, state["rng"], "empty hand top-up")
            player["hand"].append(card)
        except DeckIssue as exc:
            state["issues"].append(str(exc))
            return False
    player["hand"].remove(card)
    color = card["color"]
    player["crew_area"][color].append(card)
    state["log"].append(f"{player['name']} 招募 {card_label(card)}。")
    for icon in visible_column_icons(player, color):
        add_resource(state, player, icon, 1, f"來源：{COLOR_ZH[color]}色縱列")
    if len(player["crew_area"][color]) == 3:
        reserve_with_gold_bracelet(state, player)
    slot_index = COLORS.index(color)
    slot = state["zones"]["crew_market"][slot_index]
    if slot["card"] is not None:
        taken = slot["card"]
        player["hand"].append(taken)
        state["log"].append(f"{player['name']} 依 {COLOR_ZH[color]}色市場格拿取 {card_label(taken)} 到手牌。")
        refill_crew_market_slot(state, slot_index, state["rng"])
    elif player["tokens"]["recruit_token"] > 0:
        for fallback in state["zones"]["crew_market"]:
            if fallback["card"] is not None:
                player["tokens"]["recruit_token"] -= 1
                taken = fallback["card"]
                player["hand"].append(taken)
                fallback["card"] = None
                state["log"].append(f"{player['name']} 花 1 招募標記任選 {card_label(taken)} 到手牌。")
                refill_crew_market_slot(state, state["zones"]["crew_market"].index(fallback), state["rng"])
                break
    return True


def trade_icons_for_columns(state: dict, player: dict, column_count: int) -> list[str]:
    icons: list[str] = []
    side = state["ship_tiles_by_id"][player["ship_tile_side_id"]]
    for column_index in range(column_count):
        if column_index < len(side.get("trade_columns", [])):
            icons.extend(icon for icon in side["trade_columns"][column_index] if icon)
        for destination in player["destinations"]:
            columns = destination.get("trade_column_icons", [])
            if column_index < len(columns) and columns[column_index]:
                icons.append(columns[column_index])
    return icons


def maybe_trade(state: dict, player: dict) -> None:
    if player.get("traded_this_turn") or player["tokens"]["silver_bracelet"] <= 0:
        return
    max_spend = min(3, player["tokens"]["silver_bracelet"])
    spend = 0
    icons: list[str] = []
    for candidate in range(max_spend, 0, -1):
        candidate_icons = trade_icons_for_columns(state, player, candidate)
        if candidate_icons:
            spend = candidate
            icons = candidate_icons
            break
    if not icons:
        return
    player["tokens"]["silver_bracelet"] -= spend
    player["traded_this_turn"] = True
    column_text = {1: "最左欄", 2: "左欄與中欄", 3: "三欄全部"}[spend]
    state["log"].append(f"{player['name']} 花 {spend} 銀臂鐲執行貿易，取得{column_text}資源。")
    for icon in icons:
        add_resource(state, player, icon, 1, "來源：貿易")


def take_turn(state: dict, player: dict) -> None:
    state["turn"] += 1
    state["active_player_id"] = player["id"]
    player["traded_this_turn"] = False
    award = reputation_award(state, player["reputation"])
    if award:
        player["score"] += award
    state["log"].append(f"Turn {state['turn']}: {player['name']} 回合開始，聲望給分 {award}。")
    maybe_trade(state, player)
    if not explore(state, player):
        if not recruit(state, player):
            state["issues"].append(f"{player['id']}:NO_LEGAL_ACTION")
    maybe_trade(state, player)
    player["tokens"]["recruit_token"] = min(player["tokens"]["recruit_token"], TOKEN_CAP["recruit_token"])
    player["tokens"]["silver_bracelet"] = min(player["tokens"]["silver_bracelet"], TOKEN_CAP["silver_bracelet"])


def setup(seed: int = 20260616) -> dict:
    rng = random.Random(seed)
    board = load_board()
    ship_tiles = load_ship_tiles()
    cards = [clone_card(card) for card in load_cards()]
    crew = [card for card in cards if card["type"] == "crew" and 2 in next(c for c in load_cards() if c["id"] == card["id"]).get("valid_player_counts", [])]
    trade_posts = [card for card in cards if card.get("subtype") == "trade_post"]
    settlements = [card for card in cards if card.get("subtype") == "settlement"]
    rng.shuffle(crew)
    rng.shuffle(trade_posts)
    rng.shuffle(settlements)
    state = {
        "schema_version": "0.1",
        "simulation_id": "knarr_2p_human_vs_computer_2026-06-16",
        "seed": seed,
        "mode": "human_vs_computer",
        "modules": {"core": True, "relic_variant": True, "active_relic": "knarr_relic_gold_bracelet"},
        "status": "in_progress",
        "turn": 0,
        "active_player_id": None,
        "rng": rng,
        "board": board,
        "ship_tiles_by_id": ship_tiles,
        "players": {
            "human": {
                "id": "human",
                "name": "玩家",
                "controller": "human",
                "score": 0,
                "reputation": 0,
                "ship_tile_side_id": "knarr_core_ship_tile_1_side_001",
                "traded_this_turn": False,
                "tokens": {"recruit_token": 1, "silver_bracelet": 1},
                "hand": [],
                "crew_area": {color: [] for color in COLORS},
                "destinations": [],
                "reserved_destinations": [],
            },
            "computer": {
                "id": "computer",
                "name": "電腦",
                "controller": "computer",
                "score": 0,
                "reputation": 0,
                "ship_tile_side_id": "knarr_core_ship_tile_2_side_003",
                "traded_this_turn": False,
                "tokens": {"recruit_token": 1, "silver_bracelet": 1},
                "hand": [],
                "crew_area": {color: [] for color in COLORS},
                "destinations": [],
                "reserved_destinations": [],
            },
        },
        "zones": {
            "crew_deck": crew,
            "crew_discard": [],
            "crew_market": [{"slot_color": color, "card": None} for color in COLORS],
            "trade_post_deck": trade_posts,
            "trade_post_market": [],
            "settlement_deck": settlements,
            "settlement_market": [],
        },
        "turn_order": [],
        "log": [],
        "issues": [],
        "winner": None,
    }
    for i in range(5):
        refill_crew_market_slot(state, i, rng)
    for _ in range(3):
        state["zones"]["trade_post_market"].append(state["zones"]["trade_post_deck"].pop(0))
        state["zones"]["settlement_market"].append(state["zones"]["settlement_deck"].pop(0))
    for player in state["players"].values():
        for card in draw_until_distinct(state["zones"]["crew_deck"], 2):
            player["crew_area"][card["color"]].append(card)
            state["log"].append(f"設置：{player['name']} 船員區放入 {card_label(card)}。")
        for _ in range(3):
            player["hand"].append(draw_crew(state, rng, "starting hand"))
    first = rng.choice(["human", "computer"])
    state["turn_order"] = [first, "computer" if first == "human" else "human"]
    state["log"].append(f"命運標記隨機抽選：{state['players'][first]['name']} 先手。")
    return state


def check_end(state: dict, current_player_id: str, trigger_state: dict | None) -> dict | None:
    if trigger_state is None:
        if any(player["score"] >= 40 for player in state["players"].values()):
            pos = state["turn_order"].index(current_player_id)
            remaining = len(state["turn_order"]) - pos - 1
            return {"remaining_turns": remaining, "triggered_by": current_player_id}
        return None
    trigger_state["remaining_turns"] -= 1
    return trigger_state


def determine_winner(state: dict) -> None:
    players = list(state["players"].values())
    max_score = max(p["score"] for p in players)
    state["winner"] = [p["id"] for p in players if p["score"] == max_score]


def serializable(state: dict) -> dict:
    out = {k: v for k, v in state.items() if k != "rng"}
    return out


def summarize_player(player: dict) -> dict:
    return {
        "score": player["score"],
        "reputation": player["reputation"],
        "tokens": player["tokens"],
        "hand_size": len(player["hand"]),
        "crew_counts": {color: len(cards) for color, cards in player["crew_area"].items()},
        "destinations": [card_label(card) for card in player["destinations"]],
        "reserved": [card_label(card) for card in player["reserved_destinations"]],
        "ship_tile_side_id": player["ship_tile_side_id"],
    }


def write_outputs(state: dict) -> None:
    state["summary"] = {pid: summarize_player(player) for pid, player in state["players"].items()}
    state["zones_summary"] = {
        "crew_deck": len(state["zones"]["crew_deck"]),
        "crew_discard": len(state["zones"]["crew_discard"]),
        "trade_post_deck": len(state["zones"]["trade_post_deck"]),
        "settlement_deck": len(state["zones"]["settlement_deck"]),
        "trade_post_market": [card_label(card) for card in state["zones"]["trade_post_market"]],
        "settlement_market": [card_label(card) for card in state["zones"]["settlement_market"]],
    }
    trace_path = ROOT / "data" / "simulation_trace_2p_player_vs_computer.json"
    trace_path.write_text(json.dumps(serializable(state), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    winner_text = "尚未觸發終局"
    if state.get("winner"):
        names = [state["players"][pid]["name"] for pid in state["winner"]]
        winner_text = "共享勝利：" + "、".join(names) if len(names) > 1 else "勝者：" + names[0]
    lines = [
        "# 2 人文字版模擬：玩家 vs 電腦",
        "",
        f"- Seed: `{state['seed']}`",
        "- 模組：核心 + 金臂鐲聖物變體",
        "- 資料：聲望軌使用 `data/boards.json`；船隻板塊貿易欄使用 `data/ship_tiles.json`。",
        "- 設置：2 人規則，移除船員左下角 3、4；命運標記隨機抽先手。",
        f"- 狀態：{state['status']}",
        f"- 結果：{winner_text}",
        "",
        "## 最終摘要",
        "",
    ]
    for pid, summary in state["summary"].items():
        lines.append(f"### {state['players'][pid]['name']}")
        lines.append(f"- 分數/聲望：{summary['score']} / {summary['reputation']}")
        lines.append(f"- 標記：招募 {summary['tokens']['recruit_token']}，銀臂鐲 {summary['tokens']['silver_bracelet']}")
        lines.append(f"- 船隻面：{summary['ship_tile_side_id']}")
        lines.append(f"- 船員數：{summary['crew_counts']}")
        lines.append(f"- 目的地：{', '.join(summary['destinations']) if summary['destinations'] else '無'}")
        lines.append(f"- 預留：{', '.join(summary['reserved']) if summary['reserved'] else '無'}")
        lines.append("")
    lines += ["## 規則/資料問題", ""]
    if state["issues"]:
        for issue in state["issues"]:
            lines.append(f"- {issue}")
    else:
        lines.append("- 無")
    lines += ["", "## 事件紀錄", ""]
    for entry in state["log"]:
        lines.append(f"- {entry}")
    md_path = ROOT / "rules_simulation" / "text_simulation_2p_player_vs_computer.md"
    md_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(md_path)
    print(trace_path)


def main() -> None:
    state = setup()
    trigger_state = None
    max_turns = 60
    try:
        while state["turn"] < max_turns:
            player_id = state["turn_order"][state["turn"] % len(state["turn_order"])]
            take_turn(state, state["players"][player_id])
            trigger_state = check_end(state, player_id, trigger_state)
            if trigger_state is not None and trigger_state["remaining_turns"] <= 0:
                state["status"] = "game_end"
                break
        if state["status"] != "game_end":
            state["status"] = "max_turns_reached_without_40_points"
        determine_winner(state)
    except DeckIssue as exc:
        state["status"] = "blocked_by_unadjudicated_deck_exhaustion"
        state["issues"].append(str(exc))
        determine_winner(state)
    write_outputs(state)


if __name__ == "__main__":
    main()
