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
  draw_crew_card: {sym:'🃏', label:'抽取並放置船員', col:'#c084fc'},
};
const REP_THRESH = [{p:0,s:0},{p:3,s:1},{p:6,s:2},{p:10,s:3},{p:14,s:5}];
const RELIC_RULE_DETAILS = {
  knarr_relic_windsock: {
    timing:'完成 5 色橫排後，立即進入額外探索窗口。',
    condition:'自己的船員區域形成 1 條由藍、黃、綠、紅、紫各 1 張組成的橫排。',
    effect:'可立即執行 1 次探索，仍必須從船員區域支付目的地左側探索費用，招募標記仍可各代替 1 張船員。',
    use:'達成條件時應選擇 1 張公開或預留目的地，再正常支付探索費。若無法支付探索費，不能取得目的地。',
    compliance:'已自動化：新完成 5 色橫排時開啟額外探索窗口；每條橫排只觸發一次。'
  },
  knarr_relic_gold_bracelet: {
    timing:'招募船員放入同色縱列後立即檢查。',
    condition:'本次招募放入的同色船員剛好是該色第 3 張。',
    effect:'可預留 1 張目的地卡，並立即從同類型目的地牌庫補公開市場；每位玩家最多同時預留 2 張。',
    use:'觸發後會開啟目的地預留視窗。選定目的地後放入自己的預留區，之後可在探索行動選擇該預留目的地。',
    compliance:'已符合並自動化：第 3 張同色招募、預留上限、預留後補同類型市場。'
  },
  knarr_relic_cauldron: {
    timing:'招募船員後，拿取公開船員的步驟。',
    condition:'本次招募放入的同色船員剛好是該色第 2 張。',
    effect:'本次拿取公開船員時可免費從 5 張公開船員中任選 1 張。',
    use:'觸發後公開船員選擇區會改為免費任選，不需要花費招募標記。',
    compliance:'已符合並自動化：第 2 張同色招募後，本次公開船員拿取免費任選。'
  },
  knarr_relic_iron_helmet: {
    timing:'探索取得定居點後，依目的地放置位置檢查。',
    condition:'探索取得定居點卡，並將其放在貿易點卡上方且相鄰。',
    effect:'立即執行 1 次招募。',
    use:'數位版目前以取得定居點且已擁有至少 1 張貿易點作為可形成相鄰放置的條件；觸發後可立即招募 1 張手牌船員。',
    compliance:'已自動化：探索定居點後，若已有貿易點，開啟立即招募確認。'
  },
  knarr_relic_mead_cup: {
    timing:'探索行動完成後。',
    condition:'本回合執行了探索行動。',
    effect:'可棄置 1 張版圖下方公開船員卡，並用船員牌庫頂牌替換。',
    use:'探索成功後會開啟公開船員替換視窗，可選 1 張公開船員替換，或略過不使用。',
    compliance:'已符合並自動化：探索後可選擇替換 1 張公開船員，也可略過。'
  },
  knarr_relic_silver_coin: {
    timing:'招募船員放入同色縱列後立即檢查。',
    condition:'本次招募放入的同色船員是該色第 4 張或更多。',
    effect:'獲得 1 點勝利分數。',
    use:'達成條件時立即加 1 分；每次符合條件的招募都會檢查。',
    compliance:'已符合並自動化：第 4 張或更多同色招募立即 +1 分。'
  },
  knarr_relic_amulet: {
    timing:'招募或抽取並放置船員後，檢查船員區域橫排。',
    condition:'透過招募或探索相關效果完成 1 條由 5 種不同顏色船員構成的橫排。',
    effect:'獲得 1 枚銀臂鐲、1 枚招募標記與 1 點聲望值。',
    use:'每條已完成的 5 色橫排只獎勵一次。探索支付船員可能移除橫排；重新完成未領過的橫排時會再檢查。',
    compliance:'已符合並自動化：招募與抽取並放置船員後會檢查新完成橫排並給予三項獎勵。'
  }
};

// ─── Game State ───────────────────────────────────────────────────────
let G = null;

// UI interaction mode
let uiMode = 'idle'; // 'idle' | 'trade' | 'recruit' | 'recruit-take' | 'explore-dest' | 'explore-pay'
let exploreCtx = {destId:null, destIsReserved:false, paidCards:[], tokensUsed:0};
let recruitTakeCtx = {color:null, pendingGoldBracelet:false, freeAny:false, tokenPickActive:false};

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
let selectedArtifactId = 'none';

function startSetup() {
  showScreen('screen-setup');
  renderSetupTiles();
  renderSetupArtifacts();
}

function renderSetupTiles() {
  const box = document.getElementById('ship-tile-selector');
  box.innerHTML = '';
  GAME_DATA.SHIP_TILES.forEach(t => {
    const d = document.createElement('div');
    d.className = 'ship-tile-option' + (t.id === selectedTileId ? ' selected' : '');
    const colIcons = [0,1,2].map(i => {
      const col = t.trade_columns?.[i] || [];
      const icons = col.length
        ? col.map(r=>`<span class="setup-res-icon" title="${ICONS[r]?.label||r}" style="color:${ICONS[r]?.col||'#f0e8d0'}">${ICONS[r]?.sym||r}</span>`).join('')
        : '<span class="setup-empty-icon">無</span>';
      return `<div class="tile-preview-col"><span class="tile-preview-label">${['左','中','右'][i]}</span><span class="tile-preview-icons">${icons}</span></div>`;
    }).join('');
    d.innerHTML = `
      <div class="tile-id">${t.label}</div>
      <div class="tile-preview">
        <img src="${getShipTileImageSrc(t.id)}" alt="${t.label}">
        <div class="tile-preview-overlay">${colIcons}</div>
      </div>
    `;
    d.onclick = () => {
      selectedTileId = t.id;
      document.querySelectorAll('.ship-tile-option').forEach(el=>el.classList.remove('selected'));
      d.classList.add('selected');
    };
    box.appendChild(d);
  });
}

function getShipTileImageSrc(tileId) {
  const m = tileId.match(/side_\d+/);
  const sideNum = m ? m[0] : 'side_001';
  return `component_images/knarr_core_ship_tile_${sideNum}.png`;
}

function renderSetupArtifacts() {
  const box = document.getElementById('artifact-selector');
  if(!box) return;
  box.innerHTML = '';
  const options = [
    {id:'none', name:'不使用聖物', effect:'核心遊戲規則', img:null},
    ...GAME_DATA.ARTIFACTS,
  ];
  options.forEach(a => {
    const detail = RELIC_RULE_DETAILS[a.id];
    const conditionText = detail?.condition || a.condition || '依聖物卡文字。';
    const effectText = detail?.effect || a.effect || '依聖物卡文字。';
    const effectHtml = a.id === 'none'
      ? '<div>不啟用聖物模組，只使用核心遊戲規則。</div>'
      : `
        <div><strong>條件：</strong>${conditionText}</div>
        <div><strong>效果：</strong>${effectText}</div>
      `;
    const d = document.createElement('div');
    d.className = 'artifact-option' + (a.id === selectedArtifactId ? ' selected' : '');
    d.title = a.id === 'none' ? a.effect : `${a.name}\n條件：${conditionText}\n效果：${effectText}`;
    const img = a.img
      ? `<img src="${GAME_DATA.BASE}${a.img}" alt="${a.name}">`
      : `<div class="artifact-none-icon">—</div>`;
    d.innerHTML = `
      <div class="artifact-img">${img}</div>
      <div class="artifact-name">${a.name}</div>
      <div class="artifact-effect">${effectHtml}</div>
      ${a.id === 'none' ? '' : '<button type="button" class="artifact-detail-btn">查看詳細說明</button>'}
    `;
    d.onclick = () => {
      selectedArtifactId = a.id;
      document.querySelectorAll('.artifact-option').forEach(el=>el.classList.remove('selected'));
      d.classList.add('selected');
    };
    const detailBtn = d.querySelector('.artifact-detail-btn');
    if(detailBtn) {
      detailBtn.onclick = (e) => {
        e.stopPropagation();
        showRelicInfoModal(a);
      };
    }
    box.appendChild(d);
  });
}

function initGame() {
  const name = document.getElementById('player-name-input').value.trim() || '維京艦長';
  const relicOn = selectedArtifactId !== 'none';
  const activeRelic = relicOn ? GAME_DATA.ARTIFACTS.find(a=>a.id===selectedArtifactId) : null;

  G = {
    relicOn,
    activeRelicId: relicOn ? selectedArtifactId : null,
    activeRelic,
    relicState:{
      amuletRows:{human:[], computer:[]},
      windsockRows:{human:[], computer:[]},
      lastTrigger:null
    },
    activePlayer: 'human', // set by random later
    phase: 'setup',
    round: 0, turn: 0,
    mainActionDone: false,
    players: {
      human:    mkPlayer(selectedTileId, name),
      computer: mkPlayer('knarr_core_ship_tile_2_side_003', '電腦對手'),
    },
    zones: {
      crewDeck:[], crewDiscard:[],
      // Fixed 5 color slots (board positions): slot.color = fixed position, slot.card = current card there
      crewMarket: COLORS.map(c=>({slot:c, card:null})),
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
  recruitTakeCtx = {color:null, pendingGoldBracelet:false, freeAny:false, tokenPickActive:false};
  closeRecruitInline();
  closeRecruitTokenInline();
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
  closeTradeInline(); closeExploreInline(); closeRecruitInline(); closeRecruitTokenInline();
  uiMode = 'idle';
  recruitTakeCtx = {color:null, pendingGoldBracelet:false, freeAny:false, tokenPickActive:false};
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
  uiMode = 'trade';
  closeExploreInline();
  closeRecruitInline();
  closeRecruitTokenInline();
  clearHighlights();
  document.getElementById('action-zone-label').textContent = '貿易：選擇要花費的銀臂鐲數量';
  document.getElementById('trade-bracelet-count').textContent = p.tokens.silver_bracelet;
  showElem('trade-inline'); updateActionBtns();
}

function cancelTrade() {
  if(uiMode === 'trade') uiMode = 'idle';
  hideElem('trade-inline');
  document.getElementById('action-zone-label').textContent = '可執行行動';
  updateActionBtns();
}

function executeTrade(amount) {
  const p = G.players.human;
  if(uiMode !== 'trade') return;
  if(p.tokens.silver_bracelet < amount){ showToast(`銀臂鐲不足！需要${amount}枚`,'bad'); return; }
  p.tokens.silver_bracelet -= amount;
  p.tradedThisTurn = true;
  hideElem('trade-inline');
  uiMode = 'idle';

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
  closeTradeInline(); closeExploreInline(); closeRecruitTokenInline();
  document.getElementById('action-zone-label').textContent = '招募模式：點選手牌中的船員執行招募';
  showElem('recruit-inline');
  addHighlightToHand('recruit');
  document.getElementById('hand-hint').textContent = '— 點擊招募';
  updateActionBtns();
}

function cancelRecruit() {
  if(uiMode !== 'recruit') return;
  uiMode = 'idle';
  closeRecruitInline();
  clearHighlights();
  document.getElementById('action-zone-label').textContent = '可執行行動';
  document.getElementById('hand-hint').textContent = '— 點牌查看';
  updateActionBtns();
}

function clickHandCard(cardIdx) {
  if(uiMode==='recruit') {
    doRecruitCard(cardIdx);
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

  G.mainActionDone = true;
  closeRecruitInline();
  recruitTakeCtx = {
    color:col,
    pendingGoldBracelet:hasRelic('knarr_relic_gold_bracelet') && newCount===3,
    freeAny:hasRelic('knarr_relic_cauldron') && newCount===2,
    tokenPickActive:false,
  };
  if(hasRelic('knarr_relic_silver_coin') && newCount>=4) {
    noteRelicTrigger('銀錢幣：獲得 1 點勝利分數');
    applyRes('human','victory_point',1,'銀錢幣');
  }
  checkAmulet('human', '護身符');
  clearHighlights();

  uiMode = 'recruit-take';
  if(recruitTakeCtx.freeAny) {
    document.getElementById('action-zone-label').textContent = '招募：大煮釜觸發，選擇要拿取的公開船員';
    document.getElementById('hand-hint').textContent = '— 大煮釜可任選公開船員';
    updateUI(); updateActionBtns();
    noteRelicTrigger('大煮釜：本次可免費任選公開船員');
    showRecruitTakePrompt(col);
  } else if(p.tokens.recruit_token > 0 && G.zones.crewMarket.some(s=>s.card)) {
    document.getElementById('action-zone-label').textContent = '招募：選擇拿對應市場格位，或使用招募標記改選';
    document.getElementById('hand-hint').textContent = '— 招募已完成，請決定拿公開船員';
    updateUI(); updateActionBtns();
    showRecruitTakePrompt(col);
  } else {
    takeSameColorFromMarket('human', col);
    finalizeRecruitTake();
  }
  showToast(`招募成功！${COLOR_ZH[col]}色縱列取得資源`, 'good');
}

function takeSameColorFromMarket(pid, color) {
  const p = G.players[pid];
  // Take from the FIXED SLOT of that color (the board position), regardless of card color
  const slot = G.zones.crewMarket.find(s=>s.slot===color);
  if(slot && slot.card) {
    const card = slot.card;
    slot.card = null; // clear slot
    p.hand.push(card);
    addLog(`  從公開市場${COLOR_ZH[color]}色格位取得 ${card.name}（${COLOR_ZH[card.color]}色）到手牌`, '');
    refillCrew();
    updateUI(); updateActionBtns();
    return true;
  } else {
    addLog(`  ${COLOR_ZH[color]}色格位無牌`, '');
    // Computer auto-picks best available slot with token
    if(pid==='computer' && p.tokens.recruit_token > 0) {
      const avail = G.zones.crewMarket.filter(s=>s.card);
      if(avail.length > 0) {
        p.tokens.recruit_token--;
        const picked = avail[0];
        const card = picked.card; picked.card = null;
        p.hand.push(card); refillCrew();
        addLog(`  電腦花費⚡標記，選取 ${card.name}到手牌`, '');
        updateUI(); updateActionBtns();
        return true;
      }
    }
  }
  updateUI(); updateActionBtns();
  return false;
}

function showRecruitTokenPick() {
  if(uiMode !== 'recruit-take') return;
  recruitTakeCtx.tokenPickActive = true;
  showRecruitMarketChoice(recruitTakeCtx.color);
  updateUI();
}

function showRecruitTakePrompt(color) {
  const p = G.players.human;
  const inline = document.getElementById('recruit-token-inline');
  const title = document.getElementById('recruit-token-title') || inline.querySelector('.recruit-token-title');
  const skipBtn = document.getElementById('recruit-token-skip-btn');
  const useBtn = document.getElementById('recruit-token-use-btn');
  const freeSlot = G.zones.crewMarket.find(s=>s.slot===color && s.card);
  const canUseToken = p.tokens.recruit_token > 0 && G.zones.crewMarket.some(s=>s.card);

  recruitTakeCtx.tokenPickActive = false;
  if(recruitTakeCtx.freeAny) {
    showRecruitMarketChoice(color);
    return;
  }

  if(title) {
    title.innerHTML = `招募完成：可直接拿取公開市場${COLOR_ZH[color]}色格位的船員到手牌。若要改選其他公開船員，請按「使用招募標記」（目前 <span id="recruit-token-available">${p.tokens.recruit_token}</span> 枚）。`;
  }
  if(skipBtn) {
    skipBtn.textContent = freeSlot ? `拿對應${COLOR_ZH[color]}色市場格到手牌` : '完成，不拿牌';
  }
  if(useBtn) {
    useBtn.hidden = !canUseToken;
    useBtn.disabled = !canUseToken;
  }
  const available = document.getElementById('recruit-token-available');
  if(available) available.textContent = p.tokens.recruit_token;

  const container = document.getElementById('recruit-market-pick');
  container.innerHTML = '';
  if(freeSlot) {
    container.appendChild(renderRecruitPickCard(freeSlot, true));
  } else {
    const note = document.createElement('div');
    note.className = 'recruit-empty-note';
    note.textContent = `公開市場${COLOR_ZH[color]}色格位沒有船員可拿。`;
    container.appendChild(note);
  }
  inline.classList.remove('hidden');
  updateUI();
}

function showRecruitMarketChoice(color) {
  const p = G.players.human;
  const inline = document.getElementById('recruit-token-inline');
  const title = document.getElementById('recruit-token-title') || inline.querySelector('.recruit-token-title');
  const skipBtn = document.getElementById('recruit-token-skip-btn');
  const useBtn = document.getElementById('recruit-token-use-btn');
  if(title) {
    title.innerHTML = recruitTakeCtx.freeAny
      ? `招募完成：大煮釜觸發，本次可免費任選 1 張公開船員（你有 <span id="recruit-token-available">${p.tokens.recruit_token}</span> 枚招募標記）。`
      : `使用招募標記：選擇要花費 1 枚招募標記拿取的公開船員（目前 <span id="recruit-token-available">${p.tokens.recruit_token}</span> 枚）。`;
  }
  if(skipBtn) {
    skipBtn.textContent = recruitTakeCtx.freeAny
      ? '完成，不拿牌'
      : '取消使用招募標記，回到對應格位';
  }
  if(useBtn) {
    useBtn.hidden = true;
  }
  const available = document.getElementById('recruit-token-available');
  if(available) available.textContent = p.tokens.recruit_token;
  const container = document.getElementById('recruit-market-pick');
  container.innerHTML = '';
  G.zones.crewMarket.forEach(slot => {
    if(!slot.card) return;
    const isFree = recruitTakeCtx.freeAny;
    container.appendChild(renderRecruitPickCard(slot, isFree));
  });
  inline.classList.remove('hidden');
}

function renderRecruitPickCard(slot, isFree) {
  const p = G.players.human;
  const canPick = isFree || p.tokens.recruit_token > 0;
  const div = document.createElement('div');
  div.className = `recruit-pick-card c${slot.card.color}${isFree?' free-pick':canPick?' token-pick':' disabled-pick'}`;
  div.title = `${slot.card.name}\n牌色：${COLOR_ZH[slot.card.color]}色\n格位：${COLOR_ZH[slot.slot]}色\n${isFree?'免費拿取':'花費 1 枚招募標記'}`;
  const slotLbl = document.createElement('div');
  slotLbl.className = 'rpcard-color';
  slotLbl.style.background = COLOR_BG[slot.card.color];
  slotLbl.textContent = COLOR_ZH[slot.card.color];
  const costLbl = document.createElement('div');
  costLbl.className = 'rpcard-cost';
  costLbl.textContent = isFree ? '免費' : '⚡1';
  const img = document.createElement('img');
  img.src = GAME_DATA.BASE + slot.card.img;
  img.alt = slot.card.name;
  img.onerror = () => { img.style.display='none'; div.style.background=COLOR_BG[slot.card.color]; };
  div.appendChild(slotLbl); div.appendChild(costLbl); div.appendChild(img);
  div.onclick = () => {
    if(canPick) showRecruitMarketConfirm(slot);
  };
  return div;
}

function getRecruitPickUseToken(slot) {
  return !(slot.slot === recruitTakeCtx.color || recruitTakeCtx.freeAny);
}

function showRecruitMarketConfirm(slot) {
  if(uiMode !== 'recruit-take' || !slot?.card) {
    if(slot?.card) showCardInfoModal(slot.card);
    return;
  }
  const p = G.players.human;
  const card = slot.card;
  const useToken = getRecruitPickUseToken(slot);
  if(useToken && !recruitTakeCtx.tokenPickActive) {
    showRecruitTakePrompt(recruitTakeCtx.color);
    return;
  }
  const canPick = !useToken || p.tokens.recruit_token > 0;
  document.getElementById('modal-card-info').classList.remove('dest-modal', 'relic-modal');

  const img = document.getElementById('modal-card-img');
  img.src = GAME_DATA.BASE + card.img;
  img.alt = card.name;
  img.style.display='block';
  img.onerror=()=>{ img.style.display='none'; };

  document.getElementById('modal-card-name').textContent = card.name;
  const body = document.getElementById('modal-card-body');
  body.innerHTML = `
    <p>牌色：<span style="color:${COLOR_TEXT[card.color]}">${COLOR_ZH[card.color]}色</span></p>
    <p>格位：<span style="color:${COLOR_TEXT[slot.slot]}">${COLOR_ZH[slot.slot]}色格位</span></p>
    <p>資源圖標：<span style="color:${ICONS[card.resource]?.col}">${ICONS[card.resource]?.sym}</span> ${ICONS[card.resource]?.label}</p>
    <p style="margin-top:8px;color:${canPick?'#f0cc6e':'#fca5a5'}">${useToken ? `花費 1 枚招募標記拿取此船員（目前 ${p.tokens.recruit_token} 枚）` : recruitTakeCtx.freeAny ? '大煮釜觸發，本次可免費任選此船員。' : '此格位符合招募顏色，可免費拿取。'}</p>
  `;
  const actions = document.createElement('div');
  actions.className = 'modal-action-row';
  const confirm = document.createElement('button');
  confirm.className = 'btn-primary';
  confirm.textContent = useToken ? '花費 1 枚招募標記拿取' : '免費拿取';
  confirm.disabled = !canPick;
  confirm.onclick = () => {
    closeModal('modal-card-info');
    pickRecruitMarketCard(slot, useToken);
  };
  actions.appendChild(confirm);
  const cancel = document.createElement('button');
  cancel.className = 'btn-ghost';
  cancel.textContent = '取消，重新選擇';
  cancel.onclick = () => closeModal('modal-card-info');
  actions.appendChild(cancel);
  if(!canPick) {
    const note = document.createElement('span');
    note.className = 'modal-action-note';
    note.textContent = '招募標記不足';
    actions.appendChild(note);
  }
  body.appendChild(actions);
  showModal('modal-card-info');
}

function pickRecruitMarketCard(slot, useToken) {
  const p = G.players.human;
  if(uiMode !== 'recruit-take') return;
  if(!slot.card) { showToast('該格位無牌！','bad'); return; }
  if(useToken) {
    if(p.tokens.recruit_token <= 0) { showToast('招募標記不足！','bad'); return; }
    p.tokens.recruit_token--;
  }
  const taken = slot.card; slot.card = null;
  p.hand.push(taken); refillCrew();
  addLog(useToken
    ? `  花費⚡招募標記，從公開市場選取 ${taken.name}（${COLOR_ZH[taken.color]}色，${COLOR_ZH[slot.slot]}色格位）到手牌`
    : `  從公開市場${COLOR_ZH[slot.slot]}色格位取得 ${taken.name}（${COLOR_ZH[taken.color]}色）到手牌`
  , 'good');
  finalizeRecruitTake();
}

function pickMarketCard(slot) {
  pickRecruitMarketCard(slot, true);
}

function skipRecruitTokenPick() {
  if(uiMode === 'recruit-take') {
    if(recruitTakeCtx.tokenPickActive) {
      showRecruitTakePrompt(recruitTakeCtx.color);
      return;
    }
    if(recruitTakeCtx.freeAny) {
      finalizeRecruitTake();
      return;
    }
    const freeSlot = G.zones.crewMarket.find(s=>s.slot===recruitTakeCtx.color && s.card);
    if(freeSlot) {
      pickRecruitMarketCard(freeSlot, false);
      return;
    }
    finalizeRecruitTake();
    return;
  }
  closeRecruitTokenInline();
  updateUI(); updateActionBtns();
}

function finalizeRecruitTake() {
  const pendingGoldBracelet = recruitTakeCtx.pendingGoldBracelet;
  const shouldCheckWindsock = hasRelic('knarr_relic_windsock');
  closeRecruitTokenInline();
  recruitTakeCtx = {color:null, pendingGoldBracelet:false, freeAny:false, tokenPickActive:false};
  uiMode = 'idle';
  clearHighlights();
  document.getElementById('action-zone-label').textContent = '可執行行動';
  document.getElementById('hand-hint').textContent = '— 點牌查看';
  updateUI(); updateActionBtns();
  if(pendingGoldBracelet) {
    setTimeout(()=>triggerGoldBracelet(), 300);
  }
  if(shouldCheckWindsock) {
    setTimeout(()=>checkWindsock('human'), 300);
  }
}

// ── Explore Mode ──
function enterExploreMode() {
  if(G.mainActionDone){ showToast('主行動已完成！','bad'); return; }
  uiMode = 'explore-dest';
  clearExploreCtx();
  closeTradeInline();
  closeRecruitInline();
  closeRecruitTokenInline();
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

  const dest = findDest(destId);
  const costDesc = dest ? getCostDesc(dest) : '依卡牌左側需求';

  uiMode = 'explore-pay';
  document.getElementById('action-zone-label').textContent = `探索模式：請從船員區域點選所需船員（費用需求：${costDesc}）`;
  document.getElementById('hand-hint').textContent = '— 探索費用從船員區域支付';

  clearHighlights();
  addHighlightToCrewForPay();
  updateExploreSummary();
  updateUI();
}

function togglePayCard(handIdx) {
  if(uiMode!=='explore-pay') return;
  showToast('探索費用需從船員區域選擇，不能使用手牌。', 'bad');
}

function togglePayCrewCard(color, crewIdx) {
  if(uiMode!=='explore-pay') return;
  const p = G.players.human;
  const card = p.crew[color][crewIdx];
  if(!card) return;

  const key = `crew_${color}_${crewIdx}`;
  const exi = exploreCtx.paidCards.findIndex(pc=>pc.key===key);
  if(exi!==-1) {
    exploreCtx.paidCards.splice(exi,1);
  } else {
    const tempPaid = [...exploreCtx.paidCards, {key, source:'crew', color, crewIdx, card}];
    const dest = findDest(exploreCtx.destId);
    const check = checkExplorePayment(dest, tempPaid, exploreCtx.tokensUsed);
    if(check.valid === false && check.reason) {
      showToast(check.reason, 'bad');
      return;
    }
    const maxCards = check.maxCards || 4;
    if(tempPaid.length + exploreCtx.tokensUsed > maxCards) {
      showToast('已選足費用！', 'bad');
      return;
    }
    exploreCtx.paidCards.push({key, source:'crew', color, crewIdx, card});
  }
  updateExploreSummary();
  updateUI();
}

function useTokenForExplore() {
  const p = G.players.human;
  const dest = findDest(exploreCtx.destId);
  if(!dest) return;
  const check = checkExplorePayment(dest, exploreCtx.paidCards, exploreCtx.tokensUsed);
  const maxCards = check.maxCards || 4;
  const total = exploreCtx.paidCards.length + exploreCtx.tokensUsed;

  if(total >= maxCards){ showToast('已達費用上限！','bad'); return; }
  if(p.tokens.recruit_token <= 0){ showToast('招募標記不足！','bad'); return; }
  if(exploreCtx.tokensUsed >= p.tokens.recruit_token){ showToast('招募標記不足！','bad'); return; }
  exploreCtx.tokensUsed++;
  updateExploreSummary();
}

function getExploreCost(dest) {
  return normalizeExploreCost(dest?.cost || dest?.exploration_cost);
}

function normalizeExploreCost(cost) {
  if(!cost) return {type:'same_color', count:4};
  if(cost.type === 'same_color_any') {
    return {type:'same_color', count:cost.crew_cards || cost.count || 4};
  }
  if(cost.type === 'same_color') {
    return {type:'same_color', count:cost.count || cost.crew_cards || 4};
  }
  if(cost.type === 'different') {
    return {type:'different', count:cost.count || cost.crew_cards || 3};
  }
  if(cost.type === 'specified') {
    return {type:'specified', list:[...(cost.list || cost.colors || cost.crew_colors || [])]};
  }
  return {type:'same_color', count:4};
}

function getCostMaxCards(dest) {
  const cost = getExploreCost(dest);
  if(cost.type === 'specified') return cost.list.length;
  return cost.count || 4;
}

function checkExplorePayment(dest, paidCards, tokensUsed) {
  const cost = getExploreCost(dest);
  const paidColors = paidCards.map(c => c.color);

  if (cost.type === 'same_color') {
    const requiredCount = cost.count;
    if (paidColors.length === 0) {
      return { valid: tokensUsed >= requiredCount, maxCards: requiredCount };
    }
    const firstColor = paidColors[0];
    const allSame = paidColors.every(c => c === firstColor);
    if (!allSame) return { valid: false, reason: '必須使用相同顏色的船員！' };
    const total = paidColors.length + tokensUsed;
    return { valid: total >= requiredCount, maxCards: requiredCount };
  }

  if (cost.type === 'different') {
    const requiredCount = cost.count;
    const uniqueColors = new Set(paidColors);
    if (uniqueColors.size !== paidColors.length) {
      return { valid: false, reason: '必須使用不同顏色的船員！' };
    }
    const total = paidColors.length + tokensUsed;
    return { valid: total >= requiredCount, maxCards: requiredCount };
  }

  if (cost.type === 'specified') {
    const requiredList = [...cost.list];
    let unmatchedRequired = [...requiredList];
    let unmatchedPaid = [];

    paidColors.forEach(color => {
      const idx = unmatchedRequired.indexOf(color);
      if (idx !== -1) {
        unmatchedRequired.splice(idx, 1);
      } else {
        unmatchedPaid.push(color);
      }
    });

    if (unmatchedPaid.length > 0) {
      return { valid: false, reason: '選擇的船員顏色不符合目的地要求！' };
    }

    const neededTokens = unmatchedRequired.length;
    return { 
      valid: tokensUsed >= neededTokens, 
      maxCards: requiredList.length,
      neededTokens: neededTokens
    };
  }

  return { valid: false, reason: '未知的費用類型' };
}

function getCostDesc(dest) {
  const cost = getExploreCost(dest);
  if (cost.type === 'same_color') {
    return `任意同色 ${cost.count}張`;
  }
  if (cost.type === 'different') {
    return `不同顏色 ${cost.count}張`;
  }
  if (cost.type === 'specified') {
    const counts = {};
    cost.list.forEach(c => counts[c] = (counts[c]||0) + 1);
    return Object.entries(counts).map(([color, amt]) => `${COLOR_ZH[color] || color}色 ${amt}張`).join(' ＋ ');
  }
  return '依卡牌左側需求';
}

function updateExploreSummary() {
  const dest = findDest(exploreCtx.destId);
  if(!dest) {
    document.getElementById('sel-dest-name').textContent = '—';
    document.getElementById('sel-crew-count').textContent = '0';
    const costTotalEl = document.getElementById('sel-cost-total');
    if(costTotalEl) costTotalEl.textContent = '—';
    document.getElementById('sel-token-count').textContent = '0';
    document.getElementById('explore-use-token-btn').disabled = true;
    document.getElementById('confirm-explore-btn').disabled = true;
    return;
  }

  const check = checkExplorePayment(dest, exploreCtx.paidCards, exploreCtx.tokensUsed);
  document.getElementById('sel-dest-name').textContent = `${dest.name}（需 ${getCostDesc(dest)}）`;
  document.getElementById('sel-crew-count').textContent = exploreCtx.paidCards.length;
  document.getElementById('sel-token-count').textContent = exploreCtx.tokensUsed;

  const tokenBtn = document.getElementById('explore-use-token-btn');
  const confirmBtn = document.getElementById('confirm-explore-btn');
  const p = G.players.human;

  const maxCards = check.maxCards || 4;
  const costTotalEl = document.getElementById('sel-cost-total');
  if(costTotalEl) costTotalEl.textContent = maxCards;
  const total = exploreCtx.paidCards.length + exploreCtx.tokensUsed;
  
  tokenBtn.disabled = total >= maxCards || p.tokens.recruit_token <= exploreCtx.tokensUsed;
  confirmBtn.disabled = !check.valid;
}

function confirmExplore() {
  const p = G.players.human;
  const destId = exploreCtx.destId;
  if(!destId){ showToast('請先選擇目的地','bad'); return; }
  const dest = findDest(destId);
  if(!dest){ showToast('找不到目的地！','bad'); return; }

  const check = checkExplorePayment(dest, exploreCtx.paidCards, exploreCtx.tokensUsed);
  if(!check.valid) {
    showToast('費用不符合要求！', 'bad');
    return;
  }
  if(exploreCtx.paidCards.some(pc => pc.source !== 'crew')) {
    showToast('探索費用需從船員區域支付，不能使用手牌。', 'bad');
    return;
  }
  const hadTradePost = p.destinations.some(d=>d.type==='trade_post');

  // Find and remove dest from market/reserved
  let fromType = null;
  if(exploreCtx.destIsReserved) {
    const ri = p.reserved.findIndex(d=>d.id===destId);
    if(ri!==-1){ p.reserved.splice(ri,1); fromType='reserved'; }
  } else {
    let si = G.zones.settleMarket.findIndex(d=>d.id===destId);
    if(si!==-1){ G.zones.settleMarket.splice(si,1); fromType='settle'; }
    else { let ti=G.zones.tradeMarket.findIndex(d=>d.id===destId); if(ti!==-1){ G.zones.tradeMarket.splice(ti,1); fromType='trade'; } }
  }

  // Pay crew cards from the crew area, sorted desc by idx to avoid index shift.
  const paidSorted = [...exploreCtx.paidCards].sort((a,b)=>{
    if(a.source==='crew' && b.source==='crew') return b.crewIdx - a.crewIdx;
    return 0;
  });
  paidSorted.forEach(pc=>{
    const idx = p.crew[pc.color].findIndex(c=>c.id===pc.card.id);
    if(idx!==-1){ G.zones.crewDiscard.push(p.crew[pc.color].splice(idx,1)[0]); }
  });

  // Pay tokens
  p.tokens.recruit_token -= exploreCtx.tokensUsed;
  p.destinations.push(dest);

  addLog(`${p.name} 探索取得 ${dest.name}！`, 'good');

  // Rewards
  if(dest.rewards) dest.rewards.forEach(r=>applyRes('human',r.icon,r.amount,dest.name));
  if(fromType==='settle') refillDest('settle',3);
  else if(fromType==='trade') refillDest('trade',3);
  const triggerMeadCup = hasRelic('knarr_relic_mead_cup') && G.zones.crewMarket.some(s=>s.card);
  const triggerIronHelmet = hasRelic('knarr_relic_iron_helmet') && dest.type === 'settlement' && hadTradePost;

  G.mainActionDone = true;
  uiMode = 'idle';
  clearExploreCtx(); clearHighlights();
  closeExploreInline();
  document.getElementById('action-zone-label').textContent = '可執行行動';
  document.getElementById('hand-hint').textContent = '— 點牌查看';

  updateUI(); updateActionBtns();
  showToast(`探索成功！${dest.points>0?'+'+dest.points+'分':''}取得獎勵`, 'gold');
  if(triggerIronHelmet) setTimeout(()=>showIronHelmetChoice(dest), 250);
  else if(triggerMeadCup) setTimeout(()=>showMeadCupChoice(), 250);
}

function showRelicActionModal(title, desc, confirmText, onConfirm, cancelText='略過') {
  const relic = G?.activeRelic;
  const modal = document.getElementById('modal-card-info');
  modal.classList.remove('dest-modal');
  modal.classList.add('relic-modal');

  const img = document.getElementById('modal-card-img');
  if(relic?.img) {
    img.src = GAME_DATA.BASE + relic.img;
    img.alt = relic.name;
    img.style.display = 'block';
    img.onerror = () => { img.style.display = 'none'; };
  } else {
    img.style.display = 'none';
  }

  document.getElementById('modal-card-name').textContent = title;
  const body = document.getElementById('modal-card-body');
  body.innerHTML = `<p>${desc}</p>`;

  const actions = document.createElement('div');
  actions.className = 'modal-action-row';

  const confirm = document.createElement('button');
  confirm.className = 'btn-primary';
  confirm.textContent = confirmText;
  confirm.onclick = () => {
    closeModal('modal-card-info');
    if(onConfirm) onConfirm();
  };
  actions.appendChild(confirm);

  const cancel = document.createElement('button');
  cancel.className = 'btn-ghost';
  cancel.textContent = cancelText;
  cancel.onclick = () => {
    closeModal('modal-card-info');
    addLog(`${title}：略過`, '');
  };
  actions.appendChild(cancel);

  body.appendChild(actions);
  showModal('modal-card-info');
}

function startRelicExplore(source) {
  uiMode = 'explore-dest';
  clearExploreCtx();
  closeTradeInline();
  closeRecruitInline();
  closeRecruitTokenInline();
  document.getElementById('action-zone-label').textContent = `${source}：立即探索，先選擇目的地`;
  showElem('explore-inline');
  updateExploreSummary();
  addHighlightToDests();
  updateActionBtns();
}

function startRelicRecruit(source) {
  const p = G.players.human;
  if(p.hand.length === 0) {
    addLog(`${source}：手牌為空，無法立即招募`, 'bad');
    showToast('手牌為空，無法立即招募', 'bad');
    return;
  }
  uiMode = 'recruit';
  closeTradeInline();
  closeExploreInline();
  closeRecruitTokenInline();
  document.getElementById('action-zone-label').textContent = `${source}：立即招募，點選手牌中的船員`;
  showElem('recruit-inline');
  addHighlightToHand('recruit');
  document.getElementById('hand-hint').textContent = '— 聖物立即招募';
  updateActionBtns();
}

function showIronHelmetChoice(dest) {
  noteRelicTrigger(`鐵戰盔：探索 ${dest.name} 後可立即招募`);
  addLog('鐵戰盔觸發！可立即執行一次招募', 'important');
  showRelicActionModal(
    '鐵戰盔觸發',
    `你已取得定居點「${dest.name}」，且已有貿易點可形成相鄰放置。可以立即執行一次招募。`,
    '立即招募',
    () => startRelicRecruit('鐵戰盔')
  );
}

// Gold Bracelet
function triggerGoldBracelet() {
  const p = G.players.human;
  if(p.reserved.length>=2){ addLog('金臂鐲：預留上限2張，略過',''); return; }
  noteRelicTrigger('金臂鐲：可預留 1 張目的地');
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
  const isSett = dest.type === 'settlement' || dest.id.includes('settlement');
  d.className = `dest-owned-card reserve-choice-card ${isSett?'settlement-owned':'trade-post-owned'}`;
  d.style.cursor = 'pointer';
  d.title = `${dest.name}\n探索費：${getCostDesc(dest)}\n點擊預留`;
  const img = document.createElement('img');
  img.src = GAME_DATA.BASE + dest.img;
  img.alt = dest.name;
  img.onerror = ()=>{ img.style.display='none'; };
  const rewards = (dest.rewards||[]).map(r=>
    `<span class="reserve-chip" title="${ICONS[r.icon]?.label||r.icon}"><span style="color:${ICONS[r.icon]?.col||'#f0e8d0'}">${ICONS[r.icon]?.sym||'?'}</span>×${r.amount}</span>`
  ).join('');
  const tradeRow = (dest.trade_cols||[null,null,null]).map((t,i)=>
    `<span class="reserve-trade-cell" title="${['左','中','右'][i]}欄：${t?ICONS[t]?.label:'無'}">${t?ICONS[t]?.sym:'—'}</span>`
  ).join('');
  const body = document.createElement('div');
  body.className = 'dcard-body';
  body.innerHTML = `
    <div class="dcard-name">${dest.name}</div>
    <div class="reserve-meta-row">
      ${dest.points>0?`<span class="dcard-pts">${dest.points}</span><span class="reserve-small-label">分</span>`:'<span class="reserve-small-label">見獎勵</span>'}
      <span class="reserve-cost">費用：${getCostDesc(dest)}</span>
    </div>
    <div class="reserve-rewards">${rewards||'右上角獎勵：無'}</div>
    <div class="reserve-trade-row">${tradeRow}</div>
    <button type="button" class="reserve-pick-btn">預留此目的地</button>
  `;
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

function showMeadCupChoice() {
  const container = document.getElementById('mead-cup-market-list');
  if(!container) return;
  noteRelicTrigger('蜜酒杯：可替換 1 張公開船員');
  container.innerHTML = '';
  G.zones.crewMarket.forEach((slot, idx) => {
    if(!slot.card) return;
    const d = document.createElement('div');
    d.className = `recruit-pick-card c${slot.card.color}`;
    d.title = `${slot.card.name}\n棄置後從牌庫補 1 張公開船員`;
    const img = document.createElement('img');
    img.src = GAME_DATA.BASE + slot.card.img;
    img.alt = slot.card.name;
    img.onerror = () => { img.style.display='none'; d.style.background=COLOR_BG[slot.card.color]; };
    const badge = document.createElement('div');
    badge.className = 'rpcard-cost';
    badge.textContent = '替換';
    d.appendChild(img); d.appendChild(badge);
    d.onclick = () => useMeadCup(idx);
    container.appendChild(d);
  });
  showModal('modal-mead-cup');
}

function useMeadCup(slotIdx) {
  const slot = G.zones.crewMarket[slotIdx];
  if(!slot || !slot.card) { showToast('該格位無公開船員','bad'); return; }
  const old = slot.card;
  G.zones.crewDiscard.push(old);
  slot.card = null;
  if(G.zones.crewDeck.length===0) reshuffleCrew();
  if(G.zones.crewDeck.length>0) slot.card = G.zones.crewDeck.pop();
  noteRelicTrigger(`蜜酒杯：替換 ${old.name}`);
  addLog(`蜜酒杯：棄置 ${old.name}${slot.card?`，補上 ${slot.card.name}`:''}`, 'good');
  closeModal('modal-mead-cup');
  updateUI(); updateActionBtns();
}

function skipMeadCup() {
  closeModal('modal-mead-cup');
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
        const c = drawToCrewArea(pid);
        if(c) addLog(`  ${p.name} 牌庫頂抽取並放置 ${c.name} 到${COLOR_ZH[c.color]}色船員區（資源圖標效果，不是公開市場拿牌；不取得該牌資源，來源：${src}）`, '');
        if(c) checkAmulet(pid, '護身符');
        if(c && !(pid === 'human' && uiMode === 'recruit')) checkWindsock(pid);
      }
      break;
  }
}

// ─── Market Management ────────────────────────────────────────────────
function refillCrew() {
  // Fill any empty slot from the deck
  G.zones.crewMarket.forEach(slot => {
    if(!slot.card) {
      if(G.zones.crewDeck.length===0 && G.zones.crewDiscard.length>0) reshuffleCrew();
      if(G.zones.crewDeck.length>0) slot.card = G.zones.crewDeck.pop();
    }
  });
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
  if(G.zones.crewDeck.length>0) {
    const card = G.zones.crewDeck.pop();
    G.players[pid].hand.push(card);
    return card;
  }
  return null;
}
function drawToCrewArea(pid) {
  if(G.zones.crewDeck.length===0) reshuffleCrew();
  if(G.zones.crewDeck.length>0) {
    const card = G.zones.crewDeck.pop();
    G.players[pid].crew[card.color].push(card);
    return card;
  }
  return null;
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

function aiCanPayDest(p, dest) {
  const cost = getExploreCost(dest);
  const availableCrews = [];
  COLORS.forEach(col => {
    p.crew[col].forEach((card, idx) => {
      availableCrews.push({ source: 'crew', color: col, card, crewIdx: idx });
    });
  });

  const availableTokens = p.tokens.recruit_token;

  if (cost.type === 'same_color') {
    const count = cost.count;
    for (const color of COLORS) {
      const matchingCrews = availableCrews.filter(c => c.color === color);
      if (matchingCrews.length + availableTokens >= count) {
        const cardsToPay = matchingCrews.slice(0, Math.min(count, matchingCrews.length));
        const tokensToPay = count - cardsToPay.length;
        return { possible: true, cards: cardsToPay, tokens: tokensToPay };
      }
    }
  } else if (cost.type === 'different') {
    const count = cost.count;
    const uniqueColorGroups = {};
    availableCrews.forEach(c => {
      if (!uniqueColorGroups[c.color]) {
        uniqueColorGroups[c.color] = c;
      }
    });
    const uniqueCrews = Object.values(uniqueColorGroups);
    if (uniqueCrews.length + availableTokens >= count) {
      const cardsToPay = uniqueCrews.slice(0, Math.min(count, uniqueCrews.length));
      const tokensToPay = count - cardsToPay.length;
      return { possible: true, cards: cardsToPay, tokens: tokensToPay };
    }
  } else if (cost.type === 'specified') {
    const reqList = [...cost.list];
    const chosenCards = [];
    let unmatchedReq = [...reqList];

    unmatchedReq = unmatchedReq.filter(reqColor => {
      const idx = availableCrews.findIndex(c => c.color === reqColor && !chosenCards.includes(c));
      if (idx !== -1) {
        chosenCards.push(availableCrews[idx]);
        return false;
      }
      return true;
    });

    if (availableTokens >= unmatchedReq.length) {
      return { possible: true, cards: chosenCards, tokens: unmatchedReq.length };
    }
  }

  return { possible: false };
}

function aiExplore() {
  const p = G.players.computer;
  const allDests = [...G.zones.settleMarket,...G.zones.tradeMarket,...p.reserved];
  if(!allDests.length) return false;

  const scSorted = [...allDests].sort((a,b) => (b.points||0) - (a.points||0));

  for(const dest of scSorted) {
    const payResult = aiCanPayDest(p, dest);
    if(payResult.possible) {
      const invalidPayment = payResult.cards.some(pc =>
        pc.source !== 'crew' || !p.crew[pc.color]?.some(c => c.id === pc.card.id)
      );
      if(invalidPayment) {
        addLog(`電腦探索 ${dest.name} 的付款來源不合法，已略過`, 'bad');
        continue;
      }

      const paidSorted = [...payResult.cards].sort((a,b)=>{
        if(a.source==='crew' && b.source==='crew') return b.crewIdx - a.crewIdx;
        return 0;
      });

      paidSorted.forEach(pc => {
        const idx = p.crew[pc.color].findIndex(c=>c.id===pc.card.id);
        if(idx!==-1) G.zones.crewDiscard.push(p.crew[pc.color].splice(idx,1)[0]);
      });

      p.tokens.recruit_token -= payResult.tokens;
      const hadTradePost = p.destinations.some(d=>d.type==='trade_post');
      p.destinations.push(dest);

      let ft=null;
      let si=G.zones.settleMarket.findIndex(d=>d.id===dest.id);
      if(si!==-1){G.zones.settleMarket.splice(si,1);ft='settle';}
      else{let ti=G.zones.tradeMarket.findIndex(d=>d.id===dest.id);if(ti!==-1){G.zones.tradeMarket.splice(ti,1);ft='trade';}
      else{let ri=p.reserved.findIndex(d=>d.id===dest.id);if(ri!==-1)p.reserved.splice(ri,1);}}

      addLog(`電腦 探索取得 ${dest.name}（花費船員卡 ${payResult.cards.length}張 ＋ 招募標記 ${payResult.tokens}枚）`, 'good');
      if(dest.rewards) dest.rewards.forEach(r=>applyRes('computer',r.icon,r.amount,dest.name));
      if(ft==='settle') refillDest('settle',3); else if(ft==='trade') refillDest('trade',3);
      if(hasRelic('knarr_relic_iron_helmet') && dest.type === 'settlement' && hadTradePost) {
        noteRelicTrigger(`鐵戰盔：電腦探索 ${dest.name} 後立即招募`);
        addLog('電腦 鐵戰盔：立即執行一次招募', 'important');
        aiRecruit();
      } else if(hasRelic('knarr_relic_mead_cup')) {
        aiUseMeadCup();
      }

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
  if(hasRelic('knarr_relic_cauldron') && newCnt===2) {
    noteRelicTrigger('大煮釜：電腦免費任選公開船員');
    aiTakeRecruitMarketCard(col, true);
  } else {
    aiTakeRecruitMarketCard(col, false);
  }

  if(hasRelic('knarr_relic_silver_coin') && newCnt>=4) {
    noteRelicTrigger('銀錢幣：電腦獲得 1 點勝利分數');
    applyRes('computer','victory_point',1,'銀錢幣');
  }
  checkAmulet('computer', '護身符');
  checkWindsock('computer');
  if(hasRelic('knarr_relic_gold_bracelet') && newCnt===3) aiCheckGoldBracelet(col);
}

function aiMarketCardScore(slot) {
  if(!slot?.card) return -999;
  const card = slot.card;
  let score = 0;
  if(card.resource === 'victory_point') score += 5;
  if(card.resource === 'reputation') score += 3;
  if(card.resource === 'draw_crew_card') score += 2;
  if(card.resource === 'silver_bracelet') score += 2;
  if(card.resource === 'recruit_token') score += 1;
  score += G.players.computer.crew[card.color].length;
  return score;
}

function aiTakeRecruitMarketCard(color, freeAny) {
  const p = G.players.computer;
  let candidates = freeAny
    ? G.zones.crewMarket.filter(s=>s.card)
    : G.zones.crewMarket.filter(s=>s.slot===color && s.card);
  let useToken = false;

  if(!candidates.length && !freeAny && p.tokens.recruit_token > 0) {
    candidates = G.zones.crewMarket.filter(s=>s.card);
    useToken = true;
  }
  if(!candidates.length) {
    addLog(`  電腦沒有可拿取的公開市場船員`, '');
    return false;
  }

  const picked = candidates.reduce((best, slot)=>aiMarketCardScore(slot)>aiMarketCardScore(best)?slot:best, candidates[0]);
  if(useToken) p.tokens.recruit_token--;
  const card = picked.card;
  picked.card = null;
  p.hand.push(card);
  refillCrew();
  addLog(useToken
    ? `  電腦花費⚡標記，從公開市場選取 ${card.name} 到手牌`
    : freeAny
      ? `  電腦大煮釜：從公開市場任選 ${card.name} 到手牌`
      : `  電腦從公開市場${COLOR_ZH[picked.slot]}色格位取得 ${card.name} 到手牌`
  , '');
  return true;
}

function aiUseMeadCup() {
  const slots = G.zones.crewMarket.filter(s=>s.card);
  if(!slots.length) return false;
  const picked = slots.reduce((worst, slot)=>aiMarketCardScore(slot)<aiMarketCardScore(worst)?slot:worst, slots[0]);
  const old = picked.card;
  G.zones.crewDiscard.push(old);
  picked.card = null;
  if(G.zones.crewDeck.length===0) reshuffleCrew();
  if(G.zones.crewDeck.length>0) picked.card = G.zones.crewDeck.pop();
  noteRelicTrigger(`蜜酒杯：電腦替換 ${old.name}`);
  addLog(`電腦 蜜酒杯：棄置 ${old.name}${picked.card?`，補上 ${picked.card.name}`:''}`, 'important');
  return true;
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
  noteRelicTrigger(`金臂鐲：電腦預留 ${best.name}`);
  addLog(`電腦 金臂鐲：預留 ${best.name}`, '');
}

// ─── UI RENDERING ─────────────────────────────────────────────────────
function renderActiveRelic() {
  const el = document.getElementById('active-relic-display');
  if(!el) return;
  const relic = G?.activeRelic;
  if(!relic) {
    el.classList.add('hidden');
    el.innerHTML = '';
    return;
  }

  el.classList.remove('hidden');
  el.innerHTML = '';
  const img = document.createElement('img');
  img.src = GAME_DATA.BASE + relic.img;
  img.alt = relic.name;
  img.onerror = () => { img.style.display = 'none'; };

  const copy = document.createElement('div');
  copy.className = 'active-relic-copy';
  const name = document.createElement('div');
  name.className = 'active-relic-name';
  name.textContent = `聖物：${relic.name}`;
  const effect = document.createElement('div');
  effect.className = 'active-relic-effect';
  effect.textContent = relic.effect || relic.condition || '';
  const status = document.createElement('div');
  status.className = 'active-relic-status';
  status.textContent = G.relicState?.lastTrigger || `條件：${relic.condition || '依聖物效果'}`;

  copy.appendChild(name);
  copy.appendChild(effect);
  copy.appendChild(status);
  el.appendChild(img);
  el.appendChild(copy);
  el.title = `${relic.name}\n${relic.condition || ''}\n${relic.effect || ''}`;
  el.onclick = () => showRelicInfoModal(relic);
}

function updateUI() {
  if(!G) return;
  try {
    renderPanel('human');
    renderPanel('computer');
    renderCrewMarket();
    renderDestMarket();
    updateDeckBadges();
    updateRoundLabel();
    renderActiveRelic();

    // Active panel
    document.querySelector('.side-panel--human').classList.toggle('my-turn', G.activePlayer==='human');
    document.querySelector('.side-panel--opp').classList.toggle('opp-turn', G.activePlayer==='computer');
    showHide('human-turn-badge', G.activePlayer==='human');
    showHide('opp-turn-badge', G.activePlayer==='computer');
  } catch (err) {
    console.error("UI Render Error:", err);
    addLog(`⚠️ 畫面渲染錯誤: ${err.message}`, 'bad');
  }
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

  // Ship tile (always render first so it's the base layer)
  renderShipTile(pre, p.tileId);

  // Destinations owned — ALL types in ONE single stack on the ship tile area
  const destEl = document.getElementById(`${pre}-destinations`);
  destEl.innerHTML = '';
  if(p.destinations.length > 0) {
    destEl.appendChild(buildAllDestsStack(p.destinations));
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

// Owned destinations are displayed as trade icons stacked on the matching ship columns.
function buildAllDestsStack(dests) {
  const wrapper = document.createElement('div');
  wrapper.className = 'dest-stack-wrapper';
  const colNames = ['左欄','中欄','右欄'];
  [0,1,2].forEach(ci => {
    const col = document.createElement('div');
    col.className = 'dest-overlay-col';
    col.title = `${colNames[ci]}目的地貿易圖示`;
    dests.forEach((dest, di) => {
      const iconId = dest.trade_cols?.[ci];
      if(!iconId) return;
      const icon = ICONS[iconId];
      const isSett = dest.id.includes('settlement');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `dest-overlay-token ${isSett?'settlement-token':'trade-post-token'}`;
      btn.style.zIndex = String(di + 1);
      btn.title = `${dest.name} ${colNames[ci]}：${icon?.label||iconId}`;
      btn.innerHTML = `<span>${icon?.sym||iconId}</span>`;
      btn.onclick = (e)=>{ e.stopPropagation(); showDestInfoModal(dest); };
      col.appendChild(btn);
    });
    wrapper.appendChild(col);
  });
  return wrapper;
}

function renderCrewMarket() {
  const el = document.getElementById('crew-market');
  el.innerHTML = '';
  // Show 5 FIXED color slots (board positions)
  G.zones.crewMarket.forEach(slot => {
    const div = document.createElement('div');
    div.className = `crew-mkt-card crew-slot-${slot.slot}${!slot.card?' empty-slot':''}`;
    div.title = slot.card
      ? `${slot.card.name}\n牌色：${COLOR_ZH[slot.card.color]}色\n格位顏色：${COLOR_ZH[slot.slot]}色`
      : `${COLOR_ZH[slot.slot]}色格位（空）`;

    if(slot.card) {
      if(uiMode === 'recruit-take') {
        const canSelect = slot.slot === recruitTakeCtx.color || recruitTakeCtx.freeAny || recruitTakeCtx.tokenPickActive;
        const useToken = getRecruitPickUseToken(slot);
        if(canSelect) {
          div.classList.add('recruit-choice');
          if(useToken && G.players.human.tokens.recruit_token <= 0) div.classList.add('disabled-choice');
        }
      }
      const img = document.createElement('img');
      img.src = GAME_DATA.BASE + slot.card.img;
      img.alt = slot.card.name;
      img.onerror=()=>{ img.remove(); div.style.background=COLOR_BG[slot.card.color]; div.style.display='flex'; div.style.alignItems='center'; div.style.justifyContent='center'; div.style.fontSize='2rem'; div.textContent=ICONS[slot.card.resource]?.sym||'?'; };
      const res = document.createElement('div');
      res.className = 'cmc-res';
      res.textContent = ICONS[slot.card.resource]?.sym || '?';
      res.style.color = ICONS[slot.card.resource]?.col || '#fff';
      div.appendChild(img); div.appendChild(res);
      if(uiMode === 'recruit-take') {
        const canSelect = slot.slot === recruitTakeCtx.color || recruitTakeCtx.freeAny || recruitTakeCtx.tokenPickActive;
        if(canSelect) {
          const cost = document.createElement('div');
          cost.className = 'cmc-recruit-cost';
          cost.textContent = getRecruitPickUseToken(slot) ? '⚡1' : '免費';
          div.appendChild(cost);
          div.onclick = () => showRecruitMarketConfirm(slot);
        } else {
          div.onclick = () => showCardInfoModal(slot.card);
        }
      } else {
        div.onclick = () => showCardInfoModal(slot.card);
      }
    } else {
      const emptyTxt = document.createElement('div');
      emptyTxt.className = 'cmc-empty';
      emptyTxt.textContent = '\u7a7a';
      div.appendChild(emptyTxt);
    }

    // Fixed slot color badge at BOTTOM (matches game board layout)
    const slotBadge = document.createElement('div');
    slotBadge.className = 'cmc-slot-badge';
    slotBadge.style.background = COLOR_BG[slot.slot];
    slotBadge.style.borderTop = `2px solid ${COLOR_TEXT[slot.slot]}`;
    const dot = document.createElement('span');
    dot.className = 'cmc-color-dot';
    dot.style.background = COLOR_TEXT[slot.slot];
    const lbl = document.createElement('span');
    lbl.textContent = COLOR_ZH[slot.slot];
    lbl.style.color = COLOR_TEXT[slot.slot];
    lbl.style.fontFamily = "'Cinzel',serif";
    lbl.style.fontWeight = '700';
    lbl.style.fontSize = '.75rem';
    lbl.style.letterSpacing = '.06em';
    slotBadge.appendChild(dot); slotBadge.appendChild(lbl);
    div.appendChild(slotBadge);

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
      <div class="dmcard-cost">費用：${getCostDesc(card)}（⚡可代替）</div>
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

  // Render the ship plate background image
  const imgEl = document.getElementById(`${prefix}-ship-img`);
  if(imgEl) {
    imgEl.src = getShipTileImageSrc(tileId);
  }
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
    if(milestones[i]) {
      const score = document.createElement('span');
      score.className = 'rep-score-label';
      score.textContent = `+${milestones[i]}`;
      d.appendChild(score);
    }
    d.title = `格${i}${milestones[i]?`：每回合開始 +${milestones[i]}分`:''} — 當前:${rep}`;
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
  else if(uiMode==='recruit-take') phaseTxt = '招募：拿公開船員';
  else if(uiMode==='trade') phaseTxt = '貿易：選銀臂鐲';
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
  document.getElementById('modal-card-info').classList.remove('dest-modal', 'relic-modal');
  const img = document.getElementById('modal-card-img');
  img.src = GAME_DATA.BASE + card.img;
  img.alt = card.name;
  img.style.display='block';
  img.onerror=()=>{ img.style.display='none'; };
  document.getElementById('modal-card-name').textContent = card.name;
  document.getElementById('modal-card-body').innerHTML = `
    <p>顏色：<span style="color:${COLOR_TEXT[card.color]}">${COLOR_ZH[card.color]}色</span></p>
    <p>資源圖標：<span style="color:${ICONS[card.resource]?.col}">${ICONS[card.resource]?.sym}</span> ${ICONS[card.resource]?.label}</p>
    <p style="margin-top:6px;font-size:.75rem;color:#706045">招募後取得所在縱列所有可見資源，並拿取對應顏色格位的公開船員；也可花費招募標記改選。</p>
  `;
  showModal('modal-card-info');
}

function showDestInfoModal(dest) {
  const modal = document.getElementById('modal-card-info');
  modal.classList.remove('relic-modal');
  modal.classList.add('dest-modal');
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
    <p>探索費用：<strong style="color:#f0cc6e">${getCostDesc(dest)}</strong>（從船員區域支付；⚡招募標記可各代替1張）</p>
    <p style="margin-top:6px">右上角獎勵：${rwd||'無'}</p>
    ${trade?`<p style="margin-top:4px">貿易欄：${trade}</p>`:''}
  `;
  showModal('modal-card-info');
}

function showRelicInfoModal(relic) {
  if(!relic) return;
  const modal = document.getElementById('modal-card-info');
  modal.classList.remove('dest-modal');
  modal.classList.add('relic-modal');

  const detail = RELIC_RULE_DETAILS[relic.id] || {};
  const img = document.getElementById('modal-card-img');
  img.src = GAME_DATA.BASE + relic.img;
  img.alt = relic.name;
  img.style.display = 'block';
  img.onerror = () => { img.style.display = 'none'; };

  document.getElementById('modal-card-name').textContent = `聖物：${relic.name}`;
  document.getElementById('modal-card-body').innerHTML = `
    <div class="relic-detail-list">
      <p><strong>觸發時機：</strong>${detail.timing || '依聖物卡文字檢查。'}</p>
      <p><strong>觸發條件：</strong>${detail.condition || relic.condition || '未記錄。'}</p>
      <p><strong>獲得獎勵：</strong>${detail.effect || relic.effect || '未記錄。'}</p>
      <p><strong>使用方式：</strong>${detail.use || '觸發時依聖物卡效果處理。'}</p>
      <p><strong>規則確認：</strong>${detail.compliance || '已依目前資料文字顯示；尚未標記自動化程度。'}</p>
      ${G?.relicState?.lastTrigger ? `<p><strong>本局最近觸發：</strong>${G.relicState.lastTrigger}</p>` : ''}
    </div>
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
function hasRelic(id) { return G?.activeRelicId === id; }
function noteRelicTrigger(text) {
  if(!G?.activeRelic || !G?.relicState) return;
  G.relicState.lastTrigger = `觸發：${text}`;
  renderActiveRelic();
  const el = document.getElementById('active-relic-display');
  if(el) {
    el.classList.add('relic-pulse');
    setTimeout(()=>el.classList.remove('relic-pulse'), 1400);
  }
}
function completedCrewRows(player) {
  const maxRows = Math.max(...COLORS.map(c=>player.crew[c].length), 0);
  const rows = [];
  for(let i=0; i<maxRows; i++) {
    if(COLORS.every(c=>player.crew[c].length > i)) rows.push(i);
  }
  return rows;
}
function checkAmulet(pid, src) {
  if(!hasRelic('knarr_relic_amulet')) return;
  const p = G.players[pid];
  const rows = completedCrewRows(p);
  const tracked = G.relicState?.amuletRows?.[pid] || [];
  rows.forEach(row => {
    if(tracked.includes(row)) return;
    tracked.push(row);
    applyRes(pid,'silver_bracelet',1,src);
    applyRes(pid,'recruit_token',1,src);
    applyRes(pid,'reputation',1,src);
    noteRelicTrigger('護身符：+1 銀臂鐲、+1 招募標記、+1 聲望');
    addLog(`${p.name} 護身符：完成第 ${row+1} 條 5 色橫排`, 'important');
  });
  G.relicState.amuletRows[pid] = tracked;
}
function checkWindsock(pid) {
  if(!hasRelic('knarr_relic_windsock')) return;
  const p = G.players[pid];
  const rows = completedCrewRows(p);
  const tracked = G.relicState?.windsockRows?.[pid] || [];
  const newRows = rows.filter(row => !tracked.includes(row));
  if(!newRows.length) return;

  newRows.forEach(row => tracked.push(row));
  G.relicState.windsockRows[pid] = tracked;

  if(pid === 'human') {
    noteRelicTrigger('風向標：可立即執行一次探索');
    addLog(`${p.name} 風向標：完成 5 色橫排，可立即探索`, 'important');
    showRelicActionModal(
      '風向標觸發',
      '你完成了 1 條 5 色橫排。可以立即執行一次探索，仍需從船員區域支付目的地探索費用，招募標記可代替船員。',
      '立即探索',
      () => startRelicExplore('風向標')
    );
    return;
  }

  noteRelicTrigger('風向標：電腦立即探索');
  addLog(`${p.name} 風向標：完成 5 色橫排，嘗試立即探索`, 'important');
  if(!aiExplore()) addLog('電腦風向標：目前無法支付探索費，略過', '');
}
function iLabel(id) { return ICONS[id]?.label||id; }
function findDest(id) {
  if(!id) return null;
  return [...G.zones.settleMarket,...G.zones.tradeMarket,...G.players.human.reserved,...G.players.computer.reserved,...G.players.human.destinations,...G.players.computer.destinations].find(d=>d.id===id)||null;
}
function shuffle(arr) { for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];} return arr; }
function clearExploreCtx() { exploreCtx={destId:null,destIsReserved:false,paidCards:[],tokensUsed:0}; }
function closeTradeInline() { hideElem('trade-inline'); }
function closeExploreInline() { hideElem('explore-inline'); }
function closeRecruitInline() { hideElem('recruit-inline'); }
function closeRecruitTokenInline() { hideElem('recruit-token-inline'); }
function setPhase(ph) { G.phase=ph; }
function updateDeckBadges() {
  document.getElementById('crew-deck-count').textContent = G.zones.crewDeck.length;
  document.getElementById('settlement-deck-count').textContent = G.zones.settleDeck.length;
  document.getElementById('trade-post-deck-count').textContent = G.zones.tradeDeck.length;
}
function updateRoundLabel() { document.getElementById('round-label').textContent=`回合 ${G.round}`; }

// ─── Log ──────────────────────────────────────────────────────────────
const LOG_MAX = 100;
let _lastLogMsg = null;
function addLog(msg, type) {
  // 忽略空白或無效訊息
  if (msg === null || msg === undefined) return;
  const s = String(msg).trim();
  if (s === '') return;
  // 忽略連續相同訊息
  if (s === _lastLogMsg) return;
  _lastLogMsg = s;

  const el = document.getElementById('log-entries');
  if (!el) return;

  // 限制最多 LOG_MAX 筆
  while (el.children.length >= LOG_MAX) {
    el.removeChild(el.firstChild);
  }

  const d = document.createElement('div');
  d.className = `log-entry ${type || ''}`.trim();
  d.textContent = s;
  el.appendChild(d);
  el.scrollTop = el.scrollHeight;
}

// ─── UI Utilities ─────────────────────────────────────────────────────
function showScreen(id) { document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active')); document.getElementById(id).classList.add('active'); }
function showModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function showRules() { showModal('modal-rules'); }
function toggleLog() {
  const el = document.getElementById('event-log');
  if(!el) return;
  el.scrollIntoView({block:'nearest'});
  el.classList.add('log-flash');
  setTimeout(()=>el.classList.remove('log-flash'), 1000);
}
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
