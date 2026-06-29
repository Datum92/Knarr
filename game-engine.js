// ══════════════════════════════════════════════════════════════════════
// KNARR — Game Engine v2
// 直覺操作 · 主畫面招募/探索 · 符合完整規則
// ══════════════════════════════════════════════════════════════════════
'use strict';

// ─── Constants ───────────────────────────────────────────────────────
const COLORS = ['blue','yellow','green','red','purple'];
const COLOR_ZH = {blue:'藍',yellow:'黃',green:'綠',red:'紅',purple:'紫'};
const COLOR_TEXT = {blue:'#8ab4f8',yellow:'#ffd700',green:'#86efac',red:'#fca5a5',purple:'#d8b4fe'};
const COLOR_BG   = {blue:'rgba(26,79,168,0.45)',yellow:'rgba(176,128,0,0.45)',green:'rgba(26,122,53,0.45)',red:'rgba(139,26,26,0.45)',purple:'rgba(90,26,139,0.45)'};
const ICONS = {
  victory_point:  {sym:'★', label:'勝利分數',  col:'#f0cc6e'},
  silver_bracelet:{sym:'⭕', label:'銀臂鐲',   col:'#c8c8c8'},
  recruit_token:  {sym:'⚡', label:'招募標記', col:'#64b4ff'},
  reputation:     {sym:'🔰', label:'聲望值',   col:'#86efac'},
  draw_crew_card: {sym:'🃏', label:'抽船員牌', col:'#c084fc'},
};
const REP_THRESH = [{p:0,s:0},{p:3,s:1},{p:6,s:2},{p:10,s:3},{p:14,s:5}];

// ─── Game State ───────────────────────────────────────────────────────
let G = null;

// UI interaction mode
let uiMode = 'idle'; // 'idle' | 'recruit' | 'explore-dest' | 'explore-pay'
let exploreCtx = {destId:null, destIsReserved:false, paidCards:[], tokensUsed:0};

// ─── State Constructors ───────────────────────────────────────────────
function mkPlayer(tileId, name) {
  return {
    name, tileId,
    score:0, reputation:0,
    tradedThisTurn:false,
    tokens:{recruit_token:1, silver_bracelet:1},
    hand:[],
    crew:{blue:[],yellow:[],green:[],red:[],purple:[]},
    destinations:[], reserved:[],
  };
}

// ─── SETUP SCREEN ─────────────────────────────────────────────────────
let selectedTileId = 'knarr_core_ship_tile_1_side_001';

function startSetup() {
  showScreen('screen-setup');
  renderSetupTiles();
}

function renderSetupTiles() {
  const box = document.getElementById('ship-tile-selector');
  box.innerHTML = '';
  GAME_DATA.SHIP_TILES.forEach(t => {
    const d = document.createElement('div');
    d.className = 'ship-tile-option' + (t.id === selectedTileId ? ' selected' : '');
    const colIcons = t.trade_columns.map((col,i)=>
      `<div>${['左','中','右'][i]}：${col.map(r=>ICONS[r]?.sym||r).join('')}</div>`
    ).join('');
    d.innerHTML = `<div class="tile-id">${t.label}</div><div class="tile-cols">${colIcons}</div>`;
    d.onclick = () => {
      selectedTileId = t.id;
      document.querySelectorAll('.ship-tile-option').forEach(el=>el.classList.remove('selected'));
      d.classList.add('selected');
    };
    box.appendChild(d);
  });
}

function initGame() {
  const name = document.getElementById('player-name-input').value.trim() || '維京艦長';
  const relicOn = document.getElementById('relic-toggle').checked;

  G = {
    relicOn,
    activePlayer: 'human', // set by random later
    phase: 'setup',
    round: 0, turn: 0,
    mainActionDone: false,
    players: {
      human:    mkPlayer(selectedTileId, name),
      computer: mkPlayer('knarr_core_ship_tile_2_side_003', '電腦對手'),
    },
    zones: {
      crewDeck:[], crewDiscard:[], crewMarket:[],
      tradeDeck:[], tradeMarket:[],
      settleDeck:[], settleMarket:[],
    },
  };

  // Build decks
  const crew2p = GAME_DATA.CREW_CARDS.filter(c=>c.usable_in_two_player !== false);
  G.zones.crewDeck = shuffle([...crew2p]);
  G.zones.tradeDeck = shuffle([...GAME_DATA.TRADE_POSTS]);
  G.zones.settleDeck = shuffle([...GAME_DATA.SETTLEMENTS]);

  refillCrew(); refillDest('trade',3); refillDest('settle',3);

  // Starting crew (2 different colors each)
  setupStartCrew('human'); setupStartCrew('computer');
  // Starting hand 3 cards each
  for(let i=0;i<3;i++) drawToHand('human');
  for(let i=0;i<3;i++) drawToHand('computer');

  // Random starting player
  G.activePlayer = Math.random()<0.5 ? 'human' : 'computer';
  addLog(`🎲 命運標記：${G.activePlayer==='human'? G.players.human.name:'電腦對手'} 先手`, 'turn-hdr');

  document.getElementById('human-player-name').textContent = name;
  showScreen('screen-game');
  beginTurn();
}

function restartGame(){ initGame(); }

function setupStartCrew(pid) {
  const used = new Set();
  for(let i=G.zones.crewDeck.length-1; i>=0 && used.size<2; i--) {
    const c = G.zones.crewDeck[i];
    if(!used.has(c.color)) {
      used.add(c.color);
      G.players[pid].crew[c.color].push(c);
      G.zones.crewDeck.splice(i,1);
    }
  }
}

// ─── Turn Flow ────────────────────────────────────────────────────────
function beginTurn() {
  uiMode = 'idle';
  clearExploreCtx();
  const p = G.players[G.activePlayer];
  p.tradedThisTurn = false;
  G.mainActionDone = false;
  G.turn++;
  G.round = Math.floor((G.turn-1)/2)+1;

  addLog(`── 回合${G.turn}：${p.name} ──`, 'turn-hdr');
  setPhase('turn_start');

  // Reputation scoring
  const rpts = repScore(p.reputation);
  if(rpts>0){ p.score+=rpts; addLog(`${p.name} 聲望給分 +${rpts}分`, 'good'); }

  if(G.activePlayer==='computer'){
    updateUI();
    setPhase('computer_thinking');
    setTimeout(runAI, 1000+Math.random()*500);
    return;
  }

  setPhase('pre_action_trade_window');
  updateUI();
  updateActionBtns();
}

function endTurn() {
  // cleanup
  closeTradeInline(); closeExploreInline();
  uiMode = 'idle';
  clearHighlights();
  refillCrew(); refillDest('trade',3); refillDest('settle',3);
  setPhase('check_victory');

  // Victory check
  const h = G.players.human.score, c = G.players.computer.score;
  if((h>=40 || c>=40)) {
    // If human just ended and triggered, check if computer already went this round
    endGame(); return;
  }

  G.activePlayer = G.activePlayer==='human' ? 'computer' : 'human';
  beginTurn();
}

// ─── HUMAN ACTIONS ────────────────────────────────────────────────────

// Trade
function doTrade() {
  const p = G.players.human;
  if(p.tradedThisTurn){ showToast('本回合已貿易過！','bad'); return; }
  if(p.tokens.silver_bracelet<=0){ showToast('銀臂鐲不足！','bad'); return; }
  closeExploreInline();
  document.getElementById('trade-bracelet-count').textContent = p.tokens.silver_bracelet;
  showElem('trade-inline'); updateActionBtns();
}

function cancelTrade() { hideElem('trade-inline'); updateActionBtns(); }

function executeTrade(amount) {
  const p = G.players.human;
  if(p.tokens.silver_bracelet < amount){ showToast(`銀臂鐲不足！需要${amount}枚`,'bad'); return; }
  p.tokens.silver_bracelet -= amount;
  p.tradedThisTurn = true;
  hideElem('trade-inline');

  const cols = amount===1?[0]:amount===2?[0,1]:[0,1,2];
  const tile = GAME_DATA.SHIP_TILES.find(t=>t.id===p.tileId);
  const colNames = ['左欄','中欄','右欄'];
  let gained = [];

  cols.forEach(ci => {
    // From ship tile
    tile?.trade_columns[ci]?.forEach(res=>{
      applyRes('human',res,1,'船隻板塊');
      gained.push(iLabel(res));
    });
    // From each destination
    p.destinations.forEach(dest=>{
      const r = dest.trade_cols?.[ci];
      if(r){ applyRes('human',r,1,dest.name); gained.push(iLabel(r)); }
    });
  });

  addLog(`${p.name} 花${amount}枚⭕貿易（${cols.map(i=>colNames[i]).join('+')}）→ ${gained.join('、')||'無資源'}`, 'good');
  updateUI(); updateActionBtns();
  showToast(`貿易完成！取得 ${gained.length} 項資源`,'gold');
}

// ── Recruit Mode ──
function enterRecruitMode() {
  if(G.mainActionDone){ showToast('主行動已完成！','bad'); return; }
  const p = G.players.human;
  if(p.hand.length===0){ showToast('手牌為空！','bad'); return; }
  uiMode = 'recruit';
  closeTradeInline(); closeExploreInline();
  document.getElementById('action-zone-label').textContent = '招募模式：點選手牌中的船員執行招募';
  addHighlightToHand('recruit');
  document.getElementById('hand-hint').textContent = '— 點擊招募';
  updateActionBtns();
}

function clickHandCard(cardIdx) {
  if(uiMode==='recruit') {
    doRecruitCard(cardIdx);
  } else if(uiMode==='explore-pay') {
    togglePayCard(cardIdx);
  } else {
    // Show info
    const card = G.players.human.hand[cardIdx];
    if(card) showCardInfoModal(card);
  }
}

function doRecruitCard(handIdx) {
  const p = G.players.human;
  const card = p.hand[handIdx];
  if(!card) return;

  const col = card.color;
  p.hand.splice(handIdx, 1);
  p.crew[col].push(card);
  const newCount = p.crew[col].length;

  addLog(`${p.name} 招募 ${card.name}（${COLOR_ZH[col]}色縱列）`, 'good');

  // Gain resources from ALL cards in that column
  p.crew[col].forEach(c=>{ applyRes('human', c.resource, 1, `${COLOR_ZH[col]}色縱列`); });

  // Take market card of same color to hand
  takeSameColorFromMarket('human', col);

  G.mainActionDone = true;
  uiMode = 'idle';
  clearHighlights();
  document.getElementById('action-zone-label').textContent = '可執行行動';
  document.getElementById('hand-hint').textContent = '— 點牌查看';

  updateUI(); updateActionBtns();
  showToast(`招募成功！${COLOR_ZH[col]}色縱列取得資源`, 'good');

  // Gold bracelet trigger
  if(G.relicOn && newCount===3) {
    setTimeout(()=>triggerGoldBracelet(), 300);
  }
}

function takeSameColorFromMarket(pid, color) {
  const p = G.players[pid];
  const idx = G.zones.crewMarket.findIndex(c=>c.color===color);
  if(idx!==-1) {
    const card = G.zones.crewMarket.splice(idx,1)[0];
    p.hand.push(card);
    addLog(`  取得市場 ${card.name} 到手牌`, '');
    refillCrew();
  } else {
    addLog(`  市場無${COLOR_ZH[color]}色船員`, '');
    // Human player: offer recruit token option
    if(pid==='human' && p.tokens.recruit_token > 0 && G.zones.crewMarket.length > 0) {
      showRecruitTokenPick();
      return; // don't proceed with updateUI yet — wait for player choice
    }
  }
  updateUI(); updateActionBtns();
}

function showRecruitTokenPick() {
  const p = G.players.human;
  document.getElementById('recruit-token-available').textContent = p.tokens.recruit_token;
  const container = document.getElementById('recruit-market-pick');
  container.innerHTML = '';
  G.zones.crewMarket.forEach(card => {
    const div = document.createElement('div');
    div.className = `recruit-pick-card c${card.color}`;
    div.title = `${card.name} (${COLOR_ZH[card.color]})`;
    const colorDot = document.createElement('div');
    colorDot.className = 'rpcard-color';
    colorDot.style.background = COLOR_BG[card.color];
    colorDot.textContent = COLOR_ZH[card.color];
    const img = document.createElement('img');
    img.src = GAME_DATA.BASE + card.img;
    img.alt = card.name;
    img.onerror = () => { img.style.display='none'; div.style.background=COLOR_BG[card.color]; };
    div.appendChild(colorDot); div.appendChild(img);
    div.onclick = () => pickMarketCard(card);
    container.appendChild(div);
  });
  document.getElementById('recruit-token-inline').classList.remove('hidden');
}

function pickMarketCard(card) {
  const p = G.players.human;
  if(p.tokens.recruit_token <= 0) { showToast('招募標記不足！','bad'); return; }
  const idx = G.zones.crewMarket.findIndex(c=>c.id===card.id);
  if(idx === -1) { showToast('找不到該牌！','bad'); return; }
  p.tokens.recruit_token--;
  const taken = G.zones.crewMarket.splice(idx,1)[0];
  p.hand.push(taken);
  refillCrew();
  addLog(`  花費⚡招募標記，選取 ${taken.name}（${COLOR_ZH[taken.color]}色）到手牌`, 'good');
  skipRecruitTokenPick();
}

function skipRecruitTokenPick() {
  document.getElementById('recruit-token-inline').classList.add('hidden');
  updateUI(); updateActionBtns();
}

// ── Explore Mode ──
function enterExploreMode() {
  if(G.mainActionDone){ showToast('主行動已完成！','bad'); return; }
  uiMode = 'explore-dest';
  clearExploreCtx();
  closeTradeInline();
  document.getElementById('action-zone-label').textContent = '探索模式：先點選目的地市場中的卡牌';
  showElem('explore-inline');
  updateExploreSummary();
  addHighlightToDests();
  updateActionBtns();
}

function cancelExplore() {
  uiMode = 'idle';
  clearExploreCtx();
  clearHighlights();
  closeExploreInline();
  document.getElementById('action-zone-label').textContent = '可執行行動';
  document.getElementById('hand-hint').textContent = '— 點牌查看';
  updateUI(); updateActionBtns();
}

function clickDestMarketCard(destId, isSettlement) {
  if(uiMode==='explore-dest' || uiMode==='explore-pay') {
    selectExploreDest(destId, false, isSettlement);
  } else {
    const dest = findDest(destId);
    if(dest) showDestInfoModal(dest);
  }
}

function clickReservedDest(destId) {
  if(uiMode==='explore-dest' || uiMode==='explore-pay') {
    selectExploreDest(destId, true, null);
  } else {
    const dest = findDest(destId);
    if(dest) showDestInfoModal(dest);
  }
}

function selectExploreDest(destId, isReserved, isSettlement) {
  exploreCtx.destId = destId;
  exploreCtx.destIsReserved = isReserved;
  exploreCtx.paidCards = [];
  exploreCtx.tokensUsed = 0;

  uiMode = 'explore-pay';
  document.getElementById('action-zone-label').textContent = '探索模式：從船員區或手牌選擇4張同色船員付費';
  document.getElementById('hand-hint').textContent = '— 點牌付費';

  clearHighlights();
  addHighlightToCrewForPay();
  updateExploreSummary();
  updateUI();
}

function togglePayCard(handIdx) {
  // Hand card payment during explore
  if(uiMode!=='explore-pay') return;
  const p = G.players.human;
  const card = p.hand[handIdx];
  if(!card) return;

  // Must all be same color
  const existingColor = exploreCtx.paidCards.find(pc=>pc.source==='hand');
  if(existingColor && existingColor.color!==card.color) {
    showToast('必須使用同色船員！','bad'); return;
  }
  const crewColor = exploreCtx.paidCards.length>0 ? exploreCtx.paidCards[0].color : null;
  if(crewColor && crewColor!==card.color) {
    showToast('必須使用同色船員！','bad'); return;
  }

  const key = `hand_${handIdx}`;
  const exi = exploreCtx.paidCards.findIndex(pc=>pc.key===key);
  if(exi!==-1) {
    exploreCtx.paidCards.splice(exi,1);
  } else {
    const needed = 4 - exploreCtx.tokensUsed - exploreCtx.paidCards.length;
    if(needed<=0){ showToast('已選足4張！','bad'); return; }
    exploreCtx.paidCards.push({key, source:'hand', handIdx, color:card.color, card});
  }
  updateExploreSummary();
  updateUI();
}

function togglePayCrewCard(color, crewIdx) {
  // Crew area card payment during explore
  if(uiMode!=='explore-pay') return;
  const p = G.players.human;
  const card = p.crew[color][crewIdx];
  if(!card) return;

  // Color constraint
  const crewColor = exploreCtx.paidCards.length>0 ? exploreCtx.paidCards[0].color : null;
  if(crewColor && crewColor!==color) {
    showToast('必須使用同色船員！','bad'); return;
  }

  const key = `crew_${color}_${crewIdx}`;
  const exi = exploreCtx.paidCards.findIndex(pc=>pc.key===key);
  if(exi!==-1) {
    exploreCtx.paidCards.splice(exi,1);
  } else {
    const needed = 4 - exploreCtx.tokensUsed - exploreCtx.paidCards.length;
    if(needed<=0){ showToast('已選足4張！','bad'); return; }
    exploreCtx.paidCards.push({key, source:'crew', color, crewIdx, card});
  }
  updateExploreSummary();
  updateUI();
}

function useTokenForExplore() {
  const p = G.players.human;
  const totalSelected = exploreCtx.paidCards.length + exploreCtx.tokensUsed;
  if(totalSelected>=4){ showToast('已達4張費用！','bad'); return; }
  if(p.tokens.recruit_token<=0){ showToast('招募標記不足！','bad'); return; }
  if(exploreCtx.tokensUsed >= p.tokens.recruit_token){ showToast('招募標記不足！','bad'); return; }
  exploreCtx.tokensUsed++;
  updateExploreSummary();
}

function updateExploreSummary() {
  const total = exploreCtx.paidCards.length + exploreCtx.tokensUsed;
  const dest = findDest(exploreCtx.destId);
  document.getElementById('sel-dest-name').textContent = dest ? dest.name : '—';
  document.getElementById('sel-crew-count').textContent = exploreCtx.paidCards.length;
  document.getElementById('sel-token-count').textContent = exploreCtx.tokensUsed;

  const tokenBtn = document.getElementById('explore-use-token-btn');
  const confirmBtn = document.getElementById('confirm-explore-btn');
  const p = G.players.human;
  tokenBtn.disabled = total>=4 || p.tokens.recruit_token<=exploreCtx.tokensUsed;
  confirmBtn.disabled = !(total>=4 && exploreCtx.destId);
}

function confirmExplore() {
  const p = G.players.human;
  const destId = exploreCtx.destId;
  if(!destId){ showToast('請先選擇目的地','bad'); return; }
  const total = exploreCtx.paidCards.length + exploreCtx.tokensUsed;
  if(total<4){ showToast('費用不足（需4張/枚）','bad'); return; }

  // Find and remove dest from market/reserved
  let dest = null;
  let fromType = null;
  if(exploreCtx.destIsReserved) {
    const ri = p.reserved.findIndex(d=>d.id===destId);
    if(ri!==-1){ dest=p.reserved.splice(ri,1)[0]; fromType='reserved'; }
  } else {
    let si = G.zones.settleMarket.findIndex(d=>d.id===destId);
    if(si!==-1){ dest=G.zones.settleMarket.splice(si,1)[0]; fromType='settle'; }
    else { let ti=G.zones.tradeMarket.findIndex(d=>d.id===destId); if(ti!==-1){ dest=G.zones.tradeMarket.splice(ti,1)[0]; fromType='trade'; } }
  }
  if(!dest){ showToast('找不到目的地！','bad'); return; }

  // Pay crew cards (remove from crew/hand, sorted desc by idx to avoid index shift)
  const paidSorted = [...exploreCtx.paidCards].sort((a,b)=>{
    if(a.source==='crew' && b.source==='crew') return b.crewIdx - a.crewIdx;
    return 0;
  });
  paidSorted.forEach(pc=>{
    if(pc.source==='hand') {
      const idx = p.hand.findIndex(c=>c.id===pc.card.id && !G._removed_hand?.[c.id]);
      if(idx!==-1){ G.zones.crewDiscard.push(p.hand.splice(idx,1)[0]); }
    } else {
      const remaining = p.crew[pc.color].filter(c=>c.id!==pc.card.id);
      const idx = p.crew[pc.color].findIndex(c=>c.id===pc.card.id);
      if(idx!==-1){ G.zones.crewDiscard.push(p.crew[pc.color].splice(idx,1)[0]); }
    }
  });

  // Pay tokens
  p.tokens.recruit_token -= exploreCtx.tokensUsed;
  p.destinations.push(dest);

  addLog(`${p.name} 探索取得 ${dest.name}！`, 'good');

  // Rewards
  if(dest.rewards) dest.rewards.forEach(r=>applyRes('human',r.icon,r.amount,dest.name));
  if(fromType==='settle') refillDest('settle',3);
  else if(fromType==='trade') refillDest('trade',3);

  G.mainActionDone = true;
  uiMode = 'idle';
  clearExploreCtx(); clearHighlights();
  closeExploreInline();
  document.getElementById('action-zone-label').textContent = '可執行行動';
  document.getElementById('hand-hint').textContent = '— 點牌查看';

  updateUI(); updateActionBtns();
  showToast(`探索成功！${dest.points>0?'+'+dest.points+'分':''}取得獎勵`, 'gold');
}

// Gold Bracelet
function triggerGoldBracelet() {
  const p = G.players.human;
  if(p.reserved.length>=2){ addLog('金臂鐲：預留上限2張，略過',''); return; }
  addLog('🔱 金臂鐲觸發！可預留1張目的地', 'important');

  const container = document.getElementById('reserve-dest-list');
  container.innerHTML = '';
  const all = [...G.zones.settleMarket, ...G.zones.tradeMarket];
  all.forEach(dest=>{
    const d = buildReserveDestBtn(dest);
    container.appendChild(d);
  });
  showModal('modal-reserve');
}

function buildReserveDestBtn(dest) {
  const d = document.createElement('div');
  d.className = 'dest-owned-card';
  d.style.cursor = 'pointer';
  const img = document.createElement('img');
  img.src = GAME_DATA.BASE + dest.img;
  img.onerror = ()=>{ img.style.display='none'; };
  const body = document.createElement('div');
  body.className = 'dcard-body';
  body.innerHTML = `<div class="dcard-name">${dest.name}</div><div class="dcard-pts">${dest.points||''}</div>`;
  d.appendChild(img); d.appendChild(body);
  d.onclick = ()=>doReserve(dest.id);
  return d;
}

function doReserve(destId) {
  const p = G.players.human;
  let dest = null; let fromType = null;
  let si = G.zones.settleMarket.findIndex(d=>d.id===destId);
  if(si!==-1){ dest=G.zones.settleMarket.splice(si,1)[0]; fromType='settle'; }
  else { let ti=G.zones.tradeMarket.findIndex(d=>d.id===destId); if(ti!==-1){ dest=G.zones.tradeMarket.splice(ti,1)[0]; fromType='trade'; } }
  if(!dest) return;
  p.reserved.push(dest);
  addLog(`${p.name} 預留 ${dest.name}（金臂鐲）`, 'good');
  if(fromType==='settle') refillDest('settle',3);
  else refillDest('trade',3);
  closeModal('modal-reserve');
  updateUI(); updateActionBtns();
}

function skipReserve() {
  closeModal('modal-reserve');
  updateUI(); updateActionBtns();
}

// ─── Resource Application ─────────────────────────────────────────────
function applyRes(pid, res, amount, src) {
  const p = G.players[pid];
  switch(res) {
    case 'victory_point':
      p.score += amount;
      addLog(`  ${p.name} +${amount}★ 勝利分數 (${src})`, 'good');
      break;
    case 'silver_bracelet':
      p.tokens.silver_bracelet = Math.min(3, p.tokens.silver_bracelet+amount);
      addLog(`  ${p.name} +${amount}⭕ 銀臂鐲 (${src})`, '');
      break;
    case 'recruit_token':
      p.tokens.recruit_token = Math.min(3, p.tokens.recruit_token+amount);
      addLog(`  ${p.name} +${amount}⚡ 招募標記 (${src})`, '');
      break;
    case 'reputation':
      p.reputation = Math.min(14, p.reputation+amount);
      addLog(`  ${p.name} 聲望+${amount}→${p.reputation} (${src})`, '');
      break;
    case 'draw_crew_card':
      for(let i=0;i<amount;i++) {
        if(G.zones.crewDeck.length===0) reshuffleCrew();
        if(G.zones.crewDeck.length>0) {
          const c = G.zones.crewDeck.pop();
          G.zones.crewMarket.push(c);
          addLog(`  抽放船員 ${c.name} 至市場 (${src})`, '');
        }
      }
      break;
  }
}

// ─── Market Management ────────────────────────────────────────────────
function refillCrew() {
  while(G.zones.crewMarket.length<5 && (G.zones.crewDeck.length>0||G.zones.crewDiscard.length>0)) {
    if(G.zones.crewDeck.length===0) reshuffleCrew();
    if(G.zones.crewDeck.length>0) G.zones.crewMarket.push(G.zones.crewDeck.pop());
  }
}
function reshuffleCrew() {
  if(!G.zones.crewDiscard.length) return;
  G.zones.crewDeck = shuffle([...G.zones.crewDiscard]);
  G.zones.crewDiscard = [];
  addLog('船員牌庫耗盡，洗混棄牌堆', '');
}
function refillDest(type, max) {
  const dk = type==='settle'?'settleDeck':'tradeDeck';
  const mk = type==='settle'?'settleMarket':'tradeMarket';
  while(G.zones[mk].length<max && G.zones[dk].length>0) G.zones[mk].push(G.zones[dk].pop());
}
function drawToHand(pid) {
  if(G.zones.crewDeck.length===0) reshuffleCrew();
  if(G.zones.crewDeck.length>0) G.players[pid].hand.push(G.zones.crewDeck.pop());
}

// ─── COMPUTER AI ──────────────────────────────────────────────────────
function runAI() {
  const p = G.players.computer;
  // 1. Trade
  if(!p.tradedThisTurn && p.tokens.silver_bracelet>0) aiTrade();

  // 2. Main action: explore if possible, else recruit
  setTimeout(()=>{
    if(!aiExplore()) aiRecruit();
    setTimeout(()=>{
      refillCrew(); refillDest('trade',3); refillDest('settle',3);
      updateUI();
      addLog('── 電腦結束回合 ──','');
      // Check endgame
      if(G.players.human.score>=40||G.players.computer.score>=40){ endGame(); return; }
      G.activePlayer = 'human';
      beginTurn();
    }, 600);
  }, 700);
}

function aiTrade() {
  const p = G.players.computer;
  const amt = Math.min(p.tokens.silver_bracelet, 2);
  p.tokens.silver_bracelet -= amt;
  p.tradedThisTurn = true;
  const cols = amt===1?[0]:[0,1];
  const tile = GAME_DATA.SHIP_TILES.find(t=>t.id===p.tileId);
  cols.forEach(ci=>{
    tile?.trade_columns[ci]?.forEach(r=>applyRes('computer',r,1,'船隻板塊'));
    p.destinations.forEach(d=>{ const r=d.trade_cols?.[ci]; if(r) applyRes('computer',r,1,d.name); });
  });
  addLog(`電腦 花${amt}枚⭕貿易`, '');
}

function aiExplore() {
  const p = G.players.computer;
  const allDests = [...G.zones.settleMarket,...G.zones.tradeMarket,...p.reserved];
  for(const color of COLORS) {
    const handCards = p.hand.filter(c=>c.color===color);
    const crewCards = p.crew[color];
    const total = handCards.length + crewCards.length + p.tokens.recruit_token;
    if(total>=4 && allDests.length>0) {
      const dest = allDests.reduce((b,d)=>(d.points||0)>=(b.points||0)?d:b, allDests[0]);
      // Pay
      let toPay=4;
      // Use hand first
      [...handCards].forEach(c=>{ if(toPay>0){ const i=p.hand.findIndex(x=>x.id===c.id); if(i!==-1){G.zones.crewDiscard.push(p.hand.splice(i,1)[0]);toPay--;} } });
      // Use crew area
      for(let i=crewCards.length-1;i>=0&&toPay>0;i--){ G.zones.crewDiscard.push(p.crew[color].splice(i,1)[0]);toPay--; }
      // Tokens
      while(toPay>0&&p.tokens.recruit_token>0){p.tokens.recruit_token--;toPay--;}

      // Remove from market
      let ft=null;
      let si=G.zones.settleMarket.findIndex(d=>d.id===dest.id);
      if(si!==-1){G.zones.settleMarket.splice(si,1);ft='settle';}
      else{let ti=G.zones.tradeMarket.findIndex(d=>d.id===dest.id);if(ti!==-1){G.zones.tradeMarket.splice(ti,1);ft='trade';}
      else{let ri=p.reserved.findIndex(d=>d.id===dest.id);if(ri!==-1)p.reserved.splice(ri,1);}}

      p.destinations.push(dest);
      addLog(`電腦 探索取得 ${dest.name}`, 'good');
      if(dest.rewards) dest.rewards.forEach(r=>applyRes('computer',r.icon,r.amount,dest.name));
      if(ft==='settle') refillDest('settle',3); else if(ft==='trade') refillDest('trade',3);

      // AI gold bracelet
      if(G.relicOn) aiCheckGoldBracelet(color);
      return true;
    }
  }
  return false;
}

function aiRecruit() {
  const p = G.players.computer;
  if(!p.hand.length) return;
  // Pick card to maximize: prefer color with 2 already (for bracelet trigger) or diverse
  let best = p.hand[0];
  let bestSc = -99;
  p.hand.forEach(c=>{
    const cnt = p.crew[c.color].length;
    let sc = cnt===2?10 : cnt===1?5 : cnt===0?2 : 1;
    if(c.resource==='victory_point') sc+=2;
    if(c.resource==='reputation') sc+=1;
    if(sc>bestSc){bestSc=sc;best=c;}
  });

  const col = best.color;
  const prevCnt = p.crew[col].length;
  const idx = p.hand.findIndex(c=>c.id===best.id);
  p.hand.splice(idx,1);
  p.crew[col].push(best);
  const newCnt = p.crew[col].length;

  addLog(`電腦 招募 ${best.name}（${COLOR_ZH[col]}色）`, '');
  p.crew[col].forEach(c=>applyRes('computer',c.resource,1,`${COLOR_ZH[col]}色縱列`));
  takeSameColorFromMarket('computer', col);

  if(G.relicOn && newCnt===3) aiCheckGoldBracelet(col);
}

function aiCheckGoldBracelet(color) {
  const p = G.players.computer;
  if(p.reserved.length>=2) return;
  const all=[...G.zones.settleMarket,...G.zones.tradeMarket];
  if(!all.length) return;
  const best = all.reduce((b,d)=>(d.points||0)>=(b.points||0)?d:b,all[0]);
  let si=G.zones.settleMarket.findIndex(d=>d.id===best.id);
  if(si!==-1){G.zones.settleMarket.splice(si,1);refillDest('settle',3);}
  else{let ti=G.zones.tradeMarket.findIndex(d=>d.id===best.id);if(ti!==-1){G.zones.tradeMarket.splice(ti,1);refillDest('trade',3);}}
  p.reserved.push(best);
  addLog(`電腦 金臂鐲：預留 ${best.name}`, '');
}

// ─── UI RENDERING ─────────────────────────────────────────────────────
function updateUI() {
  if(!G) return;
  renderPanel('human');
  renderPanel('computer');
  renderCrewMarket();
  renderDestMarket();
  updateDeckBadges();
  updateRoundLabel();

  // Active panel
  document.querySelector('.side-panel--human').classList.toggle('my-turn', G.activePlayer==='human');
  document.querySelector('.side-panel--opp').classList.toggle('opp-turn', G.activePlayer==='computer');
  showHide('human-turn-badge', G.activePlayer==='human');
  showHide('opp-turn-badge', G.activePlayer==='computer');
}

function renderPanel(pid) {
  const p = G.players[pid];
  const pre = pid==='human'?'human':'opp';

  document.getElementById(`${pre}-score`).textContent = p.score;
  renderRepTrack(pre, p.reputation);
  document.getElementById(`${pre}-rep`).textContent = p.reputation;
  document.getElementById(`${pre}-rep-pts`).textContent = repScore(p.reputation);
  document.getElementById(`${pre}-recruit`).textContent = p.tokens.recruit_token;
  document.getElementById(`${pre}-bracelet`).textContent = p.tokens.silver_bracelet;

  // Crew columns
  COLORS.forEach(col=>{
    const el = document.getElementById(`${pre}-crew-${col}`);
    el.innerHTML = '';
    p.crew[col].forEach((card, ci)=>{
      const div = document.createElement('div');
      div.className = 'crew-area-card';

      // Background color fallback
      div.style.background = COLOR_BG[col];

      const img = document.createElement('img');
      img.src = GAME_DATA.BASE + card.img;
      img.alt = card.name;
      img.style.width='100%'; img.style.height='100%'; img.style.objectFit='cover'; img.style.objectPosition='top';
      img.onerror = ()=>{ img.remove(); div.textContent=ICONS[card.resource]?.sym||'?'; div.style.display='flex'; div.style.alignItems='center'; div.style.justifyContent='center'; div.style.fontSize='.8rem'; };

      const badge = document.createElement('div');
      badge.className = 'card-res-badge';
      badge.textContent = ICONS[card.resource]?.sym || '?';

      div.appendChild(img); div.appendChild(badge);
      div.title = `${card.name} — ${ICONS[card.resource]?.label}`;

      // Explore pay click for crew area (human only, in explore-pay mode)
      if(pid==='human' && uiMode==='explore-pay') {
        div.style.cursor='pointer';
        const paidKey = `crew_${col}_${ci}`;
        const isPaid = exploreCtx.paidCards.some(pc=>pc.key===paidKey);
        if(isPaid) div.style.opacity='0.45';
        div.onclick=(e)=>{ e.stopPropagation(); togglePayCrewCard(col,ci); };
      }

      el.appendChild(div);
    });
  });

  // Hand (human only)
  if(pid==='human') {
    renderHand(p);
    document.getElementById('hand-count').textContent = p.hand.length;
    showHide('traded-chip', p.tradedThisTurn);
    showHide('action-chip', G.mainActionDone);
  }

  // Destinations owned — stacked display
  const destEl = document.getElementById(`${pre}-destinations`);
  destEl.innerHTML = '';
  if(p.destinations.length > 0) {
    // Group by type (settlement / trade_post)
    const settle = p.destinations.filter(d=>d.id.includes('settlement'));
    const trade  = p.destinations.filter(d=>!d.id.includes('settlement'));
    if(settle.length > 0) destEl.appendChild(buildStackedDests(settle, false));
    if(trade.length  > 0) destEl.appendChild(buildStackedDests(trade,  false));
  }
  document.getElementById(`${pre}-dest-count`).textContent = p.destinations.length;

  // Reserved (human only)
  if(pid==='human') {
    const resEl = document.getElementById('human-reserved');
    resEl.innerHTML = '';
    const resTitle = document.getElementById('reserved-title');
    if(p.reserved.length>0) {
      resTitle.style.display='block';
      document.getElementById('reserved-count').textContent = p.reserved.length;
      p.reserved.forEach(d=>{ resEl.appendChild(buildOwnedDestCard(d, true)); });
    } else {
      resTitle.style.display='none';
    }
  }

  // Ship tile
  renderShipTile(pre, p.tileId);
}

function renderHand(p) {
  const el = document.getElementById('human-hand');
  el.innerHTML = '';
  p.hand.forEach((card, idx)=>{
    const div = document.createElement('div');
    div.className = 'hand-card';

    const bar = document.createElement('div');
    bar.className = 'hcard-color-bar';
    bar.style.background = COLOR_BG[card.color];

    const img = document.createElement('img');
    img.src = GAME_DATA.BASE + card.img;
    img.alt = card.name;
    img.style.width='100%'; img.style.height='100%'; img.style.objectFit='cover';
    img.onerror = ()=>{
      img.remove();
      div.style.background = COLOR_BG[card.color];
      div.style.display='flex'; div.style.alignItems='center'; div.style.justifyContent='center';
      div.style.fontSize='1.6rem';
      div.textContent = ICONS[card.resource]?.sym || '?';
    };

    const resBadge = document.createElement('div');
    resBadge.className = 'hcard-res';
    resBadge.textContent = ICONS[card.resource]?.sym || '?';
    resBadge.style.color = ICONS[card.resource]?.col || '#fff';

    div.appendChild(bar); div.appendChild(img); div.appendChild(resBadge);
    div.title = `${card.name}\n顏色：${COLOR_ZH[card.color]}\n資源：${ICONS[card.resource]?.label}`;

    // Mode styling
    if(uiMode==='recruit') {
      div.classList.add('selectable');
      div.onclick = ()=>clickHandCard(idx);
    } else if(uiMode==='explore-pay') {
      const paidKey = `hand_${idx}`;
      const isPaid = exploreCtx.paidCards.some(pc=>pc.key===paidKey);
      if(isPaid) {
        div.classList.add('selected-pay');
      } else {
        div.classList.add('selectable-pay');
      }
      div.onclick = ()=>clickHandCard(idx);
    } else {
      div.onclick = ()=>{ const c=G.players.human.hand[idx]; if(c)showCardInfoModal(c); };
    }

    el.appendChild(div);
  });
}

function buildOwnedDestCard(dest, isReserved) {
  const d = document.createElement('div');
  const isSett = dest.id.includes('settlement');
  d.className = `dest-owned-card ${isReserved?'reserved-dest':(isSett?'settlement-owned':'trade-post-owned')}`;
  d.title = dest.name;
  d.onclick = ()=>showDestInfoModal(dest);

  // Click to select for explore-pay (reserved)
  if(isReserved && (uiMode==='explore-dest'||uiMode==='explore-pay')) {
    d.onclick = ()=>clickReservedDest(dest.id);
    if(exploreCtx.destId===dest.id) d.style.boxShadow='0 0 14px rgba(42,157,157,.7)';
  }

  const img = document.createElement('img');
  img.src = GAME_DATA.BASE + dest.img;
  img.alt = dest.name;
  img.onerror=()=>{ img.style.display='none'; };

  const rewards = (dest.rewards||[]).map(r=>`${ICONS[r.icon]?.sym||'?'}×${r.amount}`).join(' ');
  const tradeRow = (dest.trade_cols||[null,null,null]).map(t=>
    `<div class="dtr-cell" title="${t?ICONS[t]?.label:'空'}">${t?ICONS[t]?.sym:'—'}</div>`
  ).join('');

  const body = document.createElement('div');
  body.className = 'dcard-body';
  body.innerHTML = `
    <div class="dcard-name">${dest.name}${isReserved?' 🔖':''}</div>
    <div style="display:flex;align-items:baseline;gap:3px">
      ${dest.points>0?`<span class="dcard-pts">${dest.points}</span><span style="font-size:.5rem;color:#706045">分</span>`:'<span style="font-size:.58rem;color:#706045">見獎勵</span>'}
    </div>
    <div style="font-size:.55rem;color:#888;margin-top:2px">${rewards}</div>
    <div class="dcard-trade">${tradeRow}</div>
  `;

  d.appendChild(img); d.appendChild(body);
  return d;
}

// Build a stacked pile of same-type destination cards (latest on top, offset for depth effect)
function buildStackedDests(dests, isReserved) {
  const wrapper = document.createElement('div');
  wrapper.className = 'dest-stack-wrapper';
  // Show all as stacked, top card visible
  dests.forEach((dest, i) => {
    const card = buildOwnedDestCard(dest, isReserved);
    card.style.position = 'absolute';
    card.style.top = `${i * 4}px`;
    card.style.left = `${i * 4}px`;
    card.style.zIndex = i + 1;
    wrapper.appendChild(card);
  });
  // Set wrapper height to accommodate the stack
  const baseH = 120; // approximate card height
  wrapper.style.height = `${baseH + (dests.length-1)*4}px`;
  wrapper.style.width = `${90 + (dests.length-1)*4}px`;
  return wrapper;
}

function renderCrewMarket() {
  const el = document.getElementById('crew-market');
  el.innerHTML = '';
  G.zones.crewMarket.forEach(card => {
    const div = document.createElement('div');
    div.className = `crew-mkt-card c${card.color}`;
    div.title = `${card.name}\n${COLOR_ZH[card.color]}色 — ${ICONS[card.resource]?.label}`;

    // Color badge bar at top
    const colorBadge = document.createElement('div');
    colorBadge.className = 'cmc-color-badge';
    colorBadge.style.background = COLOR_BG[card.color];
    colorBadge.style.borderBottom = `2px solid ${COLOR_TEXT[card.color]}`;
    const dot = document.createElement('span');
    dot.className = 'cmc-color-dot';
    dot.style.background = COLOR_TEXT[card.color];
    const label = document.createElement('span');
    label.className = 'cmc-color-label';
    label.textContent = COLOR_ZH[card.color];
    label.style.color = COLOR_TEXT[card.color];
    colorBadge.appendChild(dot); colorBadge.appendChild(label);

    const img = document.createElement('img');
    img.src = GAME_DATA.BASE + card.img;
    img.alt = card.name;
    img.onerror=()=>{ img.remove(); div.style.background=COLOR_BG[card.color]; div.style.display='flex'; div.style.alignItems='center'; div.style.justifyContent='center'; div.style.fontSize='2rem'; div.textContent=ICONS[card.resource]?.sym||'?'; };

    const res = document.createElement('div');
    res.className = 'cmc-res';
    res.textContent = ICONS[card.resource]?.sym || '?';
    res.style.color = ICONS[card.resource]?.col || '#fff';

    div.appendChild(colorBadge); div.appendChild(img); div.appendChild(res);
    div.onclick = () => showCardInfoModal(card);
    el.appendChild(div);
  });
}

function renderDestMarket() {
  renderDestRow('trade-post-market', G.zones.tradeMarket, 'trade-post-card');
  renderDestRow('settlement-market', G.zones.settleMarket, 'settlement-card');
}

function renderDestRow(containerId, cards, typeClass) {
  const el = document.getElementById(containerId);
  el.innerHTML = '';
  const isSettle = containerId.includes('settlement');

  cards.forEach(card=>{
    const div = document.createElement('div');
    div.className = `dest-mkt-card ${typeClass}`;

    // Explore mode highlight
    if(uiMode==='explore-dest'||uiMode==='explore-pay') {
      if(exploreCtx.destId===card.id) div.classList.add('selected-dest');
      else div.classList.add('selectable-dest');
    }

    const img = document.createElement('img');
    img.src = GAME_DATA.BASE + card.img;
    img.alt = card.name;
    img.onerror=()=>{ img.style.height='40px'; img.style.objectFit='cover'; };

    const rewards = (card.rewards||[]).map(r=>
      `<span class="reward-chip">${ICONS[r.icon]?.sym||'?'}×${r.amount} ${ICONS[r.icon]?.label||''}</span>`
    ).join('');
    const tradeRow = (card.trade_cols||[null,null,null]).map((t,i)=>
      `<div class="dmtr-cell" title="${['左','中','右'][i]}欄">${t?ICONS[t]?.sym:'—'}</div>`
    ).join('');

    const body = document.createElement('div');
    body.className = 'dmcard-body';
    body.innerHTML = `
      <div class="dmcard-name">${card.name}</div>
      <div class="dmcard-pts-row">
        ${card.points>0?`<span class="dmcard-pts">${card.points}</span><span class="dmcard-pts-lbl">分</span>`:'<span style="font-size:.6rem;color:#888">見獎勵</span>'}
      </div>
      <div class="dmcard-cost">費用：同色 4 張（⚡可代替）</div>
      <div class="dmcard-rewards">${rewards}</div>
      <div class="dmcard-trade">${tradeRow}</div>
    `;

    div.appendChild(img); div.appendChild(body);

    div.onclick = ()=>clickDestMarketCard(card.id, isSettle);
    el.appendChild(div);
  });
}

function renderShipTile(prefix, tileId) {
  const tile = GAME_DATA.SHIP_TILES.find(t=>t.id===tileId);
  const el = document.getElementById(`${prefix}-trade-cols`);
  if(!tile||!el) return;
  el.innerHTML = '';
  ['左欄','中欄','右欄'].forEach((lbl,i)=>{
    const col = tile.trade_columns[i]||[];
    const d = document.createElement('div');
    d.className = 'stcol';
    d.innerHTML = `<div class="stcol-lbl">${lbl}</div><div class="stcol-icons">${col.map(r=>`<span title="${ICONS[r]?.label}">${ICONS[r]?.sym||r}</span>`).join('')}</div>`;
    el.appendChild(d);
  });
}

function renderRepTrack(prefix, rep) {
  const el = document.getElementById(`${prefix}-rep-track`);
  if(!el) return; el.innerHTML = '';
  const milestones={3:'1',6:'2',10:'3',14:'5'};
  for(let i=0;i<=14;i++){
    const d=document.createElement('div');
    d.className='rep-cell';
    if(milestones[i]) d.classList.add('milestone');
    if(i<rep) d.classList.add('filled');
    if(i===rep) d.classList.add('current');
    d.title = `格${i}${milestones[i]?` (+${milestones[i]}分/回合)`:''} — 當前:${rep}`;
    el.appendChild(d);
  }
}

// ─── Action Button States ─────────────────────────────────────────────
function updateActionBtns() {
  if(!G) return;
  const p = G.players.human;
  const isMyTurn = G.activePlayer==='human';
  const tradeOpen = !document.getElementById('trade-inline').classList.contains('hidden');
  const exploreOpen = !document.getElementById('explore-inline').classList.contains('hidden');

  const canTrade = isMyTurn && !p.tradedThisTurn && p.tokens.silver_bracelet>0 && uiMode==='idle';
  const canRecruit = isMyTurn && !G.mainActionDone && p.hand.length>0 && uiMode==='idle';
  const canExplore = isMyTurn && !G.mainActionDone && uiMode==='idle';
  const canEnd = isMyTurn && uiMode==='idle';

  document.getElementById('btn-trade').disabled = !canTrade;
  document.getElementById('btn-recruit').disabled = !canRecruit;
  document.getElementById('btn-explore').disabled = !canExplore;
  document.getElementById('btn-end-turn').disabled = !canEnd;

  // Phase label
  let phaseTxt = '';
  if(!isMyTurn) phaseTxt = '電腦回合中';
  else if(uiMode==='recruit') phaseTxt = '招募模式';
  else if(uiMode==='explore-dest') phaseTxt = '探索：選目的地';
  else if(uiMode==='explore-pay') phaseTxt = '探索：選費用';
  else if(G.mainActionDone && !p.tradedThisTurn) phaseTxt = '可行後貿易';
  else if(G.mainActionDone) phaseTxt = '可結束回合';
  else phaseTxt = '可執行行動';
  document.getElementById('phase-label').textContent = phaseTxt;
}

// ─── Highlight helpers ────────────────────────────────────────────────
function addHighlightToHand(mode) {
  // Handled via mode-based CSS classes in renderHand
  renderHand(G.players.human);
}
function addHighlightToDests() {
  renderDestMarket();
  // Also highlight reserved in panel
  renderPanel('human');
}
function addHighlightToCrewForPay() {
  renderPanel('human'); // crew-area cards get onclick if uiMode=explore-pay
}
function clearHighlights() { renderHand(G.players.human); renderDestMarket(); renderPanel('human'); }

// ─── Info Modals ──────────────────────────────────────────────────────
function showCardInfoModal(card) {
  const img = document.getElementById('modal-card-img');
  img.src = GAME_DATA.BASE + card.img;
  img.alt = card.name;
  img.style.display='block';
  img.onerror=()=>{ img.style.display='none'; };
  document.getElementById('modal-card-name').textContent = card.name;
  document.getElementById('modal-card-body').innerHTML = `
    <p>顏色：<span style="color:${COLOR_TEXT[card.color]}">${COLOR_ZH[card.color]}色</span></p>
    <p>資源圖標：<span style="color:${ICONS[card.resource]?.col}">${ICONS[card.resource]?.sym}</span> ${ICONS[card.resource]?.label}</p>
    <p style="margin-top:6px;font-size:.75rem;color:#706045">招募後取得所在縱列所有可見資源，並補充1張同色手牌。</p>
  `;
  showModal('modal-card-info');
}

function showDestInfoModal(dest) {
  const img = document.getElementById('modal-card-img');
  img.src = GAME_DATA.BASE + dest.img;
  img.alt = dest.name;
  img.style.display='block';
  img.onerror=()=>{ img.style.display='none'; };
  document.getElementById('modal-card-name').textContent = dest.name;
  const rwd = (dest.rewards||[]).map(r=>`<span style="color:${ICONS[r.icon]?.col}">${ICONS[r.icon]?.sym}×${r.amount} ${ICONS[r.icon]?.label}</span>`).join('  ');
  const trade = (dest.trade_cols||[]).map((t,i)=>t?`<span>${['左','中','右'][i]}欄：<span style="color:${ICONS[t]?.col}">${ICONS[t]?.sym} ${ICONS[t]?.label}</span></span>`:null).filter(Boolean).join('  ');
  document.getElementById('modal-card-body').innerHTML = `
    ${dest.points>0?`<p>分數：<strong style="color:#f0cc6e">${dest.points}</strong> 分</p>`:''}
    <p>探索費用：同色任意 4 張船員（⚡招募標記可各代替1張）</p>
    <p style="margin-top:6px">右上角獎勵：${rwd||'無'}</p>
    ${trade?`<p style="margin-top:4px">貿易欄：${trade}</p>`:''}
  `;
  showModal('modal-card-info');
}

function showCrewColResource(color) {
  if(!G) return;
  const p = G.players.human;
  const cards = p.crew[color];
  const res = cards.map(c=>`${ICONS[c.resource]?.sym} ${ICONS[c.resource]?.label}`).join('、');
  showToast(`${COLOR_ZH[color]}色縱列 ${cards.length}張 → 取得：${res||'無'}`, 'gold');
}

// ─── Victory ─────────────────────────────────────────────────────────
function endGame() {
  const h=G.players.human, c=G.players.computer;
  let result='';
  if(h.score>c.score) result=`🏆 ${h.name} 獲勝！`;
  else if(c.score>h.score) result='🤖 電腦獲勝！';
  else result='⚖ 平局！共享勝利！';

  document.getElementById('gameover-title').textContent='遊戲結束！';
  document.getElementById('gameover-result').textContent=result;
  document.getElementById('gameover-scores').innerHTML=`
    <div class="gscore-block"><div class="gscore-name">${h.name}</div><div class="gscore-val">${h.score}</div><div style="font-size:.7rem;color:#888">聲望${h.reputation}</div></div>
    <div class="gscore-block"><div class="gscore-name">電腦對手</div><div class="gscore-val">${c.score}</div><div style="font-size:.7rem;color:#888">聲望${c.reputation}</div></div>
  `;
  showScreen('screen-gameover');
}

// ─── Helpers ──────────────────────────────────────────────────────────
function repScore(pos) { let s=0; REP_THRESH.forEach(t=>{ if(pos>=t.p)s=t.s; }); return s; }
function iLabel(id) { return ICONS[id]?.label||id; }
function findDest(id) {
  if(!id) return null;
  return [...G.zones.settleMarket,...G.zones.tradeMarket,...G.players.human.reserved,...G.players.computer.reserved,...G.players.human.destinations,...G.players.computer.destinations].find(d=>d.id===id)||null;
}
function shuffle(arr) { for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];} return arr; }
function clearExploreCtx() { exploreCtx={destId:null,destIsReserved:false,paidCards:[],tokensUsed:0}; }
function closeTradeInline() { hideElem('trade-inline'); }
function closeExploreInline() { hideElem('explore-inline'); }
function setPhase(ph) { G.phase=ph; }
function updateDeckBadges() {
  document.getElementById('crew-deck-count').textContent = G.zones.crewDeck.length;
  document.getElementById('settlement-deck-count').textContent = G.zones.settleDeck.length;
  document.getElementById('trade-post-deck-count').textContent = G.zones.tradeDeck.length;
}
function updateRoundLabel() { document.getElementById('round-label').textContent=`回合 ${G.round}`; }

// ─── Log ──────────────────────────────────────────────────────────────
function addLog(msg, type) {
  const el = document.getElementById('log-entries');
  const d = document.createElement('div');
  d.className = `log-entry ${type||''}`;
  d.textContent = msg;
  el.appendChild(d);
  el.scrollTop = el.scrollHeight;
}

// ─── UI Utilities ─────────────────────────────────────────────────────
function showScreen(id) { document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active')); document.getElementById(id).classList.add('active'); }
function showModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function showRules() { showModal('modal-rules'); }
function toggleLog() { document.getElementById('event-log').classList.toggle('hidden'); }
function showElem(id) { document.getElementById(id).classList.remove('hidden'); }
function hideElem(id) { document.getElementById(id).classList.add('hidden'); }
function showHide(id, show) { const el=document.getElementById(id); if(el){ if(show)el.classList.remove('hidden'); else el.classList.add('hidden'); } }

let _toastTimer = null;
function showToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type||''}`;
  t.classList.remove('hidden');
  if(_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(()=>t.classList.add('hidden'), 3000);
}

// Bootstrap handled by game.html inline script
