// ══════════════════════════════════════════════════════════════════════
// KNARR — Game Data Loader v2
// 從 data/*.json 動態載入真實遊戲資料
// ══════════════════════════════════════════════════════════════════════

const GAME_DATA = {
  BASE: 'card_images/',
  COMPONENT_BASE: 'component_images/',

  // Static data
  SHIP_TILES: [
    { id:'knarr_core_ship_tile_1_side_001', label:'船A-面1', trade_columns:[['victory_point'],[],['silver_bracelet']] },
    { id:'knarr_core_ship_tile_1_side_002', label:'船A-面2', trade_columns:[[],['recruit_token'],[]] },
    { id:'knarr_core_ship_tile_2_side_003', label:'船B-面1', trade_columns:[[],['recruit_token'],[]] },
    { id:'knarr_core_ship_tile_2_side_004', label:'船B-面2', trade_columns:[['victory_point'],[],['silver_bracelet']] },
    { id:'knarr_core_ship_tile_3_side_005', label:'船C-面1', trade_columns:[['victory_point'],[],['silver_bracelet']] },
    { id:'knarr_core_ship_tile_3_side_006', label:'船C-面2', trade_columns:[[],['recruit_token'],[]] },
    { id:'knarr_core_ship_tile_4_side_007', label:'船D-面1', trade_columns:[[],['recruit_token'],[]] },
    { id:'knarr_core_ship_tile_4_side_008', label:'船D-面2', trade_columns:[['victory_point'],[],['silver_bracelet']] },
  ],

  // Loaded from JSON
  CREW_CARDS: [],
  SETTLEMENTS: [],
  TRADE_POSTS: [],
  ARTIFACTS: [],

  _loaded: false,
};

// ── Load all card data from JSON files ──
async function loadGameData() {
  try {
    const [cardsResp, shipResp, artifactResp] = await Promise.all([
      fetch('data/cards.json'),
      fetch('data/ship_tiles.json').catch(()=>null),
      fetch('data/artifacts.json').catch(()=>null),
    ]);

    const cardsJson = await cardsResp.json();
    const cards = cardsJson.cards || [];
    if(artifactResp) {
      try {
        const artifactJson = await artifactResp.json();
        GAME_DATA.ARTIFACTS = (artifactJson.artifacts || []).map((a, idx) => ({
          id: a.id,
          name: a.name_zh || a.id,
          condition: a.condition_zh || '',
          effect: a.effect_zh || '',
          img: `knarr_relic_variant_relic_${String(idx + 1).padStart(3, '0')}.png`,
          confidence: a.confidence || 'unknown',
        }));
      } catch(err) {
        console.warn('[KNARR] Artifact JSON load failed, using static artifacts:', err);
      }
    }
    if(shipResp) {
      try {
        const shipJson = await shipResp.json();
        const sides = shipJson.sides || [];
        if(sides.length) {
          GAME_DATA.SHIP_TILES = sides.map((s, idx) => {
            const tileNo = Math.floor(idx / 2);
            const face = s.face_index_on_physical_tile || (idx % 2) + 1;
            return {
              id: s.id,
              label: `船${String.fromCharCode(65 + tileNo)}-面${face}`,
              trade_columns: s.top_printed_columns || s.trade_columns || [[],[],[]],
            };
          });
        }
      } catch(err) {
        console.warn('[KNARR] Ship tile JSON load failed, using static ship tiles:', err);
      }
    }

    // Crew cards (type=crew, front side only)
    GAME_DATA.CREW_CARDS = cards
      .filter(c => c.type==='crew' && c.side==='front')
      .map(c => ({
        id: c.id,
        color: c.color,
        resource: c.top_resource_icon || c.resource_icons?.[0] || 'reputation',
        img: c.id + '.png',
        name: c.name_zh || c.id,
        usable_in_two_player: c.usable_in_two_player !== false,
        seq: c.sequence || 0,
      }));

    // Destination cards — type='destination', subtype='settlement'|'trade_post'
    const destinations = cards.filter(c => c.type==='destination' && c.side==='front');

    destinations.forEach(d => {
      const isSettle = d.subtype==='settlement' || d.destination_type==='settlement';
      const obj = {
        id: d.id,
        name: d.name_zh || d.id,
        points: d.points || 0,
        img: d.id + '.png',
        rewards: buildRewards(d),
        trade_cols: buildTradeCols(d),
        cost: normalizeCost(d.cost || d.exploration_cost),
        type: isSettle ? 'settlement' : 'trade_post',
      };
      if(isSettle) GAME_DATA.SETTLEMENTS.push(obj);
      else GAME_DATA.TRADE_POSTS.push(obj);
    });

    // Fallback: if no JSON data, use hardcoded
    if(GAME_DATA.CREW_CARDS.length === 0) useHardcodedData();
    if(GAME_DATA.ARTIFACTS.length === 0) useHardcodedArtifacts();

    GAME_DATA._loaded = true;
    console.log(`[KNARR] Loaded: ${GAME_DATA.CREW_CARDS.length} crew, ${GAME_DATA.SETTLEMENTS.length} settlements, ${GAME_DATA.TRADE_POSTS.length} trade posts`);
  } catch(e) {
    console.warn('[KNARR] JSON load failed, using hardcoded data:', e);
    useHardcodedData();
    GAME_DATA._loaded = true;
  }
}

function buildRewards(card) {
  // reward_icons is an array of {icon, amount, name_zh} objects
  const rewards = [];
  if(card.reward_icons && Array.isArray(card.reward_icons)) {
    card.reward_icons.forEach(r => {
      if(typeof r === 'object' && r.icon) {
        // Object format: {icon, amount}
        if(!rewards.find(x=>x.icon===r.icon)) rewards.push({icon:r.icon, amount:r.amount||1});
      } else if(typeof r === 'string') {
        // String format fallback
        if(!rewards.find(x=>x.icon===r)) rewards.push({icon:r, amount:1});
      }
    });
  }
  // Abilities
  if(card.abilities) {
    card.abilities.forEach(ab => {
      if(ab.effect && ab.effect.resource) {
        rewards.push({icon:ab.effect.resource, amount:ab.effect.amount||1});
      }
    });
  }
  if(Array.isArray(card.reward_icons)) return rewards;
  return rewards.length ? rewards : [{icon:'victory_point', amount:card.points||0}];
}

function buildTradeCols(card) {
  // trade_cols: [left, center, right] — each is a resource id or null
  if(card.trade_column_icons) return card.trade_column_icons;
  if(card.bottom_trade_row) return card.bottom_trade_row;
  // Default by type
  return [null, null, null];
}

function normalizeCost(cost) {
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

function useHardcodedArtifacts() {
  GAME_DATA.ARTIFACTS = [
    {id:'knarr_relic_windsock',name:'風向標',condition:'完成 5 色橫排',effect:'立即執行一次探索，仍需支付探索費用。',img:'knarr_relic_variant_relic_001.png',confidence:'high'},
    {id:'knarr_relic_gold_bracelet',name:'金臂鐲',condition:'招募行動放入的同色船員剛好是第 3 張',effect:'可預留 1 張目的地卡，並立即補同類型目的地市場；每位玩家最多同時預留 2 張。',img:'knarr_relic_variant_relic_002.png',confidence:'high'},
    {id:'knarr_relic_cauldron',name:'大煮釜',condition:'招募行動放入的同色船員剛好是第 2 張',effect:'本次拿取公開船員時可從 5 張任選。',img:'knarr_relic_variant_relic_003.png',confidence:'high'},
    {id:'knarr_relic_iron_helmet',name:'鐵戰盔',condition:'探索取得定居點卡，並將其放在貿易點卡上方且相鄰',effect:'立即執行一次招募。',img:'knarr_relic_variant_relic_004.png',confidence:'high'},
    {id:'knarr_relic_mead_cup',name:'蜜酒杯',condition:'執行探索行動',effect:'可棄置 1 張版圖下方公開船員卡，並用船員牌庫頂牌替換。',img:'knarr_relic_variant_relic_005.png',confidence:'high'},
    {id:'knarr_relic_silver_coin',name:'銀錢幣',condition:'招募行動放入的同色船員是第 4 張或更多',effect:'獲得 1 點勝利分數。',img:'knarr_relic_variant_relic_006.png',confidence:'medium'},
    {id:'knarr_relic_amulet',name:'護身符',condition:'透過招募或探索完成一條由 5 種不同顏色船員構成的橫排',effect:'獲得 1 枚銀臂鐲、1 枚招募標記與 1 點聲望值。',img:'knarr_relic_variant_relic_007.png',confidence:'high'},
  ];
}

// ── Hardcoded fallback data ──
function useHardcodedData() {
  useHardcodedArtifacts();
  // Crew Cards — representative set for 2-player
  GAME_DATA.CREW_CARDS = [
    // Blue
    {id:'knarr_core_crew_001',color:'blue',resource:'reputation',img:'knarr_core_crew_001.png',name:'藍色維京船員 01',seq:1},
    {id:'knarr_core_crew_002',color:'blue',resource:'reputation',img:'knarr_core_crew_002.png',name:'藍色維京船員 02',seq:2},
    {id:'knarr_core_crew_003',color:'blue',resource:'reputation',img:'knarr_core_crew_003.png',name:'藍色維京船員 03',seq:3},
    {id:'knarr_core_crew_004',color:'blue',resource:'silver_bracelet',img:'knarr_core_crew_004.png',name:'藍色維京船員 04',seq:4},
    {id:'knarr_core_crew_005',color:'blue',resource:'silver_bracelet',img:'knarr_core_crew_005.png',name:'藍色維京船員 05',seq:5},
    {id:'knarr_core_crew_006',color:'blue',resource:'recruit_token',img:'knarr_core_crew_006.png',name:'藍色維京船員 06',seq:6},
    {id:'knarr_core_crew_007',color:'blue',resource:'victory_point',img:'knarr_core_crew_007.png',name:'藍色維京船員 07',seq:7},
    {id:'knarr_core_crew_008',color:'blue',resource:'victory_point',img:'knarr_core_crew_008.png',name:'藍色維京船員 08',seq:8},
    {id:'knarr_core_crew_009',color:'blue',resource:'draw_crew_card',img:'knarr_core_crew_009.png',name:'藍色維京船員 09',seq:9},
    {id:'knarr_core_crew_010',color:'blue',resource:'draw_crew_card',img:'knarr_core_crew_010.png',name:'藍色維京船員 10',seq:10},
    // Yellow
    {id:'knarr_core_crew_011',color:'yellow',resource:'reputation',img:'knarr_core_crew_011.png',name:'黃色維京船員 11',seq:11},
    {id:'knarr_core_crew_012',color:'yellow',resource:'reputation',img:'knarr_core_crew_012.png',name:'黃色維京船員 12',seq:12},
    {id:'knarr_core_crew_013',color:'yellow',resource:'silver_bracelet',img:'knarr_core_crew_013.png',name:'黃色維京船員 13',seq:13},
    {id:'knarr_core_crew_014',color:'yellow',resource:'silver_bracelet',img:'knarr_core_crew_014.png',name:'黃色維京船員 14',seq:14},
    {id:'knarr_core_crew_015',color:'yellow',resource:'recruit_token',img:'knarr_core_crew_015.png',name:'黃色維京船員 15',seq:15},
    {id:'knarr_core_crew_016',color:'yellow',resource:'victory_point',img:'knarr_core_crew_016.png',name:'黃色維京船員 16',seq:16},
    {id:'knarr_core_crew_017',color:'yellow',resource:'victory_point',img:'knarr_core_crew_017.png',name:'黃色維京船員 17',seq:17},
    {id:'knarr_core_crew_018',color:'yellow',resource:'victory_point',img:'knarr_core_crew_018.png',name:'黃色維京船員 18',seq:18},
    {id:'knarr_core_crew_019',color:'yellow',resource:'draw_crew_card',img:'knarr_core_crew_019.png',name:'黃色維京船員 19',seq:19},
    {id:'knarr_core_crew_020',color:'yellow',resource:'draw_crew_card',img:'knarr_core_crew_020.png',name:'黃色維京船員 20',seq:20},
    // Green
    {id:'knarr_core_crew_021',color:'green',resource:'reputation',img:'knarr_core_crew_021.png',name:'綠色維京船員 21',seq:21},
    {id:'knarr_core_crew_022',color:'green',resource:'silver_bracelet',img:'knarr_core_crew_022.png',name:'綠色維京船員 22',seq:22},
    {id:'knarr_core_crew_023',color:'green',resource:'silver_bracelet',img:'knarr_core_crew_023.png',name:'綠色維京船員 23',seq:23},
    {id:'knarr_core_crew_024',color:'green',resource:'recruit_token',img:'knarr_core_crew_024.png',name:'綠色維京船員 24',seq:24},
    {id:'knarr_core_crew_025',color:'green',resource:'recruit_token',img:'knarr_core_crew_025.png',name:'綠色維京船員 25',seq:25},
    {id:'knarr_core_crew_026',color:'green',resource:'victory_point',img:'knarr_core_crew_026.png',name:'綠色維京船員 26',seq:26},
    {id:'knarr_core_crew_027',color:'green',resource:'victory_point',img:'knarr_core_crew_027.png',name:'綠色維京船員 27',seq:27},
    {id:'knarr_core_crew_028',color:'green',resource:'draw_crew_card',img:'knarr_core_crew_028.png',name:'綠色維京船員 28',seq:28},
    // Red
    {id:'knarr_core_crew_031',color:'red',resource:'reputation',img:'knarr_core_crew_031.png',name:'紅色維京船員 31',seq:31},
    {id:'knarr_core_crew_032',color:'red',resource:'silver_bracelet',img:'knarr_core_crew_032.png',name:'紅色維京船員 32',seq:32},
    {id:'knarr_core_crew_033',color:'red',resource:'silver_bracelet',img:'knarr_core_crew_033.png',name:'紅色維京船員 33',seq:33},
    {id:'knarr_core_crew_034',color:'red',resource:'recruit_token',img:'knarr_core_crew_034.png',name:'紅色維京船員 34',seq:34},
    {id:'knarr_core_crew_035',color:'red',resource:'recruit_token',img:'knarr_core_crew_035.png',name:'紅色維京船員 35',seq:35},
    {id:'knarr_core_crew_036',color:'red',resource:'victory_point',img:'knarr_core_crew_036.png',name:'紅色維京船員 36',seq:36},
    {id:'knarr_core_crew_037',color:'red',resource:'victory_point',img:'knarr_core_crew_037.png',name:'紅色維京船員 37',seq:37},
    {id:'knarr_core_crew_038',color:'red',resource:'draw_crew_card',img:'knarr_core_crew_038.png',name:'紅色維京船員 38',seq:38},
    // Purple
    {id:'knarr_core_crew_041',color:'purple',resource:'reputation',img:'knarr_core_crew_041.png',name:'紫色維京船員 41',seq:41},
    {id:'knarr_core_crew_042',color:'purple',resource:'silver_bracelet',img:'knarr_core_crew_042.png',name:'紫色維京船員 42',seq:42},
    {id:'knarr_core_crew_043',color:'purple',resource:'silver_bracelet',img:'knarr_core_crew_043.png',name:'紫色維京船員 43',seq:43},
    {id:'knarr_core_crew_044',color:'purple',resource:'recruit_token',img:'knarr_core_crew_044.png',name:'紫色維京船員 44',seq:44},
    {id:'knarr_core_crew_045',color:'purple',resource:'recruit_token',img:'knarr_core_crew_045.png',name:'紫色維京船員 45',seq:45},
    {id:'knarr_core_crew_046',color:'purple',resource:'victory_point',img:'knarr_core_crew_046.png',name:'紫色維京船員 46',seq:46},
    {id:'knarr_core_crew_047',color:'purple',resource:'victory_point',img:'knarr_core_crew_047.png',name:'紫色維京船員 47',seq:47},
    {id:'knarr_core_crew_048',color:'purple',resource:'draw_crew_card',img:'knarr_core_crew_048.png',name:'紫色維京船員 48',seq:48},
  ];

  // Settlements
  GAME_DATA.SETTLEMENTS = [
    {id:'knarr_core_settlement_001',name:'定居點 01',points:8,img:'knarr_core_settlement_001.png',rewards:[{icon:'victory_point',amount:8},{icon:'draw_crew_card',amount:1}],trade_cols:[null,null,'victory_point'],cost:{type:'specified',list:['purple','purple','purple','red','red']}},
    {id:'knarr_core_settlement_002',name:'定居點 02',points:6,img:'knarr_core_settlement_002.png',rewards:[{icon:'victory_point',amount:6}],trade_cols:[null,'victory_point',null],cost:{type:'specified',list:['purple','purple','yellow','yellow']}},
    {id:'knarr_core_settlement_003',name:'定居點 03',points:7,img:'knarr_core_settlement_003.png',rewards:[{icon:'victory_point',amount:7},{icon:'reputation',amount:2}],trade_cols:[null,null,'victory_point'],cost:{type:'specified',list:['blue','blue','blue','purple','purple']}},
    {id:'knarr_core_settlement_004',name:'定居點 04',points:6,img:'knarr_core_settlement_004.png',rewards:[{icon:'victory_point',amount:6}],trade_cols:[null,'victory_point',null],cost:{type:'specified',list:['blue','blue','red','red']}},
    {id:'knarr_core_settlement_005',name:'定居點 05',points:5,img:'knarr_core_settlement_005.png',rewards:[{icon:'victory_point',amount:5},{icon:'recruit_token',amount:1}],trade_cols:[null,null,'victory_point'],cost:{type:'same_color',count:4}},
    {id:'knarr_core_settlement_006',name:'定居點 06',points:5,img:'knarr_core_settlement_006.png',rewards:[{icon:'victory_point',amount:5},{icon:'reputation',amount:1}],trade_cols:[null,null,'victory_point'],cost:{type:'same_color',count:4}},
    {id:'knarr_core_settlement_007',name:'定居點 07',points:9,img:'knarr_core_settlement_007.png',rewards:[{icon:'victory_point',amount:9}],trade_cols:[null,null,'victory_point'],cost:{type:'specified',list:['yellow','yellow','yellow','green','green']}},
    {id:'knarr_core_settlement_008',name:'定居點 08',points:6,img:'knarr_core_settlement_008.png',rewards:[{icon:'victory_point',amount:6}],trade_cols:[null,'victory_point',null],cost:{type:'specified',list:['yellow','yellow','blue','blue']}},
    {id:'knarr_core_settlement_009',name:'定居點 09',points:4,img:'knarr_core_settlement_009.png',rewards:[{icon:'victory_point',amount:4},{icon:'silver_bracelet',amount:1},{icon:'recruit_token',amount:1},{icon:'reputation',amount:1},{icon:'draw_crew_card',amount:1}],trade_cols:[null,null,'victory_point'],cost:{type:'specified',list:['red','yellow','green','blue','purple']}},
    {id:'knarr_core_settlement_010',name:'定居點 10',points:6,img:'knarr_core_settlement_010.png',rewards:[{icon:'victory_point',amount:6}],trade_cols:[null,'victory_point',null],cost:{type:'specified',list:['green','green','purple','purple']}},
    {id:'knarr_core_settlement_011',name:'定居點 11',points:5,img:'knarr_core_settlement_011.png',rewards:[{icon:'victory_point',amount:5},{icon:'silver_bracelet',amount:1}],trade_cols:[null,null,'victory_point'],cost:{type:'same_color',count:4}},
    {id:'knarr_core_settlement_012',name:'定居點 12',points:6,img:'knarr_core_settlement_012.png',rewards:[{icon:'victory_point',amount:6}],trade_cols:[null,'victory_point',null],cost:{type:'specified',list:['red','red','green','green']}},
    {id:'knarr_core_settlement_013',name:'定居點 13',points:4,img:'knarr_core_settlement_013.png',rewards:[{icon:'victory_point',amount:4},{icon:'silver_bracelet',amount:1},{icon:'recruit_token',amount:1},{icon:'reputation',amount:1},{icon:'draw_crew_card',amount:1}],trade_cols:[null,null,'victory_point'],cost:{type:'specified',list:['red','yellow','green','blue','purple']}},
    {id:'knarr_core_settlement_014',name:'定居點 14',points:8,img:'knarr_core_settlement_014.png',rewards:[{icon:'victory_point',amount:8},{icon:'recruit_token',amount:1}],trade_cols:[null,null,'victory_point'],cost:{type:'specified',list:['green','green','green','blue','blue']}},
    {id:'knarr_core_settlement_015',name:'定居點 15',points:7,img:'knarr_core_settlement_015.png',rewards:[{icon:'victory_point',amount:7},{icon:'silver_bracelet',amount:1}],trade_cols:[null,null,'victory_point'],cost:{type:'specified',list:['red','red','red','yellow','yellow']}},
  ];

  // Trade Posts
  GAME_DATA.TRADE_POSTS = [
    {id:'knarr_core_trade_post_001',name:'貿易點 01',points:0,img:'knarr_core_trade_post_001.png',rewards:[{icon:'draw_crew_card',amount:1}],trade_cols:['victory_point','draw_crew_card',null],cost:{type:'specified',list:['purple','purple']}},
    {id:'knarr_core_trade_post_002',name:'貿易點 02',points:0,img:'knarr_core_trade_post_002.png',rewards:[{icon:'silver_bracelet',amount:1},{icon:'recruit_token',amount:1}],trade_cols:['victory_point',null,'recruit_token'],cost:{type:'specified',list:['green','green']}},
    {id:'knarr_core_trade_post_003',name:'貿易點 03',points:0,img:'knarr_core_trade_post_003.png',rewards:[{icon:'silver_bracelet',amount:1},{icon:'reputation',amount:1}],trade_cols:[null,'reputation','victory_point'],cost:{type:'specified',list:['blue','blue']}},
    {id:'knarr_core_trade_post_004',name:'貿易點 04',points:0,img:'knarr_core_trade_post_004.png',rewards:[{icon:'recruit_token',amount:1},{icon:'reputation',amount:1}],trade_cols:['reputation',null,'victory_point'],cost:{type:'specified',list:['blue','blue']}},
    {id:'knarr_core_trade_post_005',name:'貿易點 05',points:0,img:'knarr_core_trade_post_005.png',rewards:[{icon:'silver_bracelet',amount:1},{icon:'draw_crew_card',amount:1}],trade_cols:['victory_point',null,'victory_point'],cost:{type:'specified',list:['red','red']}},
    {id:'knarr_core_trade_post_006',name:'貿易點 06',points:0,img:'knarr_core_trade_post_006.png',rewards:[{icon:'recruit_token',amount:1}],trade_cols:['victory_point','victory_point',null],cost:{type:'specified',list:['yellow','yellow']}},
    {id:'knarr_core_trade_post_007',name:'貿易點 07',points:0,img:'knarr_core_trade_post_007.png',rewards:[],trade_cols:['victory_point','victory_point','victory_point'],cost:{type:'specified',list:['yellow','yellow']}},
    {id:'knarr_core_trade_post_008',name:'貿易點 08',points:0,img:'knarr_core_trade_post_008.png',rewards:[{icon:'recruit_token',amount:2}],trade_cols:[null,'recruit_token',null],cost:{type:'specified',list:['green','green']}},
    {id:'knarr_core_trade_post_009',name:'貿易點 09',points:0,img:'knarr_core_trade_post_009.png',rewards:[{icon:'recruit_token',amount:1}],trade_cols:['recruit_token','victory_point',null],cost:{type:'specified',list:['green','green']}},
    {id:'knarr_core_trade_post_010',name:'貿易點 10',points:0,img:'knarr_core_trade_post_010.png',rewards:[{icon:'silver_bracelet',amount:1},{icon:'reputation',amount:1},{icon:'draw_crew_card',amount:1}],trade_cols:[null,'victory_point',null],cost:{type:'different',count:3}},
    {id:'knarr_core_trade_post_011',name:'貿易點 11',points:0,img:'knarr_core_trade_post_011.png',rewards:[{icon:'silver_bracelet',amount:1},{icon:'reputation',amount:1}],trade_cols:['victory_point',null,'victory_point'],cost:{type:'specified',list:['red','red']}},
    {id:'knarr_core_trade_post_012',name:'貿易點 12',points:0,img:'knarr_core_trade_post_012.png',rewards:[{icon:'silver_bracelet',amount:1}],trade_cols:['victory_point','victory_point',null],cost:{type:'specified',list:['red','red']}},
    {id:'knarr_core_trade_post_013',name:'貿易點 13',points:0,img:'knarr_core_trade_post_013.png',rewards:[{icon:'recruit_token',amount:1},{icon:'reputation',amount:1},{icon:'draw_crew_card',amount:1}],trade_cols:[null,'victory_point',null],cost:{type:'different',count:3}},
    {id:'knarr_core_trade_post_014',name:'貿易點 14',points:0,img:'knarr_core_trade_post_014.png',rewards:[{icon:'reputation',amount:2}],trade_cols:[null,'victory_point','reputation'],cost:{type:'specified',list:['blue','blue']}},
    {id:'knarr_core_trade_post_015',name:'貿易點 15',points:0,img:'knarr_core_trade_post_015.png',rewards:[{icon:'reputation',amount:1}],trade_cols:['victory_point','victory_point',null],cost:{type:'specified',list:['yellow','yellow']}},
    {id:'knarr_core_trade_post_016',name:'貿易點 16',points:0,img:'knarr_core_trade_post_016.png',rewards:[{icon:'silver_bracelet',amount:1}],trade_cols:['victory_point','reputation','recruit_token'],cost:{type:'different',count:3}},
    {id:'knarr_core_trade_post_017',name:'貿易點 17',points:0,img:'knarr_core_trade_post_017.png',rewards:[{icon:'silver_bracelet',amount:1}],trade_cols:['victory_point','reputation','recruit_token'],cost:{type:'different',count:3}},
    {id:'knarr_core_trade_post_018',name:'貿易點 18',points:0,img:'knarr_core_trade_post_018.png',rewards:[{icon:'silver_bracelet',amount:1},{icon:'recruit_token',amount:1},{icon:'draw_crew_card',amount:1}],trade_cols:[null,'victory_point',null],cost:{type:'different',count:3}},
    {id:'knarr_core_trade_post_019',name:'貿易點 19',points:0,img:'knarr_core_trade_post_019.png',rewards:[{icon:'draw_crew_card',amount:1}],trade_cols:['draw_crew_card',null,'victory_point'],cost:{type:'specified',list:['purple','purple']}},
    {id:'knarr_core_trade_post_020',name:'貿易點 20',points:0,img:'knarr_core_trade_post_020.png',rewards:[{icon:'silver_bracelet',amount:1},{icon:'draw_crew_card',amount:1}],trade_cols:[null,'victory_point','draw_crew_card'],cost:{type:'specified',list:['purple','purple']}},
  ];
}
