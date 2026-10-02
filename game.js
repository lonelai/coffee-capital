/**
 * game.js - 核心游戏主引擎、经济模型、滴滤生产线、银行系统与连锁重置
 */

class CoffeeCapitalGame {
  constructor() {
    // 基础资金与资产 (初始 11.2 RMB)
    this.r = 11.2;
    this.fp = 0;              // 加盟声誉点 (Franchise Points)
    this.ce = 0;              // 资本股权 (Capital Equity %)
    this.coffeeStock = 0;     // 已萃取咖啡库存
    this.totalCoffeeSold = 0;
    this.runCoffeeSold = 0;           // 本轮轮回已售出咖啡数 (每次重置清零，用于确保本轮首杯成本严格锁定 ¥1.20)
    this.totalRevenueEarned = 0.0;
    // 游戏版本号：基线 a0.0.1 (每次 Bug 修复 0.0.x +1；每次新增主线内容 0.x.0 +1)
    this.version = 'a0.8.0';
    this.theme = 'cyber';             // 视觉界面主题 ('cyber' 深空磨砂 / 'miuix' 小米澎湃)

    // Toast 消息堆叠与打断控制器
    this.activeToasts = [];           // 当前显示中的普通 Toast 记录项
    this._lastToastBatchTime = 0;     // 最近一次触发 Toast 的时间戳 (用于判断是否同时触发)

    // 每日签到系统 (累计获取 1 EP 解锁)
    this.dailyUnlocked = false;       // 每日签到功能是否已解锁
    this.dp = 0;                      // 每日点数 (Daily Points)
    this.totalDpClaimed = 0;          // 累计领取的每日点数
    this.lastDailyClaimTime = 0;      // 上次领取签到的时间戳 (ms)
    this.dpInvestments = {            // DP 投入升级记录
      price: 0,                       // 滴滤咖啡售价加成等级 (每次 +1.5x 单杯售价，不复利)
      ep: 0                           // EP 获取加成等级 (每次 +1.5x EP获取，不复利)
    };
    this.currentTreeSubview = 'workshop'; // 当前选中的科技树子界面 ('workshop' | 'prestige' | 'daily' | 'untitled')

    // 无标题升级树 & α (阿尔法) / β (贝塔) 增量体系
    this.alpha = 0;                     // 当前持有的 α 点数
    this.totalAlphaEarned = 0;          // 累计获得的 α 点数
    this.untitledUpgrades = {           // 已购买的无标题升级 (15个节点: '11' ~ '71')
      '11': false, '21': false, '31': false, '32': false, '33': false,
      '41': false, '42': false, '43': false, '44': false,
      '51': false, '52': false, '53': false,
      '61': false, '62': false, '71': false
    };
    this.alphaTickTimer = 0.0;          // α 单点递增步进计时器 (秒)
    this.alphaIdleTimer = 0.0;          // #51 虚时间态静置计时器 (秒)
    this.alphaOverloadTimer = 0.0;      // #53 临界超载剩余持续时长 (秒)
    this.beta = 0;                      // 第二层货币 β (贝塔) 点数
    this.totalBetaEarned = 0;           // 累计获得的 β 点数
    this.betaUnlocked = false;          // 是否已开启维度坍缩第2层级

    // 无标题升级树大视口 (Pan & Zoom Viewport) 交互状态
    this.untitledViewport = {
      panX: 0,
      panY: 0,
      scale: 1.0,
      minScale: 0.45,
      maxScale: 2.2,
      canvasWidth: 2600,
      canvasHeight: 2600,
      isDragging: false,
      startX: 0,
      startY: 0,
      initialPanX: 0,
      initialPanY: 0,
      hasMoved: false,
      isPinching: false,
      initialPinchDist: 0,
      initialPinchScale: 1.0,
      pinchMidX: 0,
      pinchMidY: 0,
      initialized: false
    };

    // 生产核心参数
    this.brewSpeed = 3.0;             // 基础萃取耗时 (秒)
    this.baseBeanCost = 1.2;          // 基础单杯成本 (¥1.20)
    this.beanCostMultiplier = 1.0;
    this.baseCoffeePrice = 3.0;       // 基础单杯售价 (¥3.00)
    this.salesMultiplier = 1.0;       // 销售倍数 (售价 = 基础单价 * 倍数)
    this.trafficBaseRate = 0.5;       // 客流基础概率 (50% / 0.5x)
    this.salesBaseFrequency = 1.0;    // 基础计数频率 (1杯/秒)
    this.frequencyUpgradeLevel = 0;   // 计数频率升级次数 x
    this.autoDripUnlocked = false;    // 神也怕累 (自动滴滤是否已研发)
    this.autoDripEnabled = true;      // 自动滴滤当前开关状态 (自动/手动切换)
    this.brewYieldMultiplier = 1;

    // 滴滤器设备列表 (硬上限 10 台)
    this.dripFilters = [];

    // 已购升级与成就
    this.upgradesPurchased = {};
    this.achievementsUnlocked = {};

    // 摆摊经验 (第二级重置 EP)
    this.ep = 0.0;                    // 当前可用摆摊经验点数 (EP)
    this.totalEpEarned = 0.0;         // 累计获得的总经验点数
    this.epResetsCount = 0;           // 摆摊重置总次数
    this.epUpgrades = {
      notes: false,                   // 记下笔记 (1 EP): 不再重置滴滤小摊的一切
      autoDrip: false,                // 自动滴滤 (1 EP): 循环自动萃取，可自由切手动，重置后永久生效
      freshGround: false,             // 新鲜现磨不隔夜 (2 EP): 每个升级计数频率提升至 1.50x
      agitator: false                 // 煽动家 (3 EP): 为客流提供 x2 倍数
    };
    this.epPricingLevel = 0;          // 定价是我说了算的 (首次升级 1 EP，后续每次翻倍: 2 EP, 4 EP, 8 EP...): 售价 x2 可指数复利叠加

    // 运行态计算器与平滑速率监测 (性能优化版)
    this.salesTimer = 0.0;
    this.lastTimestamp = performance.now();
    this.currentDisplayRate = 0.0;
    this.frameEarningAccumulator = 0.0;
    this.rateSampleTimer = 0.0;
    this.hudUpdateTimer = 0.0;
    this.achievementCheckTimer = 0.0;
    this.domCache = {};

    // 成就系统表（保留指定的 10 项核心成就，并新增丰富可玩的扩展成就，共 50 项）
    this.ACHIEVEMENTS = [
      // ===== 初始 10 项指定成就 (保持原有标题与描述不变) =====
      { id: 'first_filter', title: '来吧走起！', desc: '购买你的第 1 台手冲滴滤器 来开始游戏', icon: '☕', check: (g) => (g.dripFilters && g.dripFilters.length >= 1) },
      { id: 'km1_achieve', title: '快 男', desc: '手冲咖啡也可以这么快吗？研发升级【提升速度 Lv.1】，制作耗时缩短至 2 秒', icon: '🏃', check: (g) => (g.upgradesPurchased && (g.upgradesPurchased['km'] >= 1 || !!g.upgradesPurchased['km1'])) },
      { id: 'all_filters', title: '一家人整整齐齐', desc: '购置满编全部 10 台咖啡滴滤器设备', icon: '🏭', check: (g) => (g.dripFilters && g.dripFilters.length >= 10) },
      { id: 'god_achieve', title: '神也怕累', desc: '研发【自动滴滤】，实现滴滤全自动萃取', icon: '🤖', check: (g) => !!(g.autoDripUnlocked || (g.epUpgrades && g.epUpgrades.autoDrip) || (g.upgradesPurchased && g.upgradesPurchased['god'])) },
      { id: 'first_sale', title: '眨眨眼，第一单！', desc: '小摊成功售出第 1 份现磨咖啡，开启商业征程', icon: '☕', check: (g) => (g.totalCoffeeSold || 0) >= 1 },
      { id: 'km2_achieve', title: '索尼克 是你吗', desc: '研发升级【提升速度 Lv.2】，制作耗时提升至 1 秒', icon: '⚡', check: (g) => (g.upgradesPurchased && (g.upgradesPurchased['km'] >= 2 || !!g.upgradesPurchased['km2'])) },
      { id: 'wealth_1e4', title: '你挺有钱呗', desc: '现金储备突破 ¥1,000.00', icon: '💰', check: (g) => g.r >= 1000 },
      { id: 'km3_achieve', title: '闹麻了！', desc: '根本就没有这么快的人！你只是怕了!<br>研发极限升级【提升速度 Lv.3】，制作耗时达 0.5 秒', icon: '🌪️', check: (g) => (g.upgradesPurchased && (g.upgradesPurchased['km'] >= 3 || !!g.upgradesPurchased['km3'])) },
      { id: 'first_prestige', title: '资本的力量', desc: '完成首次连锁加盟重置，开启商业网络', icon: '🏬', check: (g) => g.fp >= 1 },
      { id: 'super_sales', title: '幸运顾客这次免单！', desc: '累计售出100 份咖啡', icon: '📦', check: (g) => (g.totalCoffeeSold || 0) >= 100 },

      // ===== 设备、萃取与操作机制 =====
      { id: 'filters_5', title: '半壁江山', desc: '购置至少 5 台咖啡滴滤器设备', icon: '🫖', check: (g) => (g.dripFilters && g.dripFilters.length >= 5) },
      { id: 'full_brew', title: '火力全开', desc: '满编 10 台滴滤器同时处于咖啡萃取制作中', icon: '🔥', check: (g) => (g.dripFilters && g.dripFilters.length >= 10 && g.dripFilters.every(f => f.isBrewing)) },
      { id: 'stock_pile', title: '咖啡满仓', desc: '已萃取现磨咖啡储备库存突破 200 杯', icon: '📦', check: (g) => (g.coffeeStock || 0) >= 200 },
      { id: 'stock_flood', title: '咖啡海洋', desc: '已萃取现磨咖啡储备库存突破 1,000 杯', icon: '🌊', check: (g) => (g.coffeeStock || 0) >= 1000 },
      { id: 'manual_master', title: '返璞归真', desc: '研发【自动滴滤】后，主动切回【手动模式】亲自掌勺', icon: '✋', check: (g) => !!g.autoDripUnlocked && g.autoDripEnabled === false },

      // ===== 选址运营升级 =====
      { id: 'loc_lv1', title: '占个好摊位', desc: '首次研发升级【优化选址 Lv.1】，摆摊客流提升 10%', icon: '📍', check: (g) => (g.getLocationUpgradeLevel ? g.getLocationUpgradeLevel() >= 1 : false) },
      { id: 'loc_lv3', title: '排起长队', desc: '研发升级【优化选址 Lv.3】，客流概率提升至 80%', icon: '🎪', check: (g) => (g.getLocationUpgradeLevel ? g.getLocationUpgradeLevel() >= 3 : false) },
      { id: 'loc_lv5', title: '商业街霸主', desc: '研发升级【优化选址 Lv.5】，客流突破 100% 开启双杯连售', icon: '🏙️', check: (g) => (g.getLocationUpgradeLevel ? g.getLocationUpgradeLevel() >= 5 : false) },
      { id: 'loc_lv10', title: '城市地标', desc: '研发升级【优化选址 Lv.10】，客流概率达到 150%', icon: '🌟', check: (g) => (g.getLocationUpgradeLevel ? g.getLocationUpgradeLevel() >= 10 : false) },
      { id: 'loc_lv15', title: '黄金口岸', desc: '研发升级【优化选址 Lv.15】，客流概率达到 200%', icon: '🥇', check: (g) => (g.getLocationUpgradeLevel ? g.getLocationUpgradeLevel() >= 15 : false) },

      // ===== 计数频率与售货节奏 =====
      { id: 'freq_lv1', title: '跟上节拍', desc: '首次升级计数频率至 Lv.1，售货节奏提升至 1.20x', icon: '⏱️', check: (g) => (g.frequencyUpgradeLevel || 0) >= 1 },
      { id: 'freq_lv3', title: '手脚麻利', desc: '计数频率升级至 Lv.3，售货节奏提升至 1.73x', icon: '🚀', check: (g) => (g.frequencyUpgradeLevel || 0) >= 3 },
      { id: 'freq_lv5', title: '机关枪出单', desc: '计数频率升级至 Lv.5，售货节奏突破 2.48x', icon: '🏎️', check: (g) => (g.frequencyUpgradeLevel || 0) >= 5 },
      { id: 'freq_lv10', title: '光速运转', desc: '计数频率升级至 Lv.10，售货节奏突破 6.19x', icon: '💨', check: (g) => (g.frequencyUpgradeLevel || 0) >= 10 },
      { id: 'freq_sonic', title: '流水线风暴', desc: '实际客流出货销售频率突破 4.00 份/秒', icon: '⚡', check: (g) => (g.getSalesFrequency ? g.getSalesFrequency() >= 4.0 : false) },

      // ===== 现金储备里程碑 =====
      { id: 'wealth_5k', title: '小有积蓄', desc: '现金储备突破 ¥5,000.00，达到连锁加盟标准', icon: '💵', check: (g) => g.r >= 5000 },
      { id: 'wealth_10k', title: '万元大户', desc: '现金储备突破 ¥10,000.00，解锁超大额度信贷', icon: '💎', check: (g) => g.r >= 10000 },
      { id: 'wealth_50k', title: '财力雄厚', desc: '现金储备突破 ¥50,000.00', icon: '👑', check: (g) => g.r >= 50000 },
      { id: 'wealth_100k', title: '六位数大佬', desc: '现金储备突破 ¥100,000.00', icon: '🏛️', check: (g) => g.r >= 100000 },
      { id: 'wealth_million', title: '百万富翁', desc: '现金储备突破 ¥1,000,000.00', icon: '💰', check: (g) => g.r >= 1000000 },

      // ===== 资金净流速里程碑 =====
      { id: 'rate_10', title: '日进斗金', desc: '实时资金净流速突破 +10.0/秒', icon: '📊', check: (g) => (g.currentDisplayRate || 0) >= 10.0 },
      { id: 'rate_50', title: '印钞机器', desc: '实时资金净流速突破 +50.0/秒', icon: '💸', check: (g) => (g.currentDisplayRate || 0) >= 50.0 },
      { id: 'rate_100', title: '资本洪流', desc: '实时资金净流速突破 +100.0/秒', icon: '🌊', check: (g) => (g.currentDisplayRate || 0) >= 100.0 },

      // ===== 累计销量里程碑 =====
      { id: 'sales_500', title: '街坊知晓', desc: '小摊累计售出超过 500 份高品质咖啡', icon: '🎯', check: (g) => (g.totalCoffeeSold || 0) >= 500 },
      { id: 'sales_1000', title: '千杯传奇', desc: '小摊累计售出超过 1,000 份咖啡', icon: '🎖️', check: (g) => (g.totalCoffeeSold || 0) >= 1000 },
      { id: 'sales_5000', title: '万人空巷', desc: '小摊累计售出超过 5,000 份咖啡', icon: '🏆', check: (g) => (g.totalCoffeeSold || 0) >= 5000 },
      { id: 'sales_20000', title: '咖啡界巨擘', desc: '小摊累计售出超过 20,000 份咖啡', icon: '👑', check: (g) => (g.totalCoffeeSold || 0) >= 20000 },

      // ===== 营业额里程碑 =====
      { id: 'rev_10k', title: '第一桶金', desc: '累计总营业额突破 ¥10,000.00', icon: '💼', check: (g) => (g.totalRevenueEarned || 0) >= 10000 },
      { id: 'rev_100k', title: '财源滚滚', desc: '累计总营业额突破 ¥100,000.00', icon: '💰', check: (g) => (g.totalRevenueEarned || 0) >= 100000 },
      { id: 'rev_1m', title: '商业帝国', desc: '累计总营业额突破 ¥1,000,000.00', icon: '🏦', check: (g) => (g.totalRevenueEarned || 0) >= 1000000 },

      // ===== 运营精进与资本积累 =====
      { id: 'coffee_artisan', title: '匠人精神', desc: '小摊累计售出超过 300 份咖啡', icon: '☕', check: (g) => (g.totalCoffeeSold || 0) >= 300 },
      { id: 'speedy_brew', title: '极速出单', desc: '实际客流出货销售频率突破 2.00 份/秒', icon: '⏱️', check: (g) => (g.getSalesFrequency ? g.getSalesFrequency() >= 2.0 : false) },
      { id: 'steady_business', title: '稳扎稳打', desc: '不骄不躁，现金储备突破 ¥2,000.00', icon: '🛡️', check: (g) => g.r >= 2000 },
      { id: 'self_made', title: '白手起家', desc: '独立自主，现金储备突破 ¥10,000.00', icon: '🕊️', check: (g) => g.r >= 10000 },

      { id: 'all_round_boss', title: '咖啡大亨', desc: '同时达成满编 10 设备、全自动萃取且现金超过 ¥20,000', icon: '👑', check: (g) => (g.dripFilters && g.dripFilters.length >= 10 && !!(g.autoDripUnlocked || (g.epUpgrades && g.epUpgrades.autoDrip) || (g.upgradesPurchased && g.upgradesPurchased['god'])) && g.r >= 20000) }
    ];
  }

  // 初始化高频 DOM 元素缓存池，彻底避免循环中重复调用 getElementById
  initDomCache() {
    this.domCache = {};
    const ids = [
      'rmb-display', 'net-rate-val', 'rate-sign', 'rate-pill-badge',
      'fp-display', 'ce-display',
      'coffee-stock-display', 'batch-brew-btn', 'batch-brew-text', 'batch-brew-icon',
      'auto-drip-toggle-btn', 'drip-slots-container', 'achievements-grid',
      'achieve-progress-fill', 'achieve-percent-text', 'badge-achieve-count',
      'achieve-mult-display', 'ep-current-display',
      'ep-total-display', 'ep-reset-count', 'prestige-ep-gain', 'prestige-next-ep-hint',
      'prestige-ep-progress-fill', 'btn-execute-stall-prestige', 'notes-status-badge',
      'btn-tree-prestige', 'tree-badge-prestige', 'badge-prestige-ready',
      'btn-tree-daily', 'tree-badge-daily', 'daily-dp-balance', 'btn-daily-claim',
      'btn-tree-untitled', 'tree-arch-prestige-untitled-connector', 'subview-untitled',
      'brew-cost-display', 'unit-cost-display', 'profit-per-cup',
      'buy-filter-btn', 'filter-capacity-tag', 'badge-filter-count', 'tree-badge-filter'
    ];
    for (let i = 0; i < ids.length; i++) {
      const el = document.getElementById(ids[i]);
      if (el) this.domCache[ids[i]] = el;
    }
  }

  // 快捷安全的 DOM 元素获取器
  getEl(id) {
    if (!this.domCache) this.domCache = {};
    if (!this.domCache[id]) {
      const el = document.getElementById(id);
      if (el) this.domCache[id] = el;
    }
    return this.domCache[id];
  }

  // DOM 脏检查文本写入：值未变动时直接跳过，零重排零重绘
  setDomText(id, text) {
    const el = this.getEl(id);
    if (el && el.textContent !== text) {
      el.textContent = text;
    }
  }

  // DOM 脏检查类名写入
  setDomClass(id, cls) {
    const el = this.getEl(id);
    if (el && el.className !== cls) {
      el.className = cls;
    }
  }

  // 初始化游戏
  init() {
    window.GameInstance = this;

    // 0. 移动端与 UA 识别引擎初始化
    if (window.DeviceDetector) {
      window.DeviceDetector.applyDeviceClasses();
      window.DeviceDetector.updateSettingsUI();
    }

    // 0.1 恢复并应用视觉主题风格 (深空磨砂 / 小米澎湃 Miuix)
    const savedTheme = localStorage.getItem('coffee_capital_theme') || this.theme || 'cyber';
    this.setTheme(savedTheme, false);

    // 1. 预先构建 DOM 元素池
    this.initDomCache();

    // 同步顶栏版本号显示
    const verBadge = document.getElementById('game-version-badge');
    if (verBadge) verBadge.textContent = this.version;

    // 2. 尝试从本地存储载入存档
    const loaded = window.SaveSystem.loadFromLocalStorage(this);
    if (!loaded) {
      // 初始新游戏状态，初始资金为 11.2 RMB (起初用于购买 1 台滴滤器 ¥10 与 制作首杯咖啡 ¥1.2)
      this.r = 11.2;
    }

    // 3. 初始化科技树渲染
    if (window.TreeSystem) {
      window.TreeSystem.initTree(this);
    }

    // 4. 渲染滴滤器设备卡槽与成就网格
    this.renderDripSlots();
    this.renderAchievementsGrid();

    // 5. 绑定 DOM 交互事件
    this.bindEvents();

    // 6. 启动定时自动保存 (默认 10 秒，支持 5s/10s/20s/30s 动态调整)
    window.SaveSystem.startAutoSave(this);

    // 7. 启动主循环 (物理 + 节流渲染)
    requestAnimationFrame((ts) => this.gameLoop(ts));

    // 8. 初次刷新 UI
    this.updateUI();
  }

  // 切换并持久化视觉主题风格 ('cyber' 深空磨砂玻璃 / 'miuix' 小米澎湃 Miuix)
  setTheme(themeName, showToast = true) {
    const validThemes = ['cyber', 'miuix'];
    const target = validThemes.includes(themeName) ? themeName : 'cyber';
    this.theme = target;

    // 更新 DOM body class
    if (target === 'miuix') {
      document.body.classList.add('theme-miuix');
      document.body.classList.remove('theme-cyber');
    } else {
      document.body.classList.remove('theme-miuix');
      document.body.classList.add('theme-cyber');
    }

    // 更新设置界面的按钮高亮状态
    const themeBtns = document.querySelectorAll('#theme-btn-group .btn-theme-opt');
    themeBtns.forEach(btn => {
      if (btn.dataset.theme === target) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    const descEl = document.getElementById('theme-status-desc');
    if (descEl) {
      if (target === 'miuix') {
        descEl.textContent = '当前激活：📱 小米澎湃 Miuix 官方风格 (淡蓝强调色、纯黑背景、内嵌分组卡片、原生滑块)';
      } else {
        descEl.textContent = '当前激活：🌌 深空磨砂玻璃风格 (默认工业赛博美学、蓝紫霓虹光晕)';
      }
    }

    try {
      localStorage.setItem('coffee_capital_theme', target);
    } catch (e) {
      console.warn('Failed to save theme to localStorage', e);
    }

    if (showToast) {
      const nameMap = { cyber: '🌌 深空磨砂玻璃', miuix: '📱 小米澎湃 Miuix (淡蓝·官方源)' };
      this.showToast(`🎨 界面风格已切换为：${nameMap[target]}`, 'info');
    }
  }

  // 货币与数值格式化规则：
  // 规则 1: rmb 在 1000 以前显示小数点后两位 (如 10.00, 999.50)
  // 规则 2: 大于等于 1000 时采用国际千分位格式化，超大数值采用科学记数法
  // 规则 3: rmb=r 并在除了 rmb 数量显示处以外显示为 ¥
  formatMoney(num) {
    if (typeof num !== 'number' || isNaN(num)) num = 0;
    if (num < 1000) {
      return num.toFixed(2);
    } else if (num < 1e8) {
      return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else {
      return num.toExponential(2);
    }
  }

  // 获取当前单杯制作成本 (成本随售卖咖啡数量指数增长，且随售价倍数跟涨)
  // 核心规则：
  // 1. 第一次开始萃取的价格永远严格保底为 ¥1.20 (新手起步或重置后首杯 runCoffeeSold < 1)；
  // 2. 售卖咖啡数量越大，单杯制作成本增长得越高，呈指数公式增长: 1.002^(runCoffeeSold - 1)；
  // 3. 随售价倍数平方根平缓跟涨，并设有 90% 实际售价防倒挂保护，确保单杯永远维持正向利润；
  // 4. 破局兜底：若玩家无库存且资金不足以上涨后成本但 >= ¥1.20，保底允许以 ¥1.20 破局。
  getUnitCost() {
    if (this.isInitialPhase() || (this.runCoffeeSold || 0) < 1) {
      return 1.20;
    }
    const epPricingMult = Math.pow(2, this.epPricingLevel || 0);
    const dailyPriceMult = this.getDailyPriceMultiplier();
    const priceScaleMult = Math.max(1.0, this.salesMultiplier * epPricingMult * dailyPriceMult);

    // 售卖咖啡数量指数增长因子：售卖数量越大，原豆与耗材成本呈指数上升 (1.002^N)
    const soldCount = Math.max(0, (this.runCoffeeSold || 0) - 1);
    const soldExpMult = Math.pow(1.002, soldCount);

    let scaledCost = this.baseBeanCost * this.beanCostMultiplier * Math.sqrt(priceScaleMult) * soldExpMult;

    // 利润保护：成本最高不超过当前单杯实际售价的 90%，确保单杯净利润永远为正 (最少保留 10% 利润空间)
    const sellingPrice = this.getSellingPrice();
    const maxAllowedCost = Math.max(1.20, sellingPrice * 0.90);
    if (scaledCost > maxAllowedCost) {
      scaledCost = maxAllowedCost;
    }

    // 破局兜底：若玩家手头无库存、无萃取中设备，且资金不足以上涨后成本但 >= ¥1.20，保底以 ¥1.20 启动
    const isBrewingAny = this.dripFilters && this.dripFilters.some(f => f.isBrewing);
    if ((this.coffeeStock || 0) === 0 && !isBrewingAny && this.r < scaledCost - 0.001 && this.r >= 1.20 - 0.001) {
      return 1.20;
    }

    return Math.round(scaledCost * 100) / 100;
  }

  // 获取成就数量提供的复利加成 (每获得一个成就 1.02x 复利)
  getAchievementMultiplier() {
    const validIds = new Set(this.ACHIEVEMENTS.map(a => a.id));
    const count = Object.keys(this.achievementsUnlocked || {}).filter(id => validIds.has(id)).length;
    return Math.pow(1.02, count);
  }

  // 获取每日签到点数 (DP) 投入带来的单杯售价加成倍数 (不复利，每次投入 +1.5x)
  getDailyPriceMultiplier() {
    const lvl = (this.dpInvestments && this.dpInvestments.price) || 0;
    return 1 + 1.5 * lvl;
  }

  // 获取当前单杯实际销售价格 (销售倍数 * 定价是我说了算的复利倍数 * 基础价格 * 成就复利倍数 * DP售价加成)
  getSellingPrice() {
    const epPricingMult = Math.pow(2, this.epPricingLevel || 0);
    const dailyPriceMult = this.getDailyPriceMultiplier();
    return this.salesMultiplier * epPricingMult * this.baseCoffeePrice * this.getAchievementMultiplier() * dailyPriceMult;
  }

  // 获取计数频率升级价格 (增量游戏平滑指数增长曲线)
  // 基础价格 ¥5.00，后续每级以 1.75 倍增长，既契合增量数值增长又避免 10^x 恶性数值爆炸
  getFrequencyUpgradeCost() {
    const x = this.frequencyUpgradeLevel || 0;
    return Math.round(5 * Math.pow(1.75, x) * 100) / 100;
  }

  // 获取当前实际计数频率 (基础为1每秒，每次升级提供 1.20x，若研发【新鲜现磨不隔夜】则提升为 1.50x 复利)
  getSalesFrequency() {
    const x = this.frequencyUpgradeLevel || 0;
    const baseMult = (this.epUpgrades && this.epUpgrades.freshGround) ? 1.50 : 1.20;
    return this.salesBaseFrequency * Math.pow(baseMult, x);
  }

  // 检查是否处于新手起步阶段 (尚未制作并售出首杯咖啡，起初仅允许购买滴滤器和制作咖啡)
  isInitialPhase() {
    return (this.totalCoffeeSold || 0) < 1;
  }

  // 购买计数频率升级
  buyFrequencyUpgrade() {
    if (this.isInitialPhase()) {
      this.showToast('起初请先购买咖啡滴滤器并制作售出首杯咖啡！', 'warning');
      return;
    }

    const cost = this.getFrequencyUpgradeCost();
    if (this.r < cost) {
      this.showToast(`资金不足：升级计数频率需 ¥${this.formatMoney(cost)}，当前仅有 ¥${this.formatMoney(this.r)}`, 'warning');
      return;
    }

    this.r -= cost;
    this.recordEarning(-cost);
    this.frequencyUpgradeLevel = (this.frequencyUpgradeLevel || 0) + 1;
    this.showToast(`⚡ 计数频率已升级至 Lv.${this.frequencyUpgradeLevel}！(当前: ${this.getSalesFrequency().toFixed(2)} 份/秒)`, 'success');
    this.updateUI();
  }

  // 获取优化选址当前等级
  getLocationUpgradeLevel() {
    return (this.upgradesPurchased && typeof this.upgradesPurchased['location'] === 'number')
      ? this.upgradesPurchased['location']
      : 0;
  }

  // 获取优化选址当前升级价格 (增量游戏平滑指数增长曲线，与 tree.js 保持一致)
  // 基础价格 ¥25.00，后续每级以 1.45 倍增长，使客流加成在中后期依然平滑具有可玩性
  getLocationUpgradeCost() {
    const lvl = this.getLocationUpgradeLevel();
    return Math.round(25 * Math.pow(1.45, lvl));
  }

  // 重新计算客流基础概率 (基于优化选址等级: 基础 50%，每级提升 10%)
  recalcTrafficRate() {
    const locLvl = this.getLocationUpgradeLevel();
    this.trafficBaseRate = 0.5 + 0.10 * locLvl;
  }

  // 获取实际生效的客流概率 (基础客流 * 煽动家 2x 加成)
  getEffectiveTrafficRate() {
    const agitatorMult = (this.epUpgrades && this.epUpgrades.agitator) ? 2.0 : 1.0;
    return this.trafficBaseRate * agitatorMult;
  }

  // 获取每日签到点数 (DP) 投入带来的 EP 获取加成倍数 (不复利，每次投入 +1.5x)
  getDailyEpMultiplier() {
    const lvl = (this.dpInvestments && this.dpInvestments.ep) || 0;
    return 1 + 1.5 * lvl;
  }

  // 计算当前现金对应的基础摆摊经验点数 (EP)
  // 递增梯度序列: 100(1) -> 500(2) -> 1000(3) -> 5000(4) -> 10000(5) -> 50000(6)...
  calculateBaseEpFromMoney(r) {
    if (r < 100) return 0;
    let ep = 0;
    let threshold = 100;
    while (r >= threshold) {
      ep++;
      if (ep % 2 === 1) {
        threshold *= 5; // 100 -> 500, 1000 -> 5000, 10000 -> 50000
      } else {
        threshold *= 2; // 500 -> 1000, 5000 -> 10000, 50000 -> 100000
      }
    }
    return ep;
  }

  // 计算当前现金对应实际可获取的摆摊经验点数 (EP) (包含 DP 加成)
  calculateEpFromMoney(r) {
    const baseEp = this.calculateBaseEpFromMoney(r);
    if (baseEp <= 0) return 0;
    const mult = this.getDailyEpMultiplier();
    return Math.round(baseEp * mult * 10) / 10;
  }

  // 获取达成下一个基础 EP 所需的现金门槛
  getNextEpThreshold(r) {
    const curBaseEp = this.calculateBaseEpFromMoney(r);
    let threshold = 100;
    for (let i = 1; i <= curBaseEp; i++) {
      if (i % 2 === 1) {
        threshold *= 5;
      } else {
        threshold *= 2;
      }
    }
    return threshold;
  }

  // 获取当前基础 EP 对应的起始资金门槛 (用于精确计算当前档位内进度)
  getPrevEpThreshold(r) {
    const curBaseEp = this.calculateBaseEpFromMoney(r);
    if (curBaseEp <= 0) return 0;
    let threshold = 100;
    for (let i = 1; i < curBaseEp; i++) {
      if (i % 2 === 1) {
        threshold *= 5;
      } else {
        threshold *= 2;
      }
    }
    return threshold;
  }

  // 实时推演摆摊经验重置的当前档位进度与智能经营建议
  getPrestigeAdvice(r) {
    const curBaseEp = this.calculateBaseEpFromMoney(r);
    const potentialEp = this.calculateEpFromMoney(r);
    const nextEpThreshold = this.getNextEpThreshold(r);
    const prevEpThreshold = this.getPrevEpThreshold(r);
    const diff = Math.max(0, nextEpThreshold - r);
    const span = Math.max(1, nextEpThreshold - prevEpThreshold);
    const progress = Math.min(100, Math.max(0, ((r - prevEpThreshold) / span) * 100));
    const nextPotentialEp = Math.round((curBaseEp + 1) * this.getDailyEpMultiplier() * 10) / 10;

    let icon = '💡';
    let text = '';
    let isUrgent = false;

    if (potentialEp <= 0) {
      icon = '💡';
      text = `经营建议: 资金未达首次重置门槛，还差 ¥${this.formatMoney(diff)} 达成 +${nextPotentialEp} EP，建议继续经营小摊！`;
    } else if (diff / span < 0.18 || progress >= 82) {
      icon = '⏳';
      isUrgent = true;
      text = `突破在即: 距离达成下一阶经验 (+${nextPotentialEp} EP) 仅差 ¥${this.formatMoney(diff)} (进度 ${progress.toFixed(0)}%)，强烈建议稍等片刻再重置！`;
    } else {
      icon = '✨';
      text = `收益平稳: 当前重置可沉淀 +${potentialEp} EP 经验，建议执行重置升级核心能力！`;
    }

    return { icon, text, isUrgent, potentialEp, nextEpThreshold, prevEpThreshold, diff, span, progress, nextPotentialEp };
  }

  // 获取【定价是我说了算的】当前升级费用
  // 首次升级 1 EP，从第一次升级往后均为翻倍的价格 (即 Lv.0->1: 1 EP, Lv.1->2: 2 EP, Lv.2->3: 4 EP, Lv.3->4: 8 EP, Lv.4->5: 16 EP...)
  getPricingUpgradeCost() {
    const lvl = this.epPricingLevel || 0;
    return Math.pow(2, lvl) * 1.0;
  }

  // 绑定界面交互按钮与导航
  bindEvents() {
    // 标签页切换
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetId = btn.dataset.tab;
        if (!targetId) return;

        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const pane = document.getElementById(targetId);
        if (pane) pane.classList.add('active');

        // 移动端平滑滚动激活标签 (按需最小滚动，杜绝两端裁切)
        if (typeof btn.scrollIntoView === 'function') {
          btn.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
        }

        // 若切换到设置页面，实时刷新设备 UA 识别信息与自动保存设置
        if (targetId === 'tab-settings') {
          if (window.DeviceDetector) window.DeviceDetector.updateSettingsUI();
          if (window.SaveSystem && typeof window.SaveSystem.updateAutoSaveUI === 'function') {
            window.SaveSystem.updateAutoSaveUI(this);
          }
        }

        // 若切换到咖啡工坊与重置主页，且当前在工坊子界面，重绘升级树 SVG 连线
        if (targetId === 'tab-workshop') {
          if (typeof this.drawHierarchyStem === 'function') {
            requestAnimationFrame(() => this.drawHierarchyStem());
            setTimeout(() => this.drawHierarchyStem(), 80);
          }
          if (window.TreeSystem) {
            const subviewWorkshop = document.getElementById('subview-workshop');
            if (!subviewWorkshop || subviewWorkshop.style.display !== 'none') {
              requestAnimationFrame(() => window.TreeSystem.drawConnections(this));
            }
          }
        }
      });
    });

    // 树形架构子界面切换 (滴滤小摊 vs 摆摊经验 vs 每日签到 vs 无标题升级树)
    const btnTreeWorkshop = document.getElementById('btn-tree-workshop');
    const btnTreePrestige = document.getElementById('btn-tree-prestige');
    const btnTreeDaily = document.getElementById('btn-tree-daily');
    const btnTreeUntitled = document.getElementById('btn-tree-untitled');

    if (btnTreeWorkshop) {
      btnTreeWorkshop.addEventListener('click', () => this.switchTreeSubview('workshop'));
    }
    if (btnTreePrestige) {
      btnTreePrestige.addEventListener('click', () => this.switchTreeSubview('prestige'));
    }
    if (btnTreeDaily) {
      btnTreeDaily.addEventListener('click', () => this.switchTreeSubview('daily'));
    }
    if (btnTreeUntitled) {
      btnTreeUntitled.addEventListener('click', () => this.switchTreeSubview('untitled'));
    }

    // 每日签到领取按键
    const btnDailyClaim = document.getElementById('btn-daily-claim');
    if (btnDailyClaim) {
      btnDailyClaim.addEventListener('click', () => this.claimDailyReward());
    }

    // 购买手冲滴滤器按钮
    const buyFilterBtn = document.getElementById('buy-filter-btn');
    if (buyFilterBtn) {
      buyFilterBtn.addEventListener('click', () => this.buyDripFilter());
    }

    // 批量萃取
    const batchBtn = document.getElementById('batch-brew-btn');
    if (batchBtn) {
      batchBtn.addEventListener('click', () => this.batchBrewAll());
    }

    // 自动/手动模式切换按钮 (神也怕累)
    const autoToggleBtn = document.getElementById('auto-drip-toggle-btn');
    if (autoToggleBtn) {
      autoToggleBtn.addEventListener('click', () => this.toggleAutoDrip());
    }

    // 计数频率升级按钮
    const btnUpgradeFreq = document.getElementById('btn-upgrade-freq');
    if (btnUpgradeFreq) btnUpgradeFreq.addEventListener('click', () => this.buyFrequencyUpgrade());

    // 摆摊经验重置与 5 项进阶升级
    const btnStallPrestige = document.getElementById('btn-execute-stall-prestige');
    if (btnStallPrestige) btnStallPrestige.addEventListener('click', () => this.executeStallPrestige());

    const btnBuyNotes = document.getElementById('btn-ep-buy-notes');
    if (btnBuyNotes) btnBuyNotes.addEventListener('click', () => this.buyEpUpgrade('notes'));

    const btnBuyAutoDrip = document.getElementById('btn-ep-buy-autodrip');
    if (btnBuyAutoDrip) btnBuyAutoDrip.addEventListener('click', () => this.buyEpUpgrade('autoDrip'));

    const cardAutoDrip = document.getElementById('ep-card-autodrip');
    if (cardAutoDrip) {
      cardAutoDrip.addEventListener('click', (e) => {
        if (e.target && (e.target.id === 'btn-ep-buy-autodrip' || e.target.closest('#btn-ep-buy-autodrip'))) return;
        if (this.epUpgrades && this.epUpgrades.autoDrip) {
          this.toggleAutoDrip();
        }
      });
    }

    const btnBuyFresh = document.getElementById('btn-ep-buy-fresh');
    if (btnBuyFresh) btnBuyFresh.addEventListener('click', () => this.buyEpUpgrade('freshGround'));

    const btnBuyPricing = document.getElementById('btn-ep-buy-pricing');
    if (btnBuyPricing) btnBuyPricing.addEventListener('click', () => this.buyEpUpgrade('pricing'));

    const btnBuyAgitator = document.getElementById('btn-ep-buy-agitator');
    if (btnBuyAgitator) btnBuyAgitator.addEventListener('click', () => this.buyEpUpgrade('agitator'));

    // 全局快捷键：Ctrl+S 快速存档
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        window.SaveSystem.saveToLocalStorage(this, true);
      }
    });

    document.getElementById('settings-save-btn').addEventListener('click', () => {
      window.SaveSystem.saveToLocalStorage(this, true);
    });

    // 自动保存间隔选择按钮事件绑定 (5s / 10s / 20s / 30s)
    document.querySelectorAll('#autosave-btn-group .btn-interval-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        const sec = parseInt(btn.dataset.interval, 10);
        if (window.SaveSystem && typeof window.SaveSystem.setAutoSaveInterval === 'function') {
          window.SaveSystem.setAutoSaveInterval(this, sec);
          this.showToast(`⏱️ 自动保存间隔已设置为 ${sec} 秒`, 'info');
        }
      });
    });

    // 视觉主题风格切换按钮事件绑定 (深空磨砂 / 澎湃 Miuix)
    document.querySelectorAll('#theme-btn-group .btn-theme-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        const theme = btn.dataset.theme;
        this.setTheme(theme, true);
        if (window.SaveSystem && typeof window.SaveSystem.saveToLocalStorage === 'function') {
          window.SaveSystem.saveToLocalStorage(this, false);
        }
      });
    });

    document.getElementById('settings-export-btn').addEventListener('click', () => {
      this.openSaveModal('export');
    });

    document.getElementById('settings-import-btn').addEventListener('click', () => {
      this.openSaveModal('import');
    });

    document.getElementById('settings-reset-btn').addEventListener('click', () => {
      if (confirm('【高危警告】确定要彻底清除全部游戏存档并重新开始创业吗？所有咖啡与升级进度将永久消失！（您的界面显示风格与自动保存间隔设置将被保留）')) {
        window.SaveSystem.hardReset(this);
      }
    });

    // 开发者测试按钮：增加 1000r
    const add1000rBtn = document.getElementById('settings-add-1000r-btn');
    if (add1000rBtn) {
      add1000rBtn.addEventListener('click', () => {
        this.r += 1000.0;
        this.recordEarning(1000.0);
        this.updateUI();
        if (window.TreeSystem) {
          window.TreeSystem.updateAllNodes(this);
        }
        this.showToast('💰 已成功注入 ¥1,000.00 测试资金！', 'success');
      });
    }

    // 存档弹窗相关
    const saveModalClose = document.getElementById('save-modal-close');
    const saveModalCancel = document.getElementById('save-modal-cancel');
    const saveModal = document.getElementById('save-modal');
    if (saveModalClose) saveModalClose.addEventListener('click', () => saveModal.classList.remove('open'));
    if (saveModalCancel) saveModalCancel.addEventListener('click', () => saveModal.classList.remove('open'));

    // 摆摊经验重置确认弹窗事件绑定
    const prestigeModal = document.getElementById('prestige-confirm-modal');
    const prestigeCancel = document.getElementById('prestige-confirm-cancel');
    const prestigeExecute = document.getElementById('prestige-confirm-execute');
    if (prestigeCancel) prestigeCancel.addEventListener('click', () => prestigeModal.classList.remove('open'));
    if (prestigeExecute) prestigeExecute.addEventListener('click', () => {
      prestigeModal.classList.remove('open');
      this._confirmPrestigeReset();
    });

    // 监听用户活跃交互，重置 #51 虚时间态插值的静置计时器
    const resetIdle = () => {
      this.alphaIdleTimer = 0.0;
    };
    ['pointerdown', 'keydown'].forEach(evt => {
      window.addEventListener(evt, resetIdle, { passive: true });
    });

    // 初始化绘制树形架构连线与窗口自适应监听
    requestAnimationFrame(() => this.drawHierarchyStem());
    setTimeout(() => this.drawHierarchyStem(), 100);
    setTimeout(() => this.drawHierarchyStem(), 300);
    window.addEventListener('resize', () => {
      this.drawHierarchyStem();
      if (this.currentTreeSubview === 'untitled') {
        this.drawUntitledConnections();
      }
    });
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        this.drawHierarchyStem();
        if (this.currentTreeSubview === 'untitled') {
          this.drawUntitledConnections();
        }
      }, 150);
    });

    // 初始化帮助指南面板手风琴卡片交互
    this.initHelpAccordion();
  }

  // 初始化帮助指南面板手风琴可折叠卡片及一键展开/收起
  initHelpAccordion() {
    const list = document.getElementById('help-accordion-list');
    if (!list) return;

    // 单个卡片点击展开/收起切换
    list.querySelectorAll('.help-header').forEach(header => {
      header.addEventListener('click', () => {
        const card = header.closest('.help-card');
        if (card) {
          card.classList.toggle('open');
        }
      });
    });

    // 一键展开全部 / 收起全部按钮
    const toggleAllBtn = document.getElementById('btn-help-toggle-all');
    const toggleAllText = document.getElementById('help-toggle-all-text');
    if (toggleAllBtn) {
      toggleAllBtn.addEventListener('click', () => {
        const cards = list.querySelectorAll('.help-card');
        const anyClosed = Array.from(cards).some(c => !c.classList.contains('open'));
        cards.forEach(c => {
          if (anyClosed) {
            c.classList.add('open');
          } else {
            c.classList.remove('open');
          }
        });
        if (toggleAllText) {
          toggleAllText.textContent = anyClosed ? '收起全部卡片' : '展开全部卡片';
        }
      });
    }
  }

  // 检查是否已激活【记下笔记】特权 (历史累计获得经验达到 3.0 EP 自动解锁，或老存档已激活)
  hasNotes() {
    return ((this.totalEpEarned || 0) >= 3.0 - 0.0001) || !!(this.epUpgrades && this.epUpgrades.notes);
  }

  // 购买手冲滴滤器 (基础 10r, 硬上限 10 台)
  buyDripFilter() {
    if (this.dripFilters.length >= 10) {
      this.showToast('已达到滴滤器购买硬上限 (10/10 台)', 'warning');
      return;
    }

    const cost = 10.0;
    if (this.r < cost - 0.001) {
      this.showToast(`资金不足：购买滴滤器需 ¥${this.formatMoney(cost)}，当前仅有 ¥${this.formatMoney(this.r)}`, 'warning');
      return;
    }

    // 精确保留2位小数，防止 11.2 - 10.0 = 1.1999999999999993 导致无法支付 1.20 成本
    this.r = Math.round(Math.max(0, this.r - cost) * 100) / 100;
    this.recordEarning(-cost);

    const newFilter = {
      id: this.dripFilters.length + 1,
      progress: 0,
      isBrewing: false,
      isAuto: !!(this.autoDripUnlocked && this.autoDripEnabled)
    };
    this.dripFilters.push(newFilter);

    this.showToast(`🎉 成功购买第 ${this.dripFilters.length} 台咖啡滴滤器！`, 'success');
    this.checkAchievements();
    this.renderDripSlots();
    this.updateUI();
    this.updateHUDAndLiveBars();
  }

  // 启动单个滴滤器萃取
  startBrew(filter) {
    if (filter.isBrewing) return;

    const unitCost = this.getUnitCost();
    if (this.r < unitCost - 0.001) {
      this.showToast(`资金不足以支付单杯原豆制作成本 ¥${this.formatMoney(unitCost)}`, 'warning');
      return;
    }

    // 扣除制作成本
    this.r = Math.round(Math.max(0, this.r - unitCost) * 100) / 100;
    this.recordEarning(-unitCost);

    filter.isBrewing = true;
    filter.progress = 0;
    this.updateHUDAndLiveBars();
  }

  // 批量启动所有空闲滴滤器
  batchBrewAll() {
    let startedCount = 0;
    const unitCost = this.getUnitCost();

    for (const filter of this.dripFilters) {
      if (!filter.isBrewing && (this.r >= unitCost - 0.001)) {
        this.r = Math.round(Math.max(0, this.r - unitCost) * 100) / 100;
        this.recordEarning(-unitCost);
        filter.isBrewing = true;
        filter.progress = 0;
        startedCount++;
      }
    }

    if (startedCount > 0) {
      this.showToast(`⚡ 批量启动了 ${startedCount} 台空闲滴滤器进行萃取`, 'info');
      this.updateUI();
      this.updateHUDAndLiveBars();
    } else {
      this.showToast('无空闲滴滤器或资金不足支付成本', 'warning');
    }
  }

  // 快捷购买升级
  buyUpgradeDirect(upgradeId) {
    const node = window.TreeSystem.TREE_NODES.find(n => n.id === upgradeId);
    if (node) {
      window.TreeSystem.onNodeClick(node, this);
    }
  }

  // 精确原地更新所有滴滤器卡槽的自动/手动标签，杜绝销毁重建 DOM 导致的重影与进度条闪烁
  updateSlotModeTags() {
    const isAuto = this.autoDripUnlocked && this.autoDripEnabled;
    const tagText = isAuto ? '全自动' : '手动';
    const tagClass = `slot-mode-tag ${isAuto ? 'auto' : ''}`;

    document.querySelectorAll('.slot-mode-tag').forEach(tag => {
      if (tag.className !== tagClass) tag.className = tagClass;
      if (tag.textContent.trim() !== tagText) tag.textContent = tagText;
    });
  }

  // 专属模式切换通知：接入全局统一 Toast 机制，短间隔覆盖上一条并打断显示时长
  showModeToggleToast(isAuto) {
    const msg = isAuto
      ? '🤖 自动滴滤：已切换为【自动萃取模式】'
      : '✋ 自动滴滤：已切换为【手动萃取模式】（可手动点击开始萃取）';
    this.showToast(msg, isAuto ? 'success' : 'info', 'toast-mode-toggle');
  }

  // 切换自动滴滤 自动/手动 模式 (带节流防抖与无闪烁局部更新)
  toggleAutoDrip() {
    const isUnlocked = this.autoDripUnlocked || (this.epUpgrades && this.epUpgrades.autoDrip) || (this.upgradesPurchased && this.upgradesPurchased['god']);
    if (!isUnlocked) {
      this.showToast('尚未研发【自动滴滤】科技！', 'warning');
      return;
    }
    this.autoDripUnlocked = true;
    if (this.epUpgrades) this.epUpgrades.autoDrip = true;

    // 防抖与连点保护 (120ms 内重复点击忽略，避免手速过快引起的视觉重影)
    const now = performance.now();
    if (this._lastToggleTime && (now - this._lastToggleTime) < 120) {
      return;
    }
    this._lastToggleTime = now;

    this.autoDripEnabled = !this.autoDripEnabled;
    this.dripFilters.forEach(f => f.isAuto = this.autoDripEnabled);

    // 专属防叠加 Toast，杜绝多层重叠与重影
    this.showModeToggleToast(this.autoDripEnabled);

    // 原地更新卡槽状态标签，杜绝重绘卡槽导致的 DOM 闪烁与重影
    this.updateSlotModeTags();

    // 原地精准更新科技树神也怕累卡片状态，避免全量重绘科技树与 SVG 连线
    if (window.TreeSystem && typeof window.TreeSystem.updateGodNodeCard === 'function') {
      window.TreeSystem.updateGodNodeCard(this);
    }
    this.updateEpUpgradesUI();

    this.checkAchievements();
    this.updateHUDAndLiveBars();
  }
  // 执行第二级重置：摆摊经验重置 (Stall Experience Reset) — 弹出游戏内确认弹窗
  executeStallPrestige() {
    if (this.r < 100) {
      this.showToast('资金未达 ¥100.00，尚不能沉淀摆摊经验', 'warning');
      return;
    }

    const earnedEp = this.calculateEpFromMoney(this.r);
    if (earnedEp <= 0) {
      this.showToast('资金不足以产生经验点数', 'warning');
      return;
    }

    // 构建弹窗内容并展示游戏内确认弹窗
    const newTotalEp = Math.round(((this.totalEpEarned || 0) + earnedEp) * 10) / 10;
    const willHaveNotes = (newTotalEp >= 3.0 - 0.0001) || this.hasNotes();
    const modal = document.getElementById('prestige-confirm-modal');
    const body = document.getElementById('prestige-confirm-body');
    if (!modal || !body) return;

    if (willHaveNotes) {
      body.innerHTML = `
        <p style="font-size: 0.95rem; font-weight: 600; color: #f8fafc;">本次重置将为您带来 <span style="color: #fbbf24; font-size: 1.05rem;">+${earnedEp} 点</span>【摆摊经验 (EP)】！</p>
        <div style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 10px; padding: 12px 16px; display: flex; align-items: flex-start; gap: 10px;">
          <span style="font-size: 1.2rem;">🛡️</span>
          <div>
            <p style="font-weight: 600; color: #34d399; margin-bottom: 4px;">受到【记下笔记】累计经验里程碑 (达 3.0 EP) 的全力庇护</p>
            <p style="font-size: 0.82rem; color: #94a3b8;">滴滤小摊的一切设备（${this.dripFilters.length}台）、咖啡库存（${this.coffeeStock}杯）以及科技升级全部完整保留！仅现金重置为 ¥11.20 初始储备。</p>
          </div>
        </div>`;
    } else {
      body.innerHTML = `
        <p style="font-size: 0.95rem; font-weight: 600; color: #f8fafc;">本次重置将为您带来 <span style="color: #fbbf24; font-size: 1.05rem;">+${earnedEp} 点</span>【摆摊经验 (EP)】！</p>
        <div style="background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 10px; padding: 12px 16px; display: flex; align-items: flex-start; gap: 10px;">
          <span style="font-size: 1.2rem;">⚠️</span>
          <div>
            <p style="font-weight: 600; color: #f59e0b; margin-bottom: 4px;">注意：历史累计经验未达 3.0 EP (本次重置后达成 ${newTotalEp.toFixed(1)}/3.0 EP)</p>
            <p style="font-size: 0.82rem; color: #94a3b8;">执行后将清空滴滤小摊的设备（${this.dripFilters.length}台）、咖啡库存（${this.coffeeStock}杯）及基础升级，现金重置为 ¥11.20。</p>
          </div>
        </div>`;
    }

    modal.classList.add('open');
  }

  // 确认执行摆摊经验重置 (由弹窗确认按键触发)
  _confirmPrestigeReset() {
    const earnedEp = this.calculateEpFromMoney(this.r);
    if (earnedEp <= 0) return;

    const newTotalEp = Math.round(((this.totalEpEarned || 0) + earnedEp) * 10) / 10;
    const willHaveNotes = (newTotalEp >= 3.0 - 0.0001) || this.hasNotes();

    // 经验点数入账 (保持1位小数精度)
    this.ep = Math.round(((this.ep || 0) + earnedEp) * 10) / 10;
    this.totalEpEarned = newTotalEp;
    this.epResetsCount = (this.epResetsCount || 0) + 1;
    this.fp = (this.fp || 0) + earnedEp; // 兼容历史成就标记

    // 基础资产重置
    this.r = 11.2;
    this.runCoffeeSold = 0;

    if (!willHaveNotes) {
      // 未研发笔记，重置滴滤小摊的一切
      this.coffeeStock = 0;
      this.dripFilters = [];
      this.frequencyUpgradeLevel = 0;
      this.autoDripUnlocked = !!(this.epUpgrades && this.epUpgrades.autoDrip);
      this.autoDripEnabled = true;

      if (this.upgradesPurchased) {
        delete this.upgradesPurchased['km1'];
        delete this.upgradesPurchased['km2'];
        delete this.upgradesPurchased['km3'];
        delete this.upgradesPurchased['km'];
        delete this.upgradesPurchased['location'];
      }

      if (window.TreeSystem) {
        window.TreeSystem.recalculateAllUpgrades(this);
        window.TreeSystem.updateAllNodes(this);
      }
      this.showToast(`🎉 摆摊经验重置成功！获得 +${earnedEp} EP！小摊重新整装待发！`, 'success');
    } else {
      this.showToast(`🎉 摆摊经验沉淀成功！获得 +${earnedEp} EP！受到【记下笔记】(累计达3EP) 保护，小摊设备与升级全额保留！`, 'success');
    }

    this.checkAchievements();
    this.checkDailyUnlock();
    this.renderDripSlots();
    this.updateUI();
    window.SaveSystem.saveToLocalStorage(this);
  }

  // 购买摆摊经验进阶升级
  buyEpUpgrade(id) {
    if (!this.epUpgrades) {
      this.epUpgrades = { notes: false, autoDrip: false, freshGround: false, agitator: false };
    }

    if (id === 'notes') {
      this.showToast('【记下笔记】现已转为累计经验里程碑：历史累计达到 3.0 EP 自动永久激活，无需消耗 EP！', 'info');
      return;
    } else if (id === 'autoDrip' || id === 'autodrip') {
      if (this.epUpgrades.autoDrip) {
        this.showToast('【自动滴滤】已研发，永久生效中', 'info');
        return;
      }
      const cost = 1.0;
      if ((this.ep || 0) < cost - 0.0001) {
        this.showToast(`经验不足：研发【自动滴滤】需要 ${cost.toFixed(0)} EP，当前拥有 ${(this.ep || 0).toFixed(1)} EP`, 'warning');
        return;
      }
      this.ep = Math.round(((this.ep || 0) - cost) * 10) / 10;
      this.epUpgrades.autoDrip = true;
      this.autoDripUnlocked = true;
      this.autoDripEnabled = true;
      this.dripFilters.forEach(f => f.isAuto = true);
      this.showToast('🎉 成功研发【自动滴滤】！解锁滴滤全自动萃取，可随时切换模式，重置后永久生效！', 'success');
    } else if (id === 'freshGround') {
      if (this.epUpgrades.freshGround) {
        this.showToast('【新鲜现磨不隔夜】已研发，永久生效中', 'info');
        return;
      }
      const cost = 2.0;
      if ((this.ep || 0) < cost - 0.0001) {
        this.showToast(`经验不足：研发【新鲜现磨不隔夜】需要 ${cost.toFixed(0)} EP，当前拥有 ${(this.ep || 0).toFixed(1)} EP`, 'warning');
        return;
      }
      this.ep = Math.round(((this.ep || 0) - cost) * 10) / 10;
      this.epUpgrades.freshGround = true;
      this.showToast('🎉 成功研发【新鲜现磨不隔夜】！每个升级计数频率倍率永久提升至 1.50x！', 'success');
    } else if (id === 'pricing') {
      const cost = this.getPricingUpgradeCost();
      if ((this.ep || 0) < cost - 0.0001) {
        this.showToast(`经验不足：升级【定价是我说了算的】需要 ${cost.toFixed(0)} EP，当前拥有 ${(this.ep || 0).toFixed(1)} EP`, 'warning');
        return;
      }
      this.ep = Math.round(((this.ep || 0) - cost) * 10) / 10;
      this.epPricingLevel = (this.epPricingLevel || 0) + 1;
      const curMult = Math.pow(2, this.epPricingLevel);
      this.showToast(`🎉 成功升级【定价是我说了算的 Lv.${this.epPricingLevel}】！销售价格复利倍增至 ${curMult}x！`, 'success');
    } else if (id === 'agitator') {
      if (this.epUpgrades.agitator) {
        this.showToast('【煽动家】已研发，永久生效中', 'info');
        return;
      }
      const cost = 3.0;
      if ((this.ep || 0) < cost - 0.0001) {
        this.showToast(`经验不足：研发【煽动家】需要 ${cost.toFixed(0)} EP，当前拥有 ${(this.ep || 0).toFixed(1)} EP`, 'warning');
        return;
      }
      this.ep = Math.round(((this.ep || 0) - cost) * 10) / 10;
      this.epUpgrades.agitator = true;
      this.showToast('🎉 成功研发【煽动家】！摊位客流概率永久翻倍 (2x 客流)！', 'success');
    }

    try {
      this.checkAchievements();
      this.updateUI();
      this.updateHUDAndLiveBars();
    } catch (e) {
      console.error('buyEpUpgrade UI update error:', e);
    } finally {
      if (window.SaveSystem) {
        window.SaveSystem.saveToLocalStorage(this);
      }
    }
  }

  // 兼容老旧调用
  executeFranchisePrestige() {
    this.executeStallPrestige();
  }

  executeIpoPrestige() {
    this.executeStallPrestige();
  }

  // 记录资金增减，采用累加器替代每帧数组创建与垃圾回收
  recordEarning(delta) {
    if (typeof delta === 'number' && !isNaN(delta)) {
      this.frameEarningAccumulator = (this.frameEarningAccumulator || 0) + delta;
    }
  }

  // 游戏主物理循环 (计算解耦与节流渲染)
  gameLoop(currentTimestamp) {
    try {
      if (!this.lastTimestamp) this.lastTimestamp = currentTimestamp;
      const dt = Math.min(0.2, (currentTimestamp - this.lastTimestamp) / 1000);
      this.lastTimestamp = currentTimestamp;

      // 1. 推进滴滤器萃取物理进度 (物理模拟)
      this.updateDripFilters(dt);

      // 2. 推进自动销售物理逻辑 (物理模拟)
      this.updateAutoSelling(dt);

      // 2.5 推进无标题增量物理逻辑 (阿尔法脉冲物理模拟)
      this.updateAlpha(dt);

      // 3. 低开销速率平滑采样 (每 0.25 秒采样一次，消除每帧数组 filter 与 reduce 产生的垃圾回收停顿)
      this.rateSampleTimer = (this.rateSampleTimer || 0) + dt;
      if (this.rateSampleTimer >= 0.25) {
        const instantRate = (this.frameEarningAccumulator || 0) / this.rateSampleTimer;
        this.frameEarningAccumulator = 0.0;
        this.rateSampleTimer = 0.0;
        this.currentDisplayRate = this.currentDisplayRate * 0.75 + instantRate * 0.25;
      }

      // 4. 节流 HUD 与进度条更新 (每秒最多 15~20 次，结合脏检查将 DOM 操作开销降低 85% 以上)
      this.hudUpdateTimer = (this.hudUpdateTimer || 0) + dt;
      if (this.hudUpdateTimer >= 0.066) {
        this.hudUpdateTimer = 0.0;
        this.updateHUDAndLiveBars();
      }

      // 5. 成就低频心跳检测 (彻底移出 120FPS 循环，每 2 秒仅对未解锁成就进行一次条件扫描)
      this.achievementCheckTimer = (this.achievementCheckTimer || 0) + dt;
      if (this.achievementCheckTimer >= 2.0) {
        this.achievementCheckTimer = 0.0;
        this.checkAchievements();
      }
    } catch (e) {
      console.error('gameLoop runtime exception caught:', e);
    } finally {
      requestAnimationFrame((ts) => this.gameLoop(ts));
    }
  }

  // 更新滴滤器进度
  updateDripFilters(dt) {
    if (this.epUpgrades && this.epUpgrades.autoDrip) {
      this.autoDripUnlocked = true;
    }
    const unitCost = this.getUnitCost();

    this.dripFilters.forEach(filter => {
      // 自动滴滤触发判定
      if (this.autoDripUnlocked && this.autoDripEnabled && !filter.isBrewing && (this.r >= unitCost - 0.001)) {
        this.r = Math.round(Math.max(0, this.r - unitCost) * 100) / 100;
        this.recordEarning(-unitCost);
        filter.isBrewing = true;
        filter.progress = 0;
      }

      if (filter.isBrewing) {
        filter.progress += dt / this.brewSpeed;

        if (filter.progress >= 1.0) {
          // 萃取完成
          filter.progress = 0;
          filter.isBrewing = false;
          const produced = 1;
          this.coffeeStock += produced;

          // 若全自动且资金充足，下一帧继续开始
        }
      }
    });
  }

  // 自动客流销售逻辑 (受计数频率与客流概率控制)
  updateAutoSelling(dt) {
    if (this.coffeeStock <= 0) return;

    this.salesTimer += dt;
    const freq = this.getSalesFrequency();
    const interval = 1.0 / Math.max(0.001, freq);

    while (this.salesTimer >= interval) {
      this.salesTimer -= interval;

      if (this.coffeeStock > 0) {
        // 客流基础概率销售判定 (基础 0.5x，每级优化选址提升 10%，煽动家提供 2x 客流)
        const effectiveTraffic = this.getEffectiveTrafficRate();
        let cupsToSell = Math.floor(effectiveTraffic);
        const remainder = effectiveTraffic - cupsToSell;
        if (Math.random() <= remainder) {
          cupsToSell += 1;
        }
        cupsToSell = Math.min(cupsToSell, this.coffeeStock);
        for (let c = 0; c < cupsToSell; c++) {
          this.coffeeStock -= 1;
          const revenue = this.getSellingPrice();
          this.r += revenue;
          const wasInitial = this.isInitialPhase();
          this.totalCoffeeSold += 1;
          this.runCoffeeSold = (this.runCoffeeSold || 0) + 1;
          this.totalRevenueEarned += revenue;
          this.recordEarning(revenue);

          // 达成新手起步首杯咖啡售出，解除所有初始购买与升级限制
          if (wasInitial && !this.isInitialPhase()) {
            this.showToast('🎉 恭喜制作并售出第 1 杯咖啡！商业帝国全面启航！', 'success');
            if (window.TreeSystem && typeof window.TreeSystem.updateAllNodes === 'function') {
              window.TreeSystem.updateAllNodes(this);
            }
            this.updateUI();
          }
        }
      }
    }
  }

  // 高频 HUD 与进度条更新 (节流 + 脏检查机制，零多余重绘)
  updateHUDAndLiveBars() {
    // 1. 核心 RMB 大字号计数器
    const rmbStr = `¥${this.formatMoney(this.r)}`;
    this.setDomText('rmb-display', rmbStr);

    // 2. 实时净速率计算器，精确到小数点后一位
    const netRateValEl = this.getEl('net-rate-val');
    const rateSignEl = this.getEl('rate-sign');
    const ratePillEl = this.getEl('rate-pill-badge');
    if (netRateValEl && ratePillEl) {
      const absRate = Math.abs(this.currentDisplayRate).toFixed(1);
      if (netRateValEl.textContent !== absRate) {
        netRateValEl.textContent = absRate;
      }

      let sign = '+';
      let pillClass = 'rate-pill';
      if (this.currentDisplayRate > 0.04) {
        sign = '+';
        pillClass = 'rate-pill';
      } else if (this.currentDisplayRate < -0.04) {
        sign = '-';
        pillClass = 'rate-pill negative';
      } else {
        sign = '+';
        pillClass = 'rate-pill neutral';
      }
      if (rateSignEl && rateSignEl.textContent !== sign) rateSignEl.textContent = sign;
      if (ratePillEl.className !== pillClass) ratePillEl.className = pillClass;
    }

    // 3. 次级资产与债务
    this.setDomText('fp-display', this.fp.toLocaleString());
    this.setDomText('ce-display', `${this.ce}%`);

    // 4. 库存咖啡数量
    this.setDomText('coffee-stock-display', `${this.coffeeStock.toLocaleString()} 杯`);

    // 5. 实时更新各个滴滤器进度条与倒计时 (使用直达缓存元素与脏检查)
    if (this.epUpgrades && this.epUpgrades.autoDrip) {
      this.autoDripUnlocked = true;
    }
    const isAutoActive = this.autoDripUnlocked && this.autoDripEnabled;
    for (let i = 0; i < this.dripFilters.length; i++) {
      const filter = this.dripFilters[i];
      if (!filter._barEl || !filter._timeEl) {
        const card = this.getEl(`filter-slot-${filter.id}`);
        if (card) {
          filter._barEl = card.querySelector('.brew-progress-bar');
          filter._timeEl = card.querySelector('.drip-time-left');
        }
      }

      if (filter._barEl) {
        const pct = Math.min(100, Math.round(filter.progress * 100));
        if (filter._lastPct !== pct) {
          filter._lastPct = pct;
          filter._barEl.style.width = `${pct}%`;
        }
      }

      if (filter._timeEl) {
        let timeStr = '';
        if (filter.isBrewing) {
          const timeLeft = Math.max(0, (1 - filter.progress) * this.brewSpeed).toFixed(1);
          timeStr = `萃取中 (${timeLeft}s)`;
        } else {
          timeStr = isAutoActive ? '自动就绪' : '空闲待命';
        }
        if (filter._lastTimeStr !== timeStr) {
          filter._lastTimeStr = timeStr;
          filter._timeEl.textContent = timeStr;
        }
      }
    }

    // 5.5 实时更新单杯制作成本与净利润 (随售出数量指数跟涨即时呈现)
    const unitCost = this.getUnitCost();
    const costStr = `¥${this.formatMoney(unitCost)}`;
    const brewCostEl = this.getEl('brew-cost-display');
    const unitCostEl = this.getEl('unit-cost-display');
    const profitEl = this.getEl('profit-per-cup');
    if (brewCostEl && brewCostEl.textContent !== costStr) brewCostEl.textContent = costStr;
    if (unitCostEl && unitCostEl.textContent !== costStr) unitCostEl.textContent = costStr;
    if (profitEl) {
      const netProfit = Math.max(0, this.getSellingPrice() - unitCost);
      const profitStr = `+¥${this.formatMoney(netProfit)}`;
      if (profitEl.textContent !== profitStr) profitEl.textContent = profitStr;
    }

    // 6. 开始萃取按钮状态与交互文字 (局部属性与文本更新，零 DOM 重建开销)
    const batchBtn = this.getEl('batch-brew-btn');
    if (batchBtn) {
      const hasIdle = this.dripFilters.some(f => !f.isBrewing);

      let targetDisabled = false;
      let targetIcon = '⚡';
      let targetText = '开始萃取';

      if (this.dripFilters.length === 0) {
        targetDisabled = true;
        targetIcon = '⚡';
        targetText = '请先购买咖啡滴滤器';
      } else if (isAutoActive) {
        targetDisabled = true;
        targetIcon = '🤖';
        targetText = '自动萃取';
      } else if (!hasIdle) {
        targetDisabled = true;
        targetIcon = '⏳';
        targetText = '所有滴滤器萃取中...';
      } else if (this.r < unitCost - 0.001) {
        targetDisabled = true;
        targetIcon = '⚡';
        targetText = `开始萃取 (需 ¥${this.formatMoney(unitCost)})`;
      } else {
        targetDisabled = false;
        targetIcon = '⚡';
        targetText = '开始萃取';
      }

      if (batchBtn.disabled !== targetDisabled) {
        batchBtn.disabled = targetDisabled;
      }
      const iconEl = this.getEl('batch-brew-icon');
      const textEl = this.getEl('batch-brew-text');
      if (iconEl && iconEl.textContent !== targetIcon) iconEl.textContent = targetIcon;
      if (textEl && textEl.textContent !== targetText) textEl.textContent = targetText;
      if (!iconEl && !textEl) {
        const targetHtml = `<span>${targetIcon}</span> <span>${targetText}</span>`;
        if (batchBtn.innerHTML !== targetHtml) batchBtn.innerHTML = targetHtml;
      }
    }

    // 7. 自动/手动切换按键状态 (精确更新文本与状态类，零 DOM 重建)
    const autoToggleBtn = this.getEl('auto-drip-toggle-btn');
    if (autoToggleBtn) {
      if (this.autoDripUnlocked) {
        if (autoToggleBtn.style.display !== 'inline-flex') {
          autoToggleBtn.style.display = 'inline-flex';
        }
        const isAuto = this.autoDripEnabled;
        const targetClass = `btn-auto-toggle ${isAuto ? 'auto' : 'manual'}`;
        const targetIcon = isAuto ? '🤖' : '✋';
        const targetText = isAuto ? '自动中 (切手动)' : '手动中 (切自动)';

        if (autoToggleBtn.className !== targetClass) {
          autoToggleBtn.className = targetClass;
        }
        const iconEl = this.getEl('auto-toggle-icon');
        const textEl = this.getEl('auto-toggle-text');
        if (iconEl && iconEl.textContent !== targetIcon) iconEl.textContent = targetIcon;
        if (textEl && textEl.textContent !== targetText) textEl.textContent = targetText;
        if (!iconEl && !textEl) {
          const targetInner = `<span>${targetIcon}</span> <span>${targetText}</span>`;
          if (autoToggleBtn.innerHTML !== targetInner) autoToggleBtn.innerHTML = targetInner;
        }
      } else {
        if (autoToggleBtn.style.display !== 'none') {
          autoToggleBtn.style.display = 'none';
        }
      }
    }

    // 8. 实时更新升级与购买选项的可用/可负担状态
    this.updateRealtimeAffordability();

    // 8.5 实时同步无标题升级树与每日签到按键显隐 (自适应流式排版并即时重绘连线)
    const btnTreeUntitled = this.getEl('btn-tree-untitled');
    const connectorUntitled = this.getEl('tree-arch-prestige-untitled-connector');
    if (btnTreeUntitled) {
      const isArtisanUnlocked = (this.totalCoffeeSold || 0) >= 300 || (this.achievementsUnlocked && !!this.achievementsUnlocked['coffee_artisan']);
      const targetDisp = isArtisanUnlocked ? 'inline-flex' : 'none';
      if (btnTreeUntitled.style.display !== targetDisp) {
        btnTreeUntitled.style.display = targetDisp;
        if (connectorUntitled) {
          connectorUntitled.style.display = targetDisp;
        }
        if (typeof this.drawHierarchyStem === 'function') {
          requestAnimationFrame(() => this.drawHierarchyStem());
        }
      } else if (connectorUntitled && connectorUntitled.style.display !== targetDisp) {
        connectorUntitled.style.display = targetDisp;
      }
    }
    const btnTreeDaily = this.getEl('btn-tree-daily');
    if (btnTreeDaily) {
      const isDailyUnlocked = !!this.dailyUnlocked || (this.totalEpEarned || 0) >= 1.0;
      const targetDisp = isDailyUnlocked ? 'inline-flex' : 'none';
      if (btnTreeDaily.style.display !== targetDisp) {
        btnTreeDaily.style.display = targetDisp;
        if (typeof this.drawHierarchyStem === 'function') {
          requestAnimationFrame(() => this.drawHierarchyStem());
        }
      }
    }

    // 9. 实时高频驱动摆摊经验界面的经验进度条、收益估算与智能建议 (停留在该界面时毫秒级动态变动)
    this.updatePrestigeRealtimeUI();

    // 9.5 实时高频驱动无标题升级树 (α 增量面板与节点状态)
    if (this.currentTreeSubview === 'untitled') {
      this.updateUntitledRealtimeUI();
    }
  }

  // 实时高频驱动摆摊经验界面 (当玩家停留在摆摊经验界面时，进度条与智能建议毫秒级跟随资产变动)
  updatePrestigeRealtimeUI() {
    const subviewPrestige = this.getEl('subview-prestige');
    if (!subviewPrestige || subviewPrestige.style.display === 'none') {
      return;
    }

    const advice = this.getPrestigeAdvice(this.r);

    // 1. 本次重置可获得经验文本
    const epGainEl = this.getEl('prestige-ep-gain');
    if (epGainEl) {
      const gainStr = `+${advice.potentialEp} EP`;
      if (epGainEl.textContent !== gainStr) epGainEl.textContent = gainStr;
    }

    // 2. 下一经验点进度提示文本
    const nextHintEl = this.getEl('prestige-next-ep-hint');
    if (nextHintEl) {
      let hintStr = '';
      if (advice.potentialEp === 0) {
        hintStr = `下一经验点需达成 ¥100.00 (还差 ¥${this.formatMoney(advice.diff)})`;
      } else {
        hintStr = `达成 ${advice.nextPotentialEp} EP 需达成 ¥${this.formatMoney(advice.nextEpThreshold)} (还差 ¥${this.formatMoney(advice.diff)})`;
      }
      if (nextHintEl.textContent !== hintStr) nextHintEl.textContent = hintStr;
    }

    // 3. 经验进度条填充 (带平滑过渡与发光效果)
    const fillEl = this.getEl('prestige-ep-progress-fill');
    if (fillEl) {
      const widthStr = `${advice.progress.toFixed(1)}%`;
      if (fillEl.style.width !== widthStr) fillEl.style.width = widthStr;
    }

    // 4. 执行重置按键文本与禁用态
    const btnStall = this.getEl('btn-execute-stall-prestige');
    if (btnStall) {
      const isReady = advice.potentialEp > 0;
      if (btnStall.disabled !== !isReady) btnStall.disabled = !isReady;
      const btnStr = `执行摆摊经验重置 (获取 +${advice.potentialEp} EP)`;
      if (btnStall.textContent !== btnStr) btnStall.textContent = btnStr;
    }

    // 5. 实时智能经营与转生建议
    const tipIconEl = this.getEl('edge-prestige-tip-icon');
    const tipContentEl = this.getEl('edge-prestige-tip-content');
    const tipBox = this.getEl('edge-prestige-tip');
    if (tipIconEl && tipIconEl.textContent !== advice.icon) tipIconEl.textContent = advice.icon;
    if (tipContentEl && tipContentEl.textContent !== advice.text) tipContentEl.textContent = advice.text;
    if (tipBox) {
      if (tipBox.classList.contains('urgent') !== advice.isUrgent) {
        tipBox.classList.toggle('urgent', advice.isUrgent);
      }
    }

    // 6. 记下笔记状态提醒实时同步
    const notesBadge = this.getEl('notes-status-badge');
    if (notesBadge) {
      const hasNotes = this.hasNotes();
      let targetClass = 'notes-status-warning';
      let targetText = '';
      if (hasNotes) {
        targetClass = 'notes-status-safe';
        targetText = '🛡️ 累计经验已达 3.0 EP，【记下笔记】已永久激活！重置全额保留小摊设备、库存及升级！';
      } else if ((this.totalEpEarned || 0) + advice.potentialEp >= 3.0) {
        targetClass = 'notes-status-safe';
        targetText = `🎉 本次重置后累计将达 ${((this.totalEpEarned || 0) + advice.potentialEp).toFixed(1)} EP，当场永久激活【记下笔记】小摊设备全额永存！`;
      } else {
        targetClass = 'notes-status-warning';
        targetText = `⚠️ 累计经验未达 3.0 EP (当前 ${(this.totalEpEarned || 0).toFixed(1)}/3.0 EP，重置后 ${((this.totalEpEarned || 0) + advice.potentialEp).toFixed(1)}/3.0 EP)，重置将清空小摊设备、库存及升级！`;
      }
      if (notesBadge.className !== targetClass) notesBadge.className = targetClass;
      if (notesBadge.textContent !== targetText) notesBadge.textContent = targetText;
    }
  }

  // 实时高频可负担性刷新 (节流执行，带脏检查)
  updateRealtimeAffordability() {
    // 1. 滴滤器购买按钮
    const buyFilterBtn = this.getEl('buy-filter-btn');
    if (buyFilterBtn) {
      const isMax = this.dripFilters.length >= 10;
      const targetDisabled = isMax || this.r < 10.0;
      if (buyFilterBtn.disabled !== targetDisabled) {
        buyFilterBtn.disabled = targetDisabled;
      }
      const targetText = isMax ? '<span>已达 10 台上限</span>' : '<span>购买咖啡滴滤器 (¥10)</span>';
      if (buyFilterBtn.innerHTML !== targetText) {
        buyFilterBtn.innerHTML = targetText;
      }
    }

    // 2. 计数频率升级按钮
    const btnUpgradeFreq = this.getEl('btn-upgrade-freq');
    if (btnUpgradeFreq) {
      if (this.isInitialPhase()) {
        if (!btnUpgradeFreq.disabled) btnUpgradeFreq.disabled = true;
      } else {
        const freqCost = this.getFrequencyUpgradeCost();
        const targetDisabled = this.r < freqCost;
        if (btnUpgradeFreq.disabled !== targetDisabled) {
          btnUpgradeFreq.disabled = targetDisabled;
        }
      }
    }

    // 3. 升级树科技节点卡片高亮与状态文本实时同步
    if (window.TreeSystem && typeof window.TreeSystem.updateAffordability === 'function') {
      window.TreeSystem.updateAffordability(this);
    }

    // 4. 摆摊经验 (EP) 徽章与按钮实时同步
    const potentialEp = this.calculateEpFromMoney(this.r);
    const isPrestigeReady = potentialEp > 0;
    const badgePrestigeReady = this.getEl('badge-prestige-ready');
    const treeBadgePrestige = this.getEl('tree-badge-prestige');
    const btnTreePrestige = this.getEl('btn-tree-prestige');
    const prestigeDisplay = isPrestigeReady ? 'inline-flex' : 'none';

    if (badgePrestigeReady) {
      if (badgePrestigeReady.style.display !== prestigeDisplay) {
        badgePrestigeReady.style.display = prestigeDisplay;
      }
      if (isPrestigeReady) {
        const epText = `+${potentialEp} EP`;
        if (badgePrestigeReady.textContent !== epText) {
          badgePrestigeReady.textContent = epText;
        }
      }
    }
    if (treeBadgePrestige) {
      if (treeBadgePrestige.style.display !== prestigeDisplay) {
        treeBadgePrestige.style.display = prestigeDisplay;
      }
      if (isPrestigeReady) {
        const epTreeText = `+${potentialEp} EP 可获取`;
        if (treeBadgePrestige.textContent !== epTreeText) {
          treeBadgePrestige.textContent = epTreeText;
        }
      }
    }
    if (btnTreePrestige) {
      if (isPrestigeReady && !btnTreePrestige.classList.contains('can-reset-highlight')) {
        btnTreePrestige.classList.add('can-reset-highlight');
      } else if (!isPrestigeReady && btnTreePrestige.classList.contains('can-reset-highlight')) {
        btnTreePrestige.classList.remove('can-reset-highlight');
      }
    }
    const btnStallPrestige = this.getEl('btn-execute-stall-prestige');
    if (btnStallPrestige) {
      const targetDisabled = !isPrestigeReady;
      if (btnStallPrestige.disabled !== targetDisabled) {
        btnStallPrestige.disabled = targetDisabled;
      }
    }


  }

  // 动态渲染滴滤器卡槽列表 (仅显示滴滤进度条，删除单个开始萃取按键)
  renderDripSlots() {
    const container = this.getEl('drip-slots-container');
    if (!container) return;

    container.innerHTML = '';

    if (this.dripFilters.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; padding: 40px 20px; text-align: center; color: var(--text-muted); font-size: 0.9rem;">
          <div style="font-size: 2rem; margin-bottom: 8px;">☕</div>
          尚未添置任何滴滤设备，请点击上方按钮购买咖啡滴滤器以开启商业之旅！
        </div>
      `;
      return;
    }

    this.dripFilters.forEach(filter => {
      const card = document.createElement('div');
      card.className = 'drip-slot-card';
      card.id = `filter-slot-${filter.id}`;

      card.innerHTML = `
        <div class="drip-slot-header">
          <span class="slot-title">
            <span class="slot-icon">☕</span>
            <span class="slot-name-full">滴滤器 </span>
            <span class="slot-num">#${filter.id}</span>
          </span>
          <span class="slot-mode-tag ${this.autoDripUnlocked && this.autoDripEnabled ? 'auto' : ''}">
            ${this.autoDripUnlocked && this.autoDripEnabled ? '全自动' : '手动'}
          </span>
        </div>
        <div class="brew-progress-track">
          <div class="brew-progress-bar" style="width: 0%;"></div>
        </div>
        <div class="drip-slot-footer">
          <span class="drip-time-left">空闲待命</span>
        </div>
      `;

      container.appendChild(card);
      // 预缓存进度条与文本元素引用，彻底消除帧循环中的 querySelector 查找
      filter._barEl = card.querySelector('.brew-progress-bar');
      filter._timeEl = card.querySelector('.drip-time-left');
      filter._lastPct = -1;
      filter._lastTimeStr = '';
    });
  }

  // 低频完整界面刷新 (购买升级、借贷、重置等触发)
  updateUI() {
    try {
      if (this.epUpgrades && this.epUpgrades.autoDrip) {
        this.autoDripUnlocked = true;
      }

      // 0. 自动/手动模式切换按键即时同步
      const autoToggleBtn = document.getElementById('auto-drip-toggle-btn');
      if (autoToggleBtn) {
        autoToggleBtn.style.display = this.autoDripUnlocked ? 'inline-flex' : 'none';
        if (this.autoDripUnlocked) {
          const isAuto = this.autoDripEnabled !== false;
          autoToggleBtn.className = `btn-auto-toggle ${isAuto ? 'auto' : 'manual'}`;
          const iconEl = document.getElementById('auto-toggle-icon');
          const textEl = document.getElementById('auto-toggle-text');
          if (iconEl) iconEl.textContent = isAuto ? '🤖' : '✋';
          if (textEl) textEl.textContent = isAuto ? '自动中 (切手动)' : '手动中 (切自动)';
        }
      }

      // 1. 滴滤器购买按钮与数量徽章
      const filterCapTag = document.getElementById('filter-capacity-tag');
      const badgeFilterCount = document.getElementById('badge-filter-count');
      const treeBadgeFilter = document.getElementById('tree-badge-filter');
      const buyFilterBtn = document.getElementById('buy-filter-btn');

      if (filterCapTag) filterCapTag.textContent = `已购置 滴滤器: ${this.dripFilters.length} / 10 台`;
      if (badgeFilterCount) badgeFilterCount.textContent = `${this.dripFilters.length}/10`;
      if (treeBadgeFilter) treeBadgeFilter.textContent = `${this.dripFilters.length}/10`;

      if (buyFilterBtn) {
        if (this.dripFilters.length >= 10) {
          buyFilterBtn.disabled = true;
          buyFilterBtn.innerHTML = '<span>已达 10 台上限</span>';
        } else {
          buyFilterBtn.disabled = this.r < 10.0;
          buyFilterBtn.innerHTML = '<span>购买咖啡滴滤器 (¥10)</span>';
        }
      }

      // 2. 制作速度与单杯成本显示
      const brewSpeedEl = document.getElementById('brew-speed-display');
      const brewCostEl = document.getElementById('brew-cost-display');
      const unitCostEl = document.getElementById('unit-cost-display');
      const salesFreqEl = document.getElementById('sales-freq-display');
      const trafficRateEl = document.getElementById('traffic-rate-display');
      const priceMultEl = document.getElementById('price-mult-display');
      const finalPriceEl = document.getElementById('final-price-display');
      const profitEl = document.getElementById('profit-per-cup');

      if (brewSpeedEl) brewSpeedEl.textContent = this.brewSpeed.toFixed(1);
      if (brewCostEl) brewCostEl.textContent = `¥${this.formatMoney(this.getUnitCost())}`;
      if (unitCostEl) unitCostEl.textContent = `¥${this.formatMoney(this.getUnitCost())}`;
      if (salesFreqEl) salesFreqEl.textContent = `${this.getSalesFrequency().toFixed(2)} 份/秒`;
      if (trafficRateEl) {
        const locLvl = this.getLocationUpgradeLevel();
        const eff = this.getEffectiveTrafficRate();
        const pct = (eff * 100).toFixed(0);
        const mult = eff.toFixed(2);
        let agitatorTag = (this.epUpgrades && this.epUpgrades.agitator) ? ' <span style="font-size: 0.72rem; color: #fbbf24; font-weight: 600;">[煽动家 2x]</span>' : '';
        if (locLvl > 0) {
          trafficRateEl.innerHTML = `${pct}% (${mult}x 客流) <span style="font-size: 0.72rem; color: #38bdf8; font-weight: 600;">(选址Lv.${locLvl})</span>${agitatorTag}`;
        } else {
          trafficRateEl.innerHTML = `${pct}% (${mult}x 基础客流)${agitatorTag}`;
        }
      }
      const achieveMult = this.getAchievementMultiplier();
      const epPricingMult = Math.pow(2, this.epPricingLevel || 0);
      const totalMult = this.salesMultiplier * epPricingMult * achieveMult;
      if (priceMultEl) {
        let notes = [];
        if (epPricingMult > 1) notes.push(`定价${epPricingMult}x`);
        if (achieveMult > 1.0001) notes.push(`成就${achieveMult.toFixed(2)}x`);
        if (notes.length > 0) {
          priceMultEl.textContent = `${totalMult.toFixed(2)}x (${notes.join(', ')})`;
        } else {
          priceMultEl.textContent = `${this.salesMultiplier.toFixed(2)}x`;
        }
      }
      if (finalPriceEl) finalPriceEl.textContent = `¥${this.formatMoney(this.getSellingPrice())}`;

      if (profitEl) {
        const netProfit = this.getSellingPrice() - this.getUnitCost();
        profitEl.textContent = `+¥${this.formatMoney(netProfit)}`;
      }

      // 计数频率升级组件状态
      const freqCost = this.getFrequencyUpgradeCost();
      const btnUpgradeFreq = document.getElementById('btn-upgrade-freq');
      const freqUpgradeBtnText = document.getElementById('freq-upgrade-btn-text');
      const freqLevelBadge = document.getElementById('freq-level-badge');
      const freqMultText = document.getElementById('freq-mult-text');

      const baseFreqMult = (this.epUpgrades && this.epUpgrades.freshGround) ? 1.50 : 1.20;
      if (freqLevelBadge) freqLevelBadge.textContent = `Lv.${this.frequencyUpgradeLevel || 0}`;
      if (freqMultText) freqMultText.textContent = `${Math.pow(baseFreqMult, this.frequencyUpgradeLevel || 0).toFixed(2)}x${(this.epUpgrades && this.epUpgrades.freshGround) ? ' (现磨1.5x)' : ''}`;
      if (btnUpgradeFreq) {
        if (this.isInitialPhase()) {
          btnUpgradeFreq.disabled = true;
          if (freqUpgradeBtnText) freqUpgradeBtnText.textContent = '售出首杯后解锁';
        } else {
          btnUpgradeFreq.disabled = this.r < freqCost;
          if (freqUpgradeBtnText) freqUpgradeBtnText.textContent = `升级 ¥${this.formatMoney(freqCost)}`;
        }
      }

      // 5. 摆摊经验 (EP) 与第二级重置界面更新
      const epCurrentDisplay = document.getElementById('ep-current-display');
      const epTotalDisplay = document.getElementById('ep-total-display');
      const epResetCount = document.getElementById('ep-reset-count');
      if (epCurrentDisplay) epCurrentDisplay.textContent = `${(this.ep || 0).toFixed(1)} EP`;
      if (epTotalDisplay) epTotalDisplay.textContent = `${(this.totalEpEarned || 0).toFixed(1)} EP`;
      if (epResetCount) epResetCount.textContent = `${this.epResetsCount || 0} 次`;

      // 实时高频驱动摆摊经验重置卡片、进度条、建议与笔记状态
      this.updatePrestigeRealtimeUI();

      const hasNotes = typeof this.hasNotes === 'function' ? this.hasNotes() : false;
      const potentialEp = typeof this.calculateEpFromMoney === 'function' ? this.calculateEpFromMoney(this.r) : 0;
      const btnStallPrestige = document.getElementById('btn-execute-stall-prestige');

      // 累计获得经验 (3.0 EP 记下笔记里程碑) 进度条更新
      const cumFill = document.getElementById('ep-cum-progress-fill');
      const cumText = document.getElementById('ep-cum-progress-text');
      const cumBadge = document.getElementById('ep-cum-status-badge');
      const cumMarker = document.getElementById('ep-cum-milestone-marker');
      const trackLabelMid = document.getElementById('ep-track-label-mid');
      const curTotalEp = this.totalEpEarned || 0;
      const maxTrackScale = Math.max(4.0, curTotalEp);
      const markerLeftPct = Math.min(94, Math.max(4, (3.0 / maxTrackScale) * 100));
      const fillPct = Math.min(100, Math.max(0, (curTotalEp / maxTrackScale) * 100));

      if (cumFill) cumFill.style.width = `${fillPct.toFixed(1)}%`;
      if (cumText) cumText.textContent = `累计: ${curTotalEp.toFixed(1)} / 3.0 EP`;
      if (cumMarker) {
        cumMarker.style.left = `${markerLeftPct.toFixed(1)}%`;
        cumMarker.classList.remove('pin-left-align', 'pin-right-align');
        if (markerLeftPct < 25) {
          cumMarker.classList.add('pin-left-align');
        } else if (markerLeftPct > 75) {
          cumMarker.classList.add('pin-right-align');
        }

        if (hasNotes) {
          cumMarker.classList.add('unlocked');
          const pinText = cumMarker.querySelector('.milestone-pin-text');
          if (pinText) pinText.textContent = '✓ 不再重置滴滤小摊';
        } else {
          cumMarker.classList.remove('unlocked');
          const pinText = cumMarker.querySelector('.milestone-pin-text');
          if (pinText) pinText.textContent = '3 EP · 不再重置滴滤小摊';
        }
      }
      if (cumBadge) {
        if (hasNotes) {
          cumBadge.className = 'badge-limit status-unlocked';
          cumBadge.style.background = 'rgba(16, 185, 129, 0.2)';
          cumBadge.style.color = '#34d399';
          cumBadge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
          cumBadge.textContent = '✓ 不再重置滴滤小摊';
        } else {
          cumBadge.className = 'badge-limit';
          cumBadge.style.background = 'rgba(245, 158, 11, 0.2)';
          cumBadge.style.color = '#fbbf24';
          cumBadge.style.borderColor = 'rgba(245, 158, 11, 0.4)';
          const diff = Math.max(0, 3.0 - curTotalEp);
          cumBadge.textContent = `差 ${diff.toFixed(1)} EP · 不再重置滴滤小摊`;
        }
      }
      if (trackLabelMid) {
        if (hasNotes) {
          trackLabelMid.style.color = '#34d399';
          trackLabelMid.textContent = '✨ 3.0 EP (不再重置滴滤小摊)';
        } else {
          trackLabelMid.style.color = '#fbbf24';
          trackLabelMid.textContent = '目标: 3.0 EP (不再重置滴滤小摊)';
        }
      }

      if (btnStallPrestige) {
        btnStallPrestige.disabled = potentialEp <= 0 || this.r < 100;
        btnStallPrestige.textContent = potentialEp > 0
          ? `执行摆摊经验重置 (获取 +${potentialEp} EP)`
          : `资金未达门槛 (需累积资金 ¥100.00)`;
      }

      // 升级树二级节点高亮与角标联动
      const btnTreePrestige = document.getElementById('btn-tree-prestige');
      const treeBadgePrestige = document.getElementById('tree-badge-prestige');
      const badgePrestigeReady = document.getElementById('badge-prestige-ready');
      const isPrestigeReady = potentialEp > 0;

      if (btnTreePrestige) {
        if (isPrestigeReady) {
          btnTreePrestige.classList.add('can-reset-highlight');
        } else {
          btnTreePrestige.classList.remove('can-reset-highlight');
        }
      }

      if (treeBadgePrestige) {
        treeBadgePrestige.style.display = isPrestigeReady ? 'inline-block' : 'none';
        if (isPrestigeReady) {
          treeBadgePrestige.textContent = `+${potentialEp} EP 可获取`;
        }
      }

      if (badgePrestigeReady) {
        badgePrestigeReady.style.display = isPrestigeReady ? 'inline-block' : 'none';
        if (isPrestigeReady) {
          badgePrestigeReady.textContent = `+${potentialEp} EP`;
        }
      }

      // 刷新 4 项 EP 进阶升级卡片
      this.updateEpUpgradesUI();

      // 6. 刷新科技树节点状态
      if (window.TreeSystem) {
        window.TreeSystem.updateAllNodes(this);
      }

      // 7. 每日签到系统状态与倒计时刷新
      this.checkDailyUnlock();
      this.updateDailyCountdown();
      if (this.currentTreeSubview === 'daily') {
        this.renderDailyUI();
      }
      // 8. 无标题升级树入口显隐联动 (累计售出咖啡 >= 300 杯 或 解锁【匠人精神】成就)
      const isArtisanUnlocked = (this.totalCoffeeSold || 0) >= 300 || (this.achievementsUnlocked && !!this.achievementsUnlocked['coffee_artisan']);
      const btnTreeUntitled = document.getElementById('btn-tree-untitled');
      const connectorUntitled = document.getElementById('tree-arch-prestige-untitled-connector');
      if (btnTreeUntitled) {
        btnTreeUntitled.style.display = isArtisanUnlocked ? 'inline-flex' : 'none';
      }
      if (connectorUntitled) {
        connectorUntitled.style.display = isArtisanUnlocked ? 'inline-flex' : 'none';
      }

      if (typeof this.drawHierarchyStem === 'function') {
        this.drawHierarchyStem();
      }
    } catch (err) {
      console.error('updateUI exception caught:', err);
    }
  }

  // 刷新 4 项 EP 进阶升级卡片 (记下笔记已移至累计经验 3.0 EP 里程碑)
  updateEpUpgradesUI() {
    if (!this.epUpgrades) {
      this.epUpgrades = { notes: false, autoDrip: false, freshGround: false, agitator: false };
    }

    // 1. 自动滴滤
    const cardAutoDrip = document.getElementById('ep-card-autodrip');
    const statusAutoDrip = document.getElementById('ep-status-autodrip');
    const btnAutoDrip = document.getElementById('btn-ep-buy-autodrip');
    if (this.epUpgrades.autoDrip) {
      if (cardAutoDrip) cardAutoDrip.classList.add('purchased');
      const isAuto = this.autoDripEnabled !== false;
      if (statusAutoDrip) {
        statusAutoDrip.innerHTML = `<span style="color: ${isAuto ? '#34d399' : '#fbbf24'}; font-weight: 700;">✓ 已研发生效 (${isAuto ? '🤖 自动模式' : '✋ 手动模式'})</span>`;
      }
      if (btnAutoDrip) {
        btnAutoDrip.disabled = true;
        btnAutoDrip.textContent = '已研发';
      }
    } else {
      const canAfford = (this.ep || 0) >= 1.0 - 0.0001;
      if (cardAutoDrip) cardAutoDrip.classList.remove('purchased');
      if (statusAutoDrip) statusAutoDrip.innerHTML = canAfford ? '<span style="color: #fbbf24;">⚡ 可研发</span>' : '经验不足';
      if (btnAutoDrip) {
        btnAutoDrip.disabled = !canAfford;
        btnAutoDrip.textContent = '研发 (1 EP)';
      }
    }

    // 3. 新鲜现磨不隔夜
    const cardFresh = document.getElementById('ep-card-fresh');
    const statusFresh = document.getElementById('ep-status-fresh');
    const btnFresh = document.getElementById('btn-ep-buy-fresh');
    if (this.epUpgrades.freshGround) {
      if (cardFresh) cardFresh.classList.add('purchased');
      if (statusFresh) statusFresh.innerHTML = '<span style="color: #34d399; font-weight: 700;">✓ 已研发生效 (1.50x)</span>';
      if (btnFresh) {
        btnFresh.disabled = true;
        btnFresh.textContent = '已研发';
      }
    } else {
      const canAfford = (this.ep || 0) >= 2.0 - 0.0001;
      if (cardFresh) cardFresh.classList.remove('purchased');
      if (statusFresh) statusFresh.innerHTML = canAfford ? '<span style="color: #fbbf24;">⚡ 可研发</span>' : '经验不足';
      if (btnFresh) {
        btnFresh.disabled = !canAfford;
        btnFresh.textContent = '研发 (2 EP)';
      }
    }

    // 3. 定价是我说了算的
    const cardPricing = document.getElementById('ep-card-pricing');
    const levelPricing = document.getElementById('ep-level-pricing');
    const costPricing = document.getElementById('ep-cost-pricing');
    const statusPricing = document.getElementById('ep-status-pricing');
    const btnPricing = document.getElementById('btn-ep-buy-pricing');
    const pLvl = this.epPricingLevel || 0;
    const pCost = this.getPricingUpgradeCost();
    const canAffordPricing = (this.ep || 0) >= pCost - 0.0001;
    const curPricingMult = Math.pow(2, pLvl);
    const nextPricingMult = Math.pow(2, pLvl + 1);

    if (levelPricing) levelPricing.textContent = `Lv.${pLvl}`;
    if (costPricing) costPricing.textContent = `${pCost.toFixed(0)} EP`;
    if (statusPricing) {
      statusPricing.innerHTML = `当前加成: <strong style="color: #38bdf8;">${curPricingMult}x</strong> (升级后 <strong style="color: #34d399;">${nextPricingMult}x</strong>)`;
    }
    if (btnPricing) {
      btnPricing.disabled = !canAffordPricing;
      btnPricing.textContent = `升级至 Lv.${pLvl + 1} (${pCost.toFixed(0)} EP)`;
    }

    // 4. 煽动家
    const cardAgitator = document.getElementById('ep-card-agitator');
    const statusAgitator = document.getElementById('ep-status-agitator');
    const btnAgitator = document.getElementById('btn-ep-buy-agitator');
    if (this.epUpgrades.agitator) {
      if (cardAgitator) cardAgitator.classList.add('purchased');
      if (statusAgitator) statusAgitator.innerHTML = '<span style="color: #34d399; font-weight: 700;">✓ 已研发生效 (2x 客流)</span>';
      if (btnAgitator) {
        btnAgitator.disabled = true;
        btnAgitator.textContent = '已研发';
      }
    } else {
      const canAfford = (this.ep || 0) >= 3.0 - 0.0001;
      if (cardAgitator) cardAgitator.classList.remove('purchased');
      if (statusAgitator) statusAgitator.innerHTML = canAfford ? '<span style="color: #fbbf24;">⚡ 可研发</span>' : '经验不足';
      if (btnAgitator) {
        btnAgitator.disabled = !canAfford;
        btnAgitator.textContent = '研发 (3 EP)';
      }
    }
  }



  // 优化的成就检测逻辑：快速跳过已解锁，低频执行，零多余运算
  // 严格规则：仅同时显示一个成就达成；若同时达成，完整显示第一个成就，后面的成就用“等x个成就”代替
  checkAchievements() {
    if (!this.ACHIEVEMENTS || !this.achievementsUnlocked) return;
    const newlyUnlockedList = [];
    const unlocked = this.achievementsUnlocked;
    const len = this.ACHIEVEMENTS.length;

    for (let i = 0; i < len; i++) {
      const achieve = this.ACHIEVEMENTS[i];
      // 核心加速：已解锁项目直接跳过，零条件函数计算开销
      if (unlocked[achieve.id]) continue;
      try {
        if (achieve.check(this)) {
          unlocked[achieve.id] = Date.now();
          newlyUnlockedList.push(achieve);
        }
      } catch (err) {
        // 容错保护
      }
    }

    if (newlyUnlockedList.length > 0) {
      const firstAchieve = newlyUnlockedList[0];
      const extraCount = newlyUnlockedList.length - 1;
      this.showAchievementToast(firstAchieve, extraCount);
      this.renderAchievementsGrid();
      this.updateUI();
    }
  }

  // 异步获取 Cloudflare Edge 算力服务器提供的多档转生预测与最优化建议
  async fetchPrestigeProjectionFromEdge() {
    try {
      const endpoint = window.CF_EDGE_API || 'https://coffee-capital-compute.kakalone984.workers.dev/api/compute';
      const res = await fetch(`${endpoint}?action=prestige&r=${this.r}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.success) {
        this.renderEdgePrestigeCard(data);
      }
    } catch (e) {
      // 离线无网络时静默降级
    }
  }

  // 渲染边缘计算推演卡片
  renderEdgePrestigeCard(data) {
    const tipContent = document.getElementById('edge-prestige-tip-content');
    const tipIcon = document.getElementById('edge-prestige-tip-icon');
    if (tipContent && data.recommendationReason) {
      if (tipIcon) tipIcon.textContent = '⚡';
      tipContent.innerHTML = `Cloudflare 边缘算力建议: <strong style="color: #f8fafc;">${data.recommendationReason}</strong>`;
    }
  }

  // 渲染成就网格
  renderAchievementsGrid() {
    const grid = document.getElementById('achievements-grid');
    if (!grid) return;

    grid.innerHTML = '';
    let unlockedCount = 0;

    this.ACHIEVEMENTS.forEach(achieve => {
      const unlockedTime = this.achievementsUnlocked[achieve.id];
      const isUnlocked = !!unlockedTime;
      if (isUnlocked) unlockedCount++;

      const card = document.createElement('div');
      card.className = `achieve-card ${isUnlocked ? 'unlocked' : 'locked'}`;

      let dateStr = '';
      if (isUnlocked) {
        const d = new Date(unlockedTime);
        dateStr = `<div class="achieve-date">✓ 于 ${d.toLocaleDateString()} ${d.toLocaleTimeString()} 解锁</div>`;
      } else {
        dateStr = `<div class="achieve-date" style="color: var(--text-muted);">🔒 尚未达成</div>`;
      }

      card.innerHTML = `
        <div class="achieve-icon-box">${achieve.icon}</div>
        <div class="achieve-text">
          <h4>${achieve.title}</h4>
          <p>${achieve.desc}</p>
          ${dateStr}
        </div>
      `;

      grid.appendChild(card);
    });

    // 更新总览进度条
    const total = this.ACHIEVEMENTS.length;
    const percent = Math.round((unlockedCount / total) * 100);
    const fillEl = document.getElementById('achieve-progress-fill');
    const textEl = document.getElementById('achieve-percent-text');
    const badgeEl = document.getElementById('badge-achieve-count');

    if (fillEl) fillEl.style.width = `${percent}%`;
    if (textEl) textEl.textContent = `${percent}% (${unlockedCount}/${total})`;
    if (badgeEl) badgeEl.textContent = `${unlockedCount}/${total}`;

    const multEl = document.getElementById('achieve-mult-display');
    if (multEl) {
      multEl.textContent = `${this.getAchievementMultiplier().toFixed(3)}x`;
    }
  }

  // 导出/导入模态弹窗管理
  openSaveModal(mode) {
    const modal = document.getElementById('save-modal');
    const title = document.getElementById('save-modal-title');
    const desc = document.getElementById('save-modal-desc');
    const textarea = document.getElementById('save-modal-textarea');
    const actionBtn = document.getElementById('save-modal-action-btn');

    if (!modal || !textarea || !actionBtn) return;

    if (mode === 'export') {
      const b64 = window.SaveSystem.exportSaveToBase64(this);
      title.innerHTML = '<span>📤</span> 导出 Base64 存档';
      desc.textContent = '以下是您的安全 Base64 存档编码字符串，点击下方按钮一键复制：';
      textarea.value = b64;
      textarea.readOnly = true;

      actionBtn.innerHTML = '<span>复制到剪贴板</span>';
      actionBtn.onclick = () => {
        window.SaveSystem.copyTextToClipboard(b64, () => {
          this.showToast('📋 Base64 存档字符串已成功复制到剪贴板！', 'success');
          modal.classList.remove('open');
        }, () => {
          textarea.select();
          this.showToast('请直接手动选中上方文本按 Ctrl+C 复制', 'info');
        });
      };
    } else {
      title.innerHTML = '<span>📥</span> 导入 Base64 存档';
      desc.textContent = '请在下方粘贴您的 Base64 存档字符串并点击导入：';
      textarea.value = '';
      textarea.readOnly = false;

      actionBtn.innerHTML = '<span>确认导入并加载</span>';
      actionBtn.onclick = () => {
        const inputStr = textarea.value;
        const success = window.SaveSystem.importSaveFromBase64(this, inputStr);
        if (success) {
          modal.classList.remove('open');
        }
      };
    }

    modal.classList.add('open');
  }

  // 成就达成专属大号豪华弹窗通知
  // 严格规则：仅同时显示一个成就达成；如果同时达成，完整显示第一个成就，后面的成就用“等x个成就”代替
  showAchievementToast(achieve, extraCount = 0) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    // 核心规则 1：仅同时显示一个成就达成！先移除现存成就通知，杜绝堆叠层叠弹窗
    const existingToasts = container.querySelectorAll('.toast-achievement');
    existingToasts.forEach(t => {
      if (t.parentNode) t.parentNode.removeChild(t);
    });

    const toast = document.createElement('div');
    toast.className = 'toast toast-achievement';
    toast.title = '点击即可关闭通知';

    // 完整处理描述文本
    const descText = (achieve.desc || '').replace(/<[^>]+>/g, ' ');

    // 核心规则 2：完整显示第一个成就，后面的成就用“等x项”代替
    const extraHtml = extraCount > 0
      ? `<span class="achieve-toast-extra-count"> 等 ${extraCount} 项</span>`
      : '';
    const titleHtml = `<span class="achieve-toast-prefix">达成成就：</span><span class="achieve-toast-name">【${achieve.title}】</span>${extraHtml}`;

    const badgeHtml = extraCount > 0
      ? `<span class="achieve-toast-badge">🏆 达成成就</span><span class="achieve-toast-badge extra">+${extraCount}项</span>`
      : `<span class="achieve-toast-badge">🏆 达成成就</span>`;

    const subHintHtml = extraCount > 0
      ? `<div class="achieve-toast-extra-sub">🎉 连环达成！同时解锁【${achieve.title}】等 ${extraCount} 个里程碑</div>`
      : '';

    const rewardMultiplier = Math.pow(1.02, extraCount + 1).toFixed(3);
    const rewardText = extraCount > 0
      ? `✨ 累计获得 ${rewardMultiplier}x 单杯售价永久复利加成！`
      : `✨ 单杯售价永久获得 1.02x 复利加成！`;

    toast.innerHTML = `
      <div class="achieve-toast-icon">${achieve.icon || '🏆'}</div>
      <div class="achieve-toast-body">
        <div class="achieve-toast-badge-row">
          ${badgeHtml}
        </div>
        <div class="achieve-toast-title">${titleHtml}</div>
        <div class="achieve-toast-desc">${descText}</div>
        ${subHintHtml}
        <div class="achieve-toast-reward">${rewardText}</div>
      </div>
    `;

    // 支持点击即刻关闭
    toast.addEventListener('click', () => {
      toast.style.animation = 'toastIn 0.25s reverse forwards ease';
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 250);
    });

    container.appendChild(toast);

    // 5 秒展示时间后平滑退出
    setTimeout(() => {
      if (!toast.parentNode) return;
      toast.style.animation = 'toastIn 0.35s reverse forwards ease';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 350);
    }, 5000);
  }

  // Toast 浮动气泡通知
  // Toast 浮动气泡通知
  // 核心规则：仅在多条“同时触发”（<=50ms微任务/同一批次）时可堆叠多条；
  // 如几条间存在间隔（用户连续操作或间隔触发），直接覆盖上一条，彻底打断上一条的显示时长并从头计时
  showToast(message, type = 'info', extraClass = '') {
    if (typeof message === 'object' && message && message.title) {
      return this.showAchievementToast(message);
    }
    const container = document.getElementById('toast-container');
    if (!container) return;

    if (!this.activeToasts) {
      this.activeToasts = [];
    }
    if (!this._lastToastBatchTime) {
      this._lastToastBatchTime = 0;
    }

    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    // 判定是否为“同时触发”（在50ms同批次时间窗内连续触发）
    const isSimultaneous = (now - this._lastToastBatchTime) < 50;

    if (!isSimultaneous) {
      // 间隔触发：直接打断并覆盖上一条（或上一批），彻底打断其显示时长
      this.activeToasts.forEach(item => {
        if (item.fadeTimer) clearTimeout(item.fadeTimer);
        if (item.removeTimer) clearTimeout(item.removeTimer);
        if (item.el && item.el.parentNode) {
          item.el.parentNode.removeChild(item.el);
        }
      });
      this.activeToasts = [];

      // 清理 DOM 中现存的所有普通通知（安全保留大号成就达成卡片）
      const existingRegularToasts = container.querySelectorAll('.toast:not(.toast-achievement)');
      existingRegularToasts.forEach(el => {
        if (el.parentNode) el.parentNode.removeChild(el);
      });

      // 开启新的 Toast 批次时间基准
      this._lastToastBatchTime = now;
    }

    const toast = document.createElement('div');
    const classList = ['toast', type];
    if (extraClass) classList.push(extraClass);
    toast.className = classList.join(' ');
    toast.textContent = message;

    container.appendChild(toast);

    const toastItem = {
      el: toast,
      fadeTimer: null,
      removeTimer: null
    };

    // 支持点击即刻关闭
    toast.addEventListener('click', () => {
      if (toastItem.fadeTimer) clearTimeout(toastItem.fadeTimer);
      if (toastItem.removeTimer) clearTimeout(toastItem.removeTimer);
      toast.style.animation = 'toastIn 0.2s reverse forwards ease';
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
        this.activeToasts = (this.activeToasts || []).filter(t => t !== toastItem);
      }, 200);
    });

    // 默认展示时长 3200ms 后平滑淡出
    toastItem.fadeTimer = setTimeout(() => {
      if (!toast.parentNode) return;
      toast.style.animation = 'toastIn 0.3s reverse forwards ease';
      toastItem.removeTimer = setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
        this.activeToasts = (this.activeToasts || []).filter(t => t !== toastItem);
      }, 300);
    }, 3200);

    this.activeToasts.push(toastItem);
  }

  // ================== 每日签到与点数 (DP) 系统 ==================

  // 检查是否满足每日签到解锁条件 (累计获取 EP >= 1.0)
  checkDailyUnlock() {
    if (!this.dailyUnlocked && (this.totalEpEarned || 0) >= 1.0) {
      this.dailyUnlocked = true;
      this.showToast('🎉 累计摆摊经验达到 1 EP！【每日签到】系统已正式解锁！', 'success');
      const btnTreeDaily = document.getElementById('btn-tree-daily');
      if (btnTreeDaily) btnTreeDaily.style.display = 'inline-flex';
      if (typeof this.drawHierarchyStem === 'function') {
        requestAnimationFrame(() => this.drawHierarchyStem());
      }
      if (window.SaveSystem) {
        window.SaveSystem.saveToLocalStorage(this);
      }
    }
  }

  // 检查是否可领取每日签到奖励 (每24小时一次，首次解锁默认可领)
  canClaimDaily() {
    if (!this.dailyUnlocked) return false;
    if (!this.lastDailyClaimTime) return true;
    const elapsed = Date.now() - this.lastDailyClaimTime;
    return elapsed >= 24 * 60 * 60 * 1000;
  }

  // 获取剩余冷却毫秒数
  getDailyCooldownRemaining() {
    if (this.canClaimDaily()) return 0;
    const elapsed = Date.now() - (this.lastDailyClaimTime || 0);
    return Math.max(0, 24 * 60 * 60 * 1000 - elapsed);
  }

  // 格式化冷却时间为 HH:MM:SS
  formatCooldown(ms) {
    if (ms <= 0) return '已可领取';
    const totalSecs = Math.floor(ms / 1000);
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  // 手动领取签到奖励 (获取 1 DP)
  claimDailyReward() {
    if (!this.dailyUnlocked) {
      this.showToast('每日签到尚未解锁（需累计获取 1 EP）', 'warning');
      return;
    }
    if (!this.canClaimDaily()) {
      const remainingMs = this.getDailyCooldownRemaining();
      const hours = Math.floor(remainingMs / (1000 * 60 * 60));
      const mins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((remainingMs % (1000 * 60)) / 1000);
      this.showToast(`每日签到冷却中，还需等待 ${hours}小时${mins}分${secs}秒`, 'warning');
      return;
    }

    this.dp = (this.dp || 0) + 1;
    this.totalDpClaimed = (this.totalDpClaimed || 0) + 1;
    this.lastDailyClaimTime = Date.now();

    this.showToast('🎉 签到成功！已领取 1 每日点数 (DP)！', 'success');
    this.checkAchievements();
    this.updateUI();
    this.renderDailyUI();
    if (window.SaveSystem) {
      window.SaveSystem.saveToLocalStorage(this);
    }
  }

  // 定义所有 DP 加成对象 (随游戏进度解锁，默认解锁前两项)
  getDpTargets() {
    return [
      {
        id: 'price',
        name: '滴滤咖啡售价加成',
        icon: '🏷️',
        desc: '大幅提升滴滤咖啡的单杯销售价格，强化现金流动性',
        isUnlocked: (g) => true, // 默认解锁
        unitBonusText: '每次升级 +1.5x 单杯售价 (不复利)',
        getBonusText: (lvl) => `当前售价加成: +${(lvl * 1.5).toFixed(1)}x (达 ${(1 + lvl * 1.5).toFixed(1)}x 单杯单价)`,
        getNextBonusText: (lvl) => `下级升级加成: +${((lvl + 1) * 1.5).toFixed(1)}x (达 ${(1 + (lvl + 1) * 1.5).toFixed(1)}x 单杯单价)`
      },
      {
        id: 'ep',
        name: '摆摊经验 (EP) 获取加成',
        icon: '🎒',
        desc: '大幅提升每次摆摊重置时沉淀的 EP 收益，极速推进科技演进',
        isUnlocked: (g) => true, // 默认解锁
        unitBonusText: '每次升级 +1.5x EP重置收益 (不复利)',
        getBonusText: (lvl) => `当前EP获取加成: +${(lvl * 1.5).toFixed(1)}x (达 ${(1 + lvl * 1.5).toFixed(1)}x 重置收益)`,
        getNextBonusText: (lvl) => `下级升级加成: +${((lvl + 1) * 1.5).toFixed(1)}x (达 ${(1 + (lvl + 1) * 1.5).toFixed(1)}x 重置收益)`
      }
    ];
  }

  // 投入 1 DP 升级指定加成对象
  investDp(targetId) {
    if ((this.dp || 0) < 1) {
      this.showToast('每日点数 (DP) 不足：请通过每日签到获取 DP', 'warning');
      return;
    }

    const targets = this.getDpTargets();
    const target = targets.find(t => t.id === targetId);
    if (!target) return;

    if (!target.isUnlocked(this)) {
      this.showToast('该加成对象尚未随商业进程解锁', 'warning');
      return;
    }

    this.dp -= 1;
    if (!this.dpInvestments) {
      this.dpInvestments = { price: 0, ep: 0 };
    }
    this.dpInvestments[targetId] = (this.dpInvestments[targetId] || 0) + 1;

    this.showToast(`🎉 成功投入 1 DP！【${target.name}】提升至 Lv.${this.dpInvestments[targetId]}！`, 'success');
    this.checkAchievements();
    this.updateUI();
    this.renderDailyUI();
    if (window.SaveSystem) {
      window.SaveSystem.saveToLocalStorage(this);
    }
  }

  // 切换树形架构子界面 (workshop | prestige | daily | untitled)
  switchTreeSubview(targetView) {
    const subviewWorkshop = document.getElementById('subview-workshop');
    const subviewPrestige = document.getElementById('subview-prestige');
    const subviewDaily = document.getElementById('subview-daily');
    const subviewUntitled = document.getElementById('subview-untitled');
    const btnTreeWorkshop = document.getElementById('btn-tree-workshop');
    const btnTreePrestige = document.getElementById('btn-tree-prestige');
    const btnTreeDaily = document.getElementById('btn-tree-daily');
    const btnTreeUntitled = document.getElementById('btn-tree-untitled');

    this.currentTreeSubview = targetView;

    if (btnTreeWorkshop) btnTreeWorkshop.classList.toggle('active', targetView === 'workshop');
    if (btnTreePrestige) btnTreePrestige.classList.toggle('active', targetView === 'prestige');
    if (btnTreeDaily) btnTreeDaily.classList.toggle('active', targetView === 'daily');
    if (btnTreeUntitled) btnTreeUntitled.classList.toggle('active', targetView === 'untitled');

    if (subviewWorkshop) subviewWorkshop.style.display = targetView === 'workshop' ? 'block' : 'none';
    if (subviewPrestige) subviewPrestige.style.display = targetView === 'prestige' ? 'block' : 'none';
    if (subviewDaily) subviewDaily.style.display = targetView === 'daily' ? 'block' : 'none';
    if (subviewUntitled) subviewUntitled.style.display = targetView === 'untitled' ? 'block' : 'none';

    this.updateUI();

    if (targetView === 'workshop' && window.TreeSystem) {
      requestAnimationFrame(() => window.TreeSystem.drawConnections(this));
    }
    if (targetView === 'prestige') {
      this.fetchPrestigeProjectionFromEdge();
    }
    if (targetView === 'daily') {
      this.renderDailyUI();
    }
    if (targetView === 'untitled') {
      this.renderUntitledTreeUI();
      if (!this.untitledViewport.initialized) {
        this.initUntitledViewport();
        this.recenterUntitledTree();
      } else {
        requestAnimationFrame(() => this.drawUntitledConnections());
      }
    }

    if (typeof this.drawHierarchyStem === 'function') {
      requestAnimationFrame(() => this.drawHierarchyStem());
      setTimeout(() => this.drawHierarchyStem(), 80);
    }
  }

  // 绘制树形架构顶部按键与摆摊经验之间的 SVG 连线 (自适应双向/单向汇聚)
  drawHierarchyStem() {
    const svg = document.getElementById('tree-arch-svg');
    const container = document.getElementById('tree-arch-stem-container');
    const btnWorkshop = document.getElementById('btn-tree-workshop');
    const btnDaily = document.getElementById('btn-tree-daily');
    const btnPrestige = document.getElementById('btn-tree-prestige');
    const pathWorkshop = document.getElementById('stem-path-workshop');
    const pathDaily = document.getElementById('stem-path-daily');
    const jointNode = document.getElementById('stem-joint-node');
    const arrowHead = document.getElementById('stem-arrow-head');

    if (!svg || !container || !btnWorkshop || !btnPrestige || !pathWorkshop) return;

    const cRect = container.getBoundingClientRect();
    if (cRect.width === 0 || cRect.height === 0) return;

    svg.setAttribute('width', cRect.width);
    svg.setAttribute('height', cRect.height);

    // 动态校准渐变坐标范围
    const gradWorkshop = document.getElementById('stem-gradient-workshop');
    if (gradWorkshop) {
      gradWorkshop.setAttribute('x1', '0');
      gradWorkshop.setAttribute('y1', '0');
      gradWorkshop.setAttribute('x2', '0');
      gradWorkshop.setAttribute('y2', `${cRect.height}`);
    }
    const gradDaily = document.getElementById('stem-gradient-daily');
    if (gradDaily) {
      gradDaily.setAttribute('x1', '0');
      gradDaily.setAttribute('y1', '0');
      gradDaily.setAttribute('x2', '0');
      gradDaily.setAttribute('y2', `${cRect.height}`);
    }

    const wRect = btnWorkshop.getBoundingClientRect();
    const pRect = btnPrestige.getBoundingClientRect();

    // 摆摊经验顶部中心坐标
    const px = Math.round(pRect.left + pRect.width / 2 - cRect.left);
    const py = Math.round(cRect.height);

    // 滴滤小摊底部中心坐标
    const wx = Math.round(wRect.left + wRect.width / 2 - cRect.left);
    const wy = 0;

    const isDailyVisible = btnDaily && btnDaily.style.display !== 'none';
    const arrowSize = 5;
    const arrowBottom = py - 1;
    const arrowTop = arrowBottom - arrowSize * 1.5;

    if (isDailyVisible) {
      const dRect = btnDaily.getBoundingClientRect();
      const dx = Math.round(dRect.left + dRect.width / 2 - cRect.left);
      const dy = 0;

      // 汇聚接点
      const jx = px;
      const jy = Math.round(cRect.height * 0.52);

      // 滴滤小摊 -> 汇聚接点 -> 摆摊经验
      pathWorkshop.style.display = 'block';
      pathWorkshop.setAttribute('d', `M ${wx} ${wy} C ${wx} ${jy * 0.7}, ${jx} ${jy * 0.7}, ${jx} ${jy} L ${px} ${arrowTop}`);
      pathWorkshop.setAttribute('stroke', 'url(#stem-gradient-workshop)');

      // 每日签到 -> 汇聚接点
      if (pathDaily) {
        pathDaily.style.display = 'block';
        pathDaily.setAttribute('d', `M ${dx} ${dy} C ${dx} ${jy * 0.7}, ${jx} ${jy * 0.7}, ${jx} ${jy}`);
        pathDaily.setAttribute('stroke', 'url(#stem-gradient-daily)');
      }

      if (jointNode) {
        jointNode.setAttribute('cx', jx);
        jointNode.setAttribute('cy', jy);
        jointNode.style.display = 'block';
      }
    } else {
      // 仅滴滤小摊：清晰单分支直连 (未解锁每日签到时)
      const midY = Math.round(py * 0.5);
      pathWorkshop.style.display = 'block';

      if (Math.abs(wx - px) < 2) {
        pathWorkshop.setAttribute('d', `M ${px} ${wy} L ${px} ${arrowTop}`);
      } else {
        pathWorkshop.setAttribute('d', `M ${wx} ${wy} C ${wx} ${midY}, ${px} ${midY}, ${px} ${arrowTop}`);
      }
      pathWorkshop.setAttribute('stroke', 'url(#stem-gradient-workshop)');

      if (pathDaily) pathDaily.style.display = 'none';
      if (jointNode) {
        jointNode.setAttribute('cx', px);
        jointNode.setAttribute('cy', midY);
        jointNode.style.display = 'block';
      }
    }

    if (arrowHead) {
      arrowHead.setAttribute('points', `${px - arrowSize},${arrowTop} ${px + arrowSize},${arrowTop} ${px},${arrowBottom}`);
      arrowHead.style.display = 'block';
    }
  }

  // 刷新每日签到冷却倒计时与导航按键角标
  updateDailyCountdown() {
    const btnTreeDaily = document.getElementById('btn-tree-daily');
    const treeBadgeDaily = document.getElementById('tree-badge-daily');

    if (btnTreeDaily) {
      if (this.dailyUnlocked) {
        if (btnTreeDaily.style.display === 'none') {
          btnTreeDaily.style.display = 'inline-flex';
          requestAnimationFrame(() => this.drawHierarchyStem());
        }
      } else {
        btnTreeDaily.style.display = 'none';
      }
    }

    if (!this.dailyUnlocked) return;

    const canClaim = this.canClaimDaily();
    const claimBtn = document.getElementById('btn-daily-claim');
    const claimBtnText = document.getElementById('btn-daily-claim-text');
    const statusTitle = document.getElementById('daily-status-title');
    const statusDesc = document.getElementById('daily-status-desc');
    const cooldownWrapper = document.getElementById('daily-cooldown-wrapper');
    const cooldownHint = document.getElementById('daily-cooldown-hint');
    const cooldownFill = document.getElementById('daily-cooldown-bar-fill');

    if (canClaim) {
      if (claimBtn) {
        claimBtn.disabled = false;
        claimBtn.classList.remove('cooling-down');
      }
      if (claimBtnText) claimBtnText.textContent = '立即签到 (+1 DP)';
      if (statusTitle) {
        statusTitle.textContent = '🎁 今日签到奖励已就绪！';
        statusTitle.classList.add('ready');
      }
      if (statusDesc) statusDesc.textContent = '点击右侧按钮立即领取 1 每日点数 (DP)，永久强化咖啡经营要素！';
      if (cooldownWrapper) cooldownWrapper.style.display = 'none';

      if (treeBadgeDaily) {
        treeBadgeDaily.style.display = 'inline-block';
        treeBadgeDaily.textContent = '可领取';
        treeBadgeDaily.classList.add('alert');
      }
      if (btnTreeDaily) {
        btnTreeDaily.classList.add('can-claim-highlight');
      }
    } else {
      const remainingMs = this.getDailyCooldownRemaining();
      const elapsed = (24 * 60 * 60 * 1000) - remainingMs;
      const progress = Math.min(100, Math.max(0, (elapsed / (24 * 60 * 60 * 1000)) * 100));
      const timeStr = this.formatCooldown(remainingMs);

      if (claimBtn) {
        claimBtn.disabled = true;
        claimBtn.classList.add('cooling-down');
      }
      if (claimBtnText) claimBtnText.textContent = `冷却中 (${timeStr})`;
      if (statusTitle) {
        statusTitle.textContent = '⏳ 今日已完成签到';
        statusTitle.classList.remove('ready');
      }
      if (statusDesc) statusDesc.textContent = `距离下次签到解锁还剩 ${timeStr}，请耐心等待冷却完成。`;
      if (cooldownWrapper) cooldownWrapper.style.display = 'block';
      if (cooldownHint) cooldownHint.textContent = `冷却倒计时：${timeStr}`;
      if (cooldownFill) cooldownFill.style.width = `${progress.toFixed(1)}%`;

      if (treeBadgeDaily) {
        treeBadgeDaily.style.display = 'inline-block';
        const hours = Math.floor(remainingMs / (1000 * 60 * 60));
        const mins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        treeBadgeDaily.textContent = hours > 0 ? `${hours}h${mins}m` : `${mins}m`;
        treeBadgeDaily.classList.remove('alert');
      }
      if (btnTreeDaily) {
        btnTreeDaily.classList.remove('can-claim-highlight');
      }
    }
  }

  // 渲染每日签到与 DP 投入对象界面
  renderDailyUI() {
    this.updateDailyCountdown();

    const dpBalance = document.getElementById('daily-dp-balance');
    if (dpBalance) {
      dpBalance.textContent = this.dp || 0;
    }

    const grid = document.getElementById('daily-targets-grid');
    if (!grid) return;

    const targets = this.getDpTargets();
    const canAfford = (this.dp || 0) >= 1;

    grid.innerHTML = targets.map(target => {
      const isUnlocked = target.isUnlocked(this);
      const level = (this.dpInvestments && this.dpInvestments[target.id]) || 0;
      if (!isUnlocked) {
        return `
          <div class="glass-panel daily-target-card locked">
            <div class="target-card-header">
              <span class="target-card-icon">🔒</span>
              <div class="target-card-titles">
                <h4>${target.name}</h4>
                <span class="target-card-locked-tag">未解锁</span>
              </div>
            </div>
            <div class="target-card-desc">随更高阶商业阶段解锁</div>
          </div>
        `;
      }

      return `
        <div class="glass-panel daily-target-card" id="daily-target-${target.id}">
          <div class="target-card-header">
            <span class="target-card-icon">${target.icon}</span>
            <div class="target-card-titles">
              <h4>${target.name} <span class="badge-limit">Lv.${level}</span></h4>
              <span class="target-card-unit">${target.unitBonusText}</span>
            </div>
          </div>
          <div class="target-card-desc">${target.desc}</div>
          <div class="target-card-effects">
            <div class="effect-line current">${target.getBonusText(level)}</div>
            <div class="effect-line next">${target.getNextBonusText(level)}</div>
          </div>
          <div class="target-card-footer">
            <span class="target-cost-hint">消耗: 1 DP</span>
            <button class="btn-invest-dp ${canAfford ? 'can-afford' : ''}" 
                    data-target="${target.id}" 
                    ${canAfford ? '' : 'disabled'}>
              ${canAfford ? '⚡ 投入 1 DP' : 'DP 不足'}
            </button>
          </div>
        </div>
      `;
    }).join('');

    // 绑定投入按键点击事件
    const btns = grid.querySelectorAll('.btn-invest-dp');
    btns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetId = e.currentTarget.dataset.target;
        this.investDp(targetId);
      });
    });
  }

  // ================== 无标题升级树 & α (阿尔法) / β (贝塔) 增量体系 ==================

  // 解析代号中的行号与列号 (例如: #11 -> row: 1, col: 1; #21 -> row: 2, col: 1; #71 -> row: 7, col: 1)
  parseUntitledCode(code) {
    const clean = String(code).replace('#', '').trim();
    const row = parseInt(clean.charAt(0), 10) || 1;
    const col = parseInt(clean.substring(1), 10) || 1;
    return { row, col };
  }

  // 预设升级项名称
  getAutoNodeName(row, col) {
    const knownNames = {
      '1-1': '开始吧',
      '2-1': '双生共振',
      '3-1': '质量流形',
      '3-2': '时序微元压缩',
      '3-3': '谐波余震',
      '4-1': '引力深井',
      '4-2': '相空间流体',
      '4-3': '自指拓扑环',
      '4-4': '级联裂变',
      '5-1': '虚时间态插值',
      '5-2': '双变量几何共振',
      '5-3': '临界超载',
      '6-1': '曲率张量平滑',
      '6-2': '奇点超限投影',
      '7-1': '维度坍缩'
    };
    return knownNames[`${row}-${col}`] || `脉冲谐波 #${row}${col}`;
  }

  // 获取所有 15 个无标题晶格拓扑节点配置 (严格遵循 md 规范与拓扑连线图)
  getUntitledNodes() {
    const rawNodes = [
      // 第一行：始源基底
      {
        id: '11',
        code: '#11',
        name: '开始吧',
        cost: 0,
        desc: '踏入无标题的始源维度，激活阿尔法脉冲。',
        effectDesc: '基础产出 +1.0 α/秒 (每 1.0 秒 +1 α)',
        requires: []
      },
      // 第二行：频次谐振
      {
        id: '21',
        code: '#21',
        name: '双生共振',
        cost: 10,
        desc: '强化始源脉冲谐波，将 #11 的效果翻倍。',
        effectDesc: '脉冲周期减半为 0.5 秒，产能提升至 +2.0 α/秒',
        requires: ['11']
      },
      // 第三行：流派分化（3 节点）
      {
        id: '31',
        code: '#31',
        name: '质量流形',
        cost: 60,
        desc: '未消耗的阿尔法储备产生微弱引力。基于当前持有量提供动态对数乘率。',
        effectDesc: '动态对数倍率: 1 + 0.35 × log10(α + 1)',
        requires: ['21']
      },
      {
        id: '32',
        code: '#32',
        name: '时序微元压缩',
        cost: 140,
        desc: '打破始源时序阻尼，压缩脉冲释放周期。',
        effectDesc: '基础生产间隔缩短至 0.35 秒 (全局产出频率提升约 42.8%)',
        requires: ['21']
      },
      {
        id: '33',
        code: '#33',
        name: '谐波余震',
        cost: 320,
        desc: '脉冲释放时激发非线性波动。发放产能时激发爆发脉冲。',
        effectDesc: '每次发放产能时，有 25% 概率触发一次 300% 强度的爆发脉冲',
        requires: ['21']
      },
      // 第四行：机制深化与交叉（4 节点）
      {
        id: '41',
        code: '#41',
        name: '引力深井',
        cost: 1500,
        desc: '深化储量流机制。强化 #31 对数系数；且高额储备时注入基础产能。',
        effectDesc: '#31 对数系数升至 0.65；持有量 α ≥ 1,000 时基础产出额外固定增加 +2.0 α/秒',
        requires: ['31']
      },
      {
        id: '42',
        code: '#42',
        name: '相空间流体',
        cost: 4200,
        desc: '将储量规模反哺至时间轴。持有量按幂律缩短生产周期。',
        effectDesc: '生产周期 T = T_base × (α + 10)^(-0.03) (单次脉冲间隔下限 0.10 秒)',
        requires: ['31', '32']
      },
      {
        id: '43',
        code: '#43',
        name: '自指拓扑环',
        cost: 12000,
        desc: '升级节点形成闭合网络。整棵树每激活 1 个升级节点，全局产出独立乘算提升 15%。',
        effectDesc: '每激活 1 个升级节点全局产出独立乘算 ×1.15 (当前加成: 1.15^k)',
        requires: ['32', '33']
      },
      {
        id: '44',
        code: '#44',
        name: '级联裂变',
        cost: 35000,
        desc: '#33 谐波触发概率大幅提升；且触发爆发时可能引发二次连锁裂变。',
        effectDesc: '#33 触发概率升至 40%；爆发时有 20% 概率二次裂变造成 900% 脉冲产出',
        requires: ['33']
      },
      // 第五行：多维协同融合（3 节点）
      {
        id: '51',
        code: '#51',
        name: '虚时间态插值',
        cost: 150000,
        desc: '引入时间流体积分，静置时产出自动爬坡，并使离线收益率提升至 100%。',
        effectDesc: '静置时动态倍率 1 + 0.30 × (t_idle + 1)^0.38，离线收益 100%',
        requires: ['41', '42']
      },
      {
        id: '52',
        code: '#52',
        name: '双变量几何共振',
        cost: 600000,
        desc: '将「当前持有量 α」与「瞬时秒产量 Δα/秒」几何平均，全局产出获得额外加成。',
        effectDesc: '额外倍率 = √(log10(α + 10) × log10(Δα + 10))',
        requires: ['42', '43']
      },
      {
        id: '53',
        code: '#53',
        name: '临界超载',
        cost: 2400000,
        desc: '谐波脉冲爆发时，有 50% 概率使系统进入过载状态。',
        effectDesc: '爆发时 50% 概率进入 3 秒过载：生产频率提升 100% (刷新时长)',
        requires: ['43', '44']
      },
      // 第六行：法则重构与高维投影（2 节点）
      {
        id: '61',
        code: '#61',
        name: '曲率张量平滑',
        cost: 25000000,
        desc: '解锁产能软上限稀释。突破千万秒产时衰减指数更加平缓。',
        effectDesc: '瞬时秒产 ≥ 10^7 时，原本的 0.50 次方软上限重整化平滑为 0.75 次方',
        requires: ['51', '52']
      },
      {
        id: '62',
        code: '#62',
        name: '奇点超限投影',
        cost: 120000000,
        desc: '感知高维投影，开启第二层货币「贝塔（β）」预演算。',
        effectDesc: '预演算 β_gain = ⌊(α / 10^7)^0.22⌋；每点待获取 β 反哺产出 +250%',
        requires: ['52', '53']
      },
      // 第七行：第一阶跃迁（终点）
      {
        id: '71',
        code: '#71',
        name: '维度坍缩',
        cost: 1000000000,
        desc: '执行第一层底层重置。清空当前持有量 α 及本树全部升级，正式兑现第二阶货币 β；重置后永久锁定保留 #11 与 #21 的已激活状态，并解锁进阶 β 研发矩阵与自动化控制台。',
        effectDesc: '第一阶底层重置：兑现 β 开启第二层级，保留 #11 & #21',
        requires: ['61', '62']
      }
    ];

    return rawNodes.map(node => {
      const { row, col } = this.parseUntitledCode(node.code || `#${node.id}`);
      const name = node.name || this.getAutoNodeName(row, col);
      const requires = node.requires || [];
      return {
        ...node,
        row,
        col,
        name,
        requires
      };
    }).sort((a, b) => {
      if (a.row !== b.row) return a.row - b.row;
      return a.col - b.col;
    });
  }

  // 根据 ID 获取节点配置
  getUntitledNodeById(id) {
    return this.getUntitledNodes().find(n => n.id === String(id));
  }

  // 格式化阿尔法费用显示 (严格还原 md 规范中的表达形式)
  formatAlphaCost(val) {
    if (!val || val === 0) return '免费';
    if (val < 10000) return val.toString();
    if (val === 150000) return '1.50e5';
    if (val === 600000) return '6.00e5';
    if (val === 2400000) return '2.40e6';
    if (val === 25000000) return '2.50e7';
    if (val === 120000000) return '1.20e8';
    if (val === 1000000000) return '1.00e9';
    if (val < 100000) return val.toLocaleString('zh-CN');
    return val.toExponential(2);
  }

  // 获取当前奇点超限投影预演算待获取的贝塔 (β) 点数
  getPendingBeta() {
    const alphaVal = Math.max(0, this.alpha || 0);
    if (alphaVal < 10000000) return 0; // < 10^7 为 0
    return Math.floor(Math.pow(alphaVal / 10000000, 0.22));
  }

  // 获取当前脉冲物理间隔周期 T (秒)
  getAlphaPulseInterval() {
    if (!this.untitledUpgrades || !this.untitledUpgrades['11']) {
      return 1.0;
    }
    // 基础周期: #11 为 1.0s, #21 为 0.5s, #32 为 0.35s
    let tBase = 1.0;
    if (this.untitledUpgrades['32']) {
      tBase = 0.35;
    } else if (this.untitledUpgrades['21']) {
      tBase = 0.50;
    }

    // #42 相空间流体: T = T_base * (alpha + 10)^(-0.03)，下限 0.10s
    let t = tBase;
    if (this.untitledUpgrades['42']) {
      const alphaVal = Math.max(0, this.alpha || 0);
      t = Math.max(0.10, tBase * Math.pow(alphaVal + 10, -0.03));
    }

    // #53 临界超载: 过载期间生产频率 +100% (物理间隔减半)
    if (this.untitledUpgrades['53'] && (this.alphaOverloadTimer || 0) > 0) {
      t = t / 2.0;
    }

    return Math.max(0.05, t);
  }

  // 计算当前阿尔法 (α) 总体产出速率 (α/秒)
  getAlphaRate() {
    if (!this.untitledUpgrades || !this.untitledUpgrades['11']) {
      return 0.0;
    }

    const up = this.untitledUpgrades;
    const alphaVal = Math.max(0, this.alpha || 0);

    // 1. 基础每秒产出 (Base production per second)
    // #11 为 +1.0 α/s; #41 在 α >= 1,000 时额外提供 +2.0 α/s 基础产出
    let baseProdPerSec = 1.0;
    if (up['41'] && alphaVal >= 1000) {
      baseProdPerSec += 2.0;
    }

    // 2. 频率缩放倍率 (相对于基础 1.0s 脉冲周期的加速)
    // #21 周期 0.5s (2.0x freq), #32 周期 0.35s (2.857x freq), #42 幂律压缩, #53 过载加速
    const currentInterval = this.getAlphaPulseInterval();
    const freqMult = 1.0 / currentInterval;

    // 3. 谐波爆发的数学期望倍率
    // #33: 25% 概率 300% 脉冲 -> 平均加成 1 + 0.25*(3-1) = 1.50x
    // #44: 40% 爆发，其中 20% 为 900%，80% 为 300% -> 平均加成 1 + 0.40*(0.8*2 + 0.2*8) = 2.28x
    let burstMult = 1.0;
    if (up['44']) {
      burstMult = 2.28;
    } else if (up['33']) {
      burstMult = 1.50;
    }

    // 4. #31 质量流形 & #41 引力深井对数乘率
    // 基础系数 0.35，#41 解锁后升至 0.65
    let logMult = 1.0;
    if (up['31']) {
      const logFactor = up['41'] ? 0.65 : 0.35;
      logMult = 1.0 + logFactor * Math.log10(alphaVal + 1);
    }

    // 5. #43 自指拓扑环: 整棵树每激活 1 个升级节点，全局产出独立乘算提升 15% (1.15^k)
    let topoMult = 1.0;
    if (up['43']) {
      const unlockedCount = Object.values(up).filter(Boolean).length;
      topoMult = Math.pow(1.15, unlockedCount);
    }

    // 6. #51 虚时间态插值: 静置时产出自动爬坡 1 + 0.30 * (t_idle + 1)^0.38
    let idleMult = 1.0;
    if (up['51']) {
      const idleSec = Math.max(0, this.alphaIdleTimer || 0);
      idleMult = 1.0 + 0.30 * Math.pow(idleSec + 1, 0.38);
    }

    // 汇总中间瞬时秒产 (用于 #52 几何共振计算)
    let preRate = baseProdPerSec * freqMult * burstMult * logMult * topoMult * idleMult;

    // 7. #52 双变量几何共振: sqrt(log10(alpha + 10) * log10(deltaAlpha + 10))
    let geomMult = 1.0;
    if (up['52']) {
      const valA = Math.max(1, Math.log10(alphaVal + 10));
      const valB = Math.max(1, Math.log10(preRate + 10));
      geomMult = Math.sqrt(valA * valB);
    }

    // 8. #62 奇点超限投影: 预演算 beta_gain = floor((alpha / 1e7)^0.22); 每点待获取 beta 产出 +250%
    let betaMult = 1.0;
    if (up['62']) {
      const pendingBeta = this.getPendingBeta();
      if (pendingBeta > 0) {
        betaMult = 1.0 + 2.50 * pendingBeta;
      }
    }

    // 原始无软上限总秒产
    let rawRate = preRate * geomMult * betaMult;

    // 9. #61 曲率张量平滑: 秒产 >= 10^7 时进行软上限稀释
    // 基础软上限指数为 0.50，研发 #61 后平滑重整化为 0.75
    const capThreshold = 10000000.0; // 10^7
    if (rawRate > capThreshold) {
      const capExp = up['61'] ? 0.75 : 0.50;
      rawRate = capThreshold * Math.pow(rawRate / capThreshold, capExp);
    }

    return rawRate;
  }

  // 获取阿尔法单点递增节奏间隔 (秒/α)
  getAlphaCadenceInterval() {
    const rate = this.getAlphaRate();
    if (rate <= 0) return 0;
    return 1.0 / rate;
  }

  // 格式化阿尔法数值显示
  formatAlpha(val) {
    if (typeof val !== 'number' || isNaN(val)) return '0';
    if (val <= 1000) {
      return Math.floor(val).toString();
    }
    if (val < 1000000) {
      return Math.floor(val).toLocaleString('zh-CN');
    }
    if (val < 1e8) {
      return Math.floor(val).toLocaleString('zh-CN');
    }
    return val.toExponential(2);
  }

  // 触发阿尔法单点数值跳动脉冲视觉反馈 (采用 rAF 替代强制回流 offsetWidth，彻底消除全局 Layout Thrashing)
  triggerAlphaPulse(hadCrit = false) {
    const displayEl = this.getEl('alpha-amount-display');
    if (!displayEl) return;
    const cls = hadCrit ? 'crit-pulse' : 'tick-pulse';
    displayEl.classList.remove('tick-pulse', 'crit-pulse');
    requestAnimationFrame(() => {
      displayEl.classList.add(cls);
    });
  }

  // 推进阿尔法脉冲物理更新 (在 gameLoop 物理循环中调用)
  updateAlpha(dt) {
    const rate = this.getAlphaRate();
    if (rate <= 0) {
      this.alphaTickTimer = 0;
      return;
    }

    // 维护静置时间与临界超载时长
    this.alphaIdleTimer = (this.alphaIdleTimer || 0) + dt;
    if (this.alphaOverloadTimer > 0) {
      this.alphaOverloadTimer = Math.max(0, this.alphaOverloadTimer - dt);
    }

    const up = this.untitledUpgrades || {};

    // 核心节奏法则：当阿尔法点数在 1000 及以内时，必须每增加一个阿尔法点数都在数值上显示
    // 例如 1 α/秒为每 1.0 秒 +1 点，翻倍至 2 α/秒则为每 0.5 秒 +1 点
    if (this.alpha <= 1000) {
      const interval = 1.0 / rate;
      this.alphaTickTimer += dt;
      let ticked = false;
      let hadCrit = false;

      while (this.alphaTickTimer >= interval && this.alpha <= 1000) {
        this.alphaTickTimer -= interval;

        let pulseGain = 1;
        if (up['33']) {
          const burstChance = up['44'] ? 0.40 : 0.25;
          if (Math.random() < burstChance) {
            hadCrit = true;
            if (up['44'] && Math.random() < 0.20) {
              pulseGain = 9; // 900% 极速级联裂变
            } else {
              pulseGain = 3; // 300% 爆发脉冲
            }
            // #53 临界超载检测: 爆发时 50% 概率进入 3 秒过载
            if (up['53'] && Math.random() < 0.50) {
              this.alphaOverloadTimer = 3.0;
            }
          }
        }

        this.alpha += pulseGain;
        this.totalAlphaEarned += pulseGain;
        ticked = true;
      }

      if (ticked) {
        this.triggerAlphaPulse(hadCrit);
      }

      // 恰好在当帧突破 1000 点时，将剩余的残余计时器折算为连续增量
      if (this.alpha > 1000 && this.alphaTickTimer > 0) {
        const surplus = this.alphaTickTimer * rate;
        this.alpha += surplus;
        this.totalAlphaEarned += surplus;
        this.alphaTickTimer = 0;
      }
    } else {
      // 突破 1000 点后，平滑连续累加
      const delta = rate * dt;
      this.alpha += delta;
      this.totalAlphaEarned += delta;
      this.alphaTickTimer = 0;

      // 在连续模式下抽样触发 #53 临界超载
      if (up['53'] && up['33'] && this.alphaOverloadTimer <= 0) {
        const pulseFreq = 1.0 / this.getAlphaPulseInterval();
        const burstChance = up['44'] ? 0.40 : 0.25;
        if (Math.random() < pulseFreq * burstChance * 0.50 * dt) {
          this.alphaOverloadTimer = 3.0;
        }
      }
    }
  }

  // 执行第一层底层重置：维度坍缩 (兑现 β 贝塔，保留 #11 与 #21)
  collapseDimension() {
    const pendingBeta = Math.max(1, this.getPendingBeta());
    this.beta = (this.beta || 0) + pendingBeta;
    this.totalBetaEarned = (this.totalBetaEarned || 0) + pendingBeta;
    this.betaUnlocked = true;

    // 清空持有量与本树除 #11、#21 外的所有升级
    this.alpha = 0;
    this.alphaTickTimer = 0;
    this.alphaIdleTimer = 0;
    this.alphaOverloadTimer = 0;
    this.untitledUpgrades = {
      '11': true,
      '21': true,
      '31': false, '32': false, '33': false,
      '41': false, '42': false, '43': false, '44': false,
      '51': false, '52': false, '53': false,
      '61': false, '62': false, '71': false
    };

    this.showToast(`🌌 维度坍缩跃迁完成！获得 +${pendingBeta} β (贝塔)，已保留 #11 与 #21！`, 'success');
    this.renderUntitledTreeUI();
    this.updateUntitledRealtimeUI();
    if (window.SaveSystem) {
      window.SaveSystem.saveToLocalStorage(this);
    }
  }

  // 购买/研发无标题升级节点
  buyUntitledUpgrade(id) {
    // 视口拖拽移动中不触发点击购买
    if (this.untitledViewport && this.untitledViewport.hasMoved) return;

    const node = this.getUntitledNodeById(id);
    if (!node) return;

    if (this.untitledUpgrades && this.untitledUpgrades[id]) {
      this.showToast(`升级【${node.code} ${node.name}】已激活`, 'info');
      return;
    }

    // 验证前置节点解锁依赖
    if (node.requires && node.requires.length > 0) {
      for (const reqId of node.requires) {
        if (!this.untitledUpgrades || !this.untitledUpgrades[reqId]) {
          const reqNode = this.getUntitledNodeById(reqId);
          const reqName = reqNode ? `${reqNode.code} ${reqNode.name}` : `#${reqId}`;
          this.showToast(`🔒 尚未解锁前置升级【${reqName}】`, 'warning');
          return;
        }
      }
    }

    // 验证费用
    const cost = node.cost || 0;
    if ((this.alpha || 0) < cost) {
      this.showToast(`阿尔法不足：升级【${node.code} ${node.name}】需要 ${this.formatAlphaCost(cost)} α，当前拥有 ${this.formatAlpha(this.alpha)} α`, 'warning');
      return;
    }

    // 若购买终点 #71 维度坍缩，弹出跃迁确认
    if (id === '71') {
      if (confirm('【维度坍缩跃迁】确定要执行第一层底层重置吗？\n清空当前持有量 α 及本树升级，正式兑现第二阶货币 β；重置后将永久保留 #11 与 #21，开启第二层级！')) {
        this.collapseDimension();
      }
      return;
    }

    // 扣减费用并记录已激活
    this.alpha = Math.max(0, (this.alpha || 0) - cost);
    if (!this.untitledUpgrades) this.untitledUpgrades = {};
    this.untitledUpgrades[id] = true;

    if (id === '11') {
      this.showToast(`🎉 成功激活【#11 开始吧】！始源阿尔法脉冲开启律动 (+1.0 α/秒，每 1.0 秒 +1 α)！`, 'success');
    } else if (id === '21') {
      this.showToast(`🎉 成功激活【#21 ${node.name}】！#11 效果翻倍至 +2.0 α/秒 (每 0.5 秒 +1 α)！`, 'success');
    } else {
      this.showToast(`🎉 成功激活【${node.code} ${node.name}】！`, 'success');
    }

    this.renderUntitledTreeUI();
    this.updateUntitledRealtimeUI();
    if (window.SaveSystem) {
      window.SaveSystem.saveToLocalStorage(this);
    }
  }

  // 获取节点实时动态效果展示文字
  getNodeEffectLiveDesc(node) {
    const up = this.untitledUpgrades || {};
    const alphaVal = Math.max(0, this.alpha || 0);

    if (node.id === '11') {
      return '+1.0 α/秒 (每 1.0 秒 +1 α)';
    }
    if (node.id === '21') {
      return '#11 效果翻倍 (+2.0 α/秒，每 0.5 秒 +1 α)';
    }
    if (node.id === '31') {
      const logFactor = up['41'] ? 0.65 : 0.35;
      const mult = (1.0 + logFactor * Math.log10(alphaVal + 1)).toFixed(2);
      return `动态对数倍率: ×${mult} (1 + ${logFactor} × log10(α + 1))`;
    }
    if (node.id === '32') {
      return '基础生产间隔缩短至 0.35 秒 (产出频率 +42.8%)';
    }
    if (node.id === '33') {
      return '每次发放产能有 25% 概率触发 300% 爆发脉冲';
    }
    if (node.id === '41') {
      const activeText = alphaVal >= 1000 ? ' · 基础 +2.0 α/秒已生效' : ' · α ≥ 1,000 时基础 +2.0 α/秒';
      return `#31 系数升至 0.65${activeText}`;
    }
    if (node.id === '42') {
      const curT = this.getAlphaPulseInterval().toFixed(2);
      return `生产周期 T = ${curT}s (T_base × (α + 10)^-0.03，下限 0.10s)`;
    }
    if (node.id === '43') {
      const k = Object.values(up).filter(Boolean).length;
      const mult = Math.pow(1.15, k).toFixed(2);
      return `每激活 1 节点独立乘算 ×1.15 (当前加成: ×${mult}，1.15^${k})`;
    }
    if (node.id === '44') {
      return '#33 爆发概率升至 40%；爆发时 20% 概率二次裂变 (900%)';
    }
    if (node.id === '51') {
      const idleSec = Math.floor(this.alphaIdleTimer || 0);
      const mult = (1 + 0.30 * Math.pow(idleSec + 1, 0.38)).toFixed(2);
      return `静置爬坡加成: ×${mult} (${idleSec}s) · 离线收益 100%`;
    }
    if (node.id === '52') {
      const valA = Math.max(1, Math.log10(alphaVal + 10));
      const valB = Math.max(1, Math.log10(this.getAlphaRate() + 10));
      const mult = Math.sqrt(valA * valB).toFixed(2);
      return `双变量几何共振倍率: ×${mult}`;
    }
    if (node.id === '53') {
      const overloadActive = this.alphaOverloadTimer > 0;
      return `爆发时 50% 概率 3s 超载 (频率 +100%)${overloadActive ? ` · 🔥 超载中 (${this.alphaOverloadTimer.toFixed(1)}s)` : ''}`;
    }
    if (node.id === '61') {
      return '瞬时秒产 ≥ 10^7 时，软上限衰减指数由 0.50 重整化为 0.75';
    }
    if (node.id === '62') {
      const pBeta = this.getPendingBeta();
      return `预演算待获取: +${pBeta} β · 每点待获取 β 反哺产出 +250%`;
    }
    if (node.id === '71') {
      return '第一阶底层重置：兑现 β 开启第二层级，保留 #11 & #21';
    }
    return node.effectDesc;
  }

  // 渲染无标题升级树主界面结构与各行节点
  renderUntitledTreeUI() {
    const container = document.getElementById('untitled-tree-nodes-container');
    if (!container) return;

    const nodes = this.getUntitledNodes();
    // 按行分组
    const rowsMap = new Map();
    nodes.forEach(node => {
      if (!rowsMap.has(node.row)) rowsMap.set(node.row, []);
      rowsMap.get(node.row).push(node);
    });

    let html = '';
    const sortedRowKeys = Array.from(rowsMap.keys()).sort((a, b) => a - b);

    sortedRowKeys.forEach(rowKey => {
      const rowNodes = rowsMap.get(rowKey);
      html += `<div class="untitled-tree-row" data-row="${rowKey}">`;

      rowNodes.forEach(node => {
        const isPurchased = !!(this.untitledUpgrades && this.untitledUpgrades[node.id]);
        let isUnlocked = true;
        let missingReqNames = [];

        if (node.requires && node.requires.length > 0) {
          for (const reqId of node.requires) {
            if (!this.untitledUpgrades || !this.untitledUpgrades[reqId]) {
              isUnlocked = false;
              const reqNode = this.getUntitledNodeById(reqId);
              missingReqNames.push(reqNode ? `${reqNode.code}` : `#${reqId}`);
            }
          }
        }

        const cost = node.cost || 0;
        const canAfford = (this.alpha || 0) >= cost;

        let cardClass = 'untitled-node-card';
        let targetState = 'unaffordable';
        if (isPurchased) {
          cardClass += ' purchased';
          targetState = 'purchased';
        } else if (!isUnlocked) {
          cardClass += ' locked';
          targetState = 'locked';
        } else if (canAfford) {
          cardClass += ' can-buy';
          targetState = 'can-buy';
        } else {
          cardClass += ' unaffordable';
          targetState = 'unaffordable';
        }

        let btnDisabled = true;
        let btnText = '';
        if (isPurchased) {
          btnText = '✓ 已激活';
          btnDisabled = true;
        } else if (!isUnlocked) {
          btnText = `🔒 需先激活 ${missingReqNames.join(', ')}`;
          btnDisabled = true;
        } else if (canAfford) {
          btnText = node.id === '71'
            ? '🌌 执行维度坍缩'
            : (cost === 0 ? '✨ 免费激活' : `⚡ 研发 (${this.formatAlphaCost(cost)} α)`);
          btnDisabled = false;
        } else {
          const diff = Math.ceil(cost - (this.alpha || 0));
          btnText = `需 ${this.formatAlphaCost(cost)} α (缺 ${this.formatAlphaCost(diff)} α)`;
          btnDisabled = true;
        }

        const btnHtml = `<button class="btn-untitled-node ${targetState}" data-id="${node.id}" ${btnDisabled ? 'disabled' : ''}><span class="btn-untitled-text">${btnText}</span></button>`;
        const liveEffect = this.getNodeEffectLiveDesc(node);

        html += `
          <div class="${cardClass}" id="untitled-node-${node.id}" data-id="${node.id}" data-cost="${cost}">
            <div class="untitled-node-header">
              <div class="untitled-node-badge-col">
                <span class="untitled-node-code">${node.code}</span>
                <h4 class="untitled-node-name">${node.name}</h4>
              </div>
              <span class="untitled-node-status-icon">${isPurchased ? '✓' : (isUnlocked ? '✨' : '🔒')}</span>
            </div>
            <p class="untitled-node-desc">${node.desc}</p>
            <div class="untitled-node-effect-pill" id="untitled-effect-${node.id}">
              <span class="effect-icon">⚡</span>
              <span class="effect-text">${liveEffect}</span>
            </div>
            <div class="untitled-node-footer">
              <span class="untitled-node-cost-tag">${cost === 0 ? '免费升级' : `花费: ${this.formatAlphaCost(cost)} α`}</span>
              ${btnHtml}
            </div>
          </div>
        `;
      });

      html += `</div>`;
    });

    container.innerHTML = html;

    // 建立 DOM 元素缓存字典，避免每帧 querySelector 重复查询
    this._untitledDomCache = {};
    nodes.forEach(node => {
      const card = document.getElementById(`untitled-node-${node.id}`);
      if (card) {
        const btn = card.querySelector('.btn-untitled-node');
        const isPurchased = !!(this.untitledUpgrades && this.untitledUpgrades[node.id]);
        const cost = node.cost || 0;
        const canAfford = (this.alpha || 0) >= cost;
        let isUnlocked = true;
        if (node.requires && node.requires.length > 0) {
          for (const reqId of node.requires) {
            if (!this.untitledUpgrades || !this.untitledUpgrades[reqId]) {
              isUnlocked = false;
              break;
            }
          }
        }
        const state = isPurchased ? 'purchased' : (!isUnlocked ? 'locked' : (canAfford ? 'can-buy' : 'unaffordable'));

        this._untitledDomCache[node.id] = {
          card: card,
          statusIcon: card.querySelector('.untitled-node-status-icon'),
          effectText: card.querySelector('.effect-text'),
          btn: btn,
          btnText: card.querySelector('.btn-untitled-text'),
          state: state
        };

        if (btn && state === 'can-buy') {
          btn._hasListener = true;
          btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            this.buyUntitledUpgrade(id);
          });
        }
      }
    });

    // 即时绘制 SVG 连接线
    requestAnimationFrame(() => this.drawUntitledConnections());
    setTimeout(() => this.drawUntitledConnections(), 80);
    setTimeout(() => this.drawUntitledConnections(), 250);
  }

  // 绘制无标题各行升级节点间的 SVG 连线 (下一行连至上一行对应前置节点)
  drawUntitledConnections() {
    const svg = document.getElementById('untitled-tree-svg');
    const canvas = document.getElementById('untitled-tree-canvas');
    if (!svg || !canvas) return;

    const canvasWidth = (this.untitledViewport && this.untitledViewport.canvasWidth) || 2600;
    const canvasHeight = (this.untitledViewport && this.untitledViewport.canvasHeight) || 2600;

    svg.setAttribute('width', canvasWidth);
    svg.setAttribute('height', canvasHeight);

    const cRect = canvas.getBoundingClientRect();
    if (cRect.width === 0 || cRect.height === 0) return;

    const scale = (this.untitledViewport && this.untitledViewport.scale) || 1.0;

    const nodes = this.getUntitledNodes();
    let pathsHtml = '';

    nodes.forEach(node => {
      if (!node.requires || node.requires.length === 0) return;
      const targetCard = document.getElementById(`untitled-node-${node.id}`);
      if (!targetCard) return;

      const tRect = targetCard.getBoundingClientRect();
      const x2 = Math.round((tRect.left + tRect.width / 2 - cRect.left) / scale);
      const y2 = Math.round((tRect.top - cRect.top) / scale);

      node.requires.forEach(reqId => {
        const sourceCard = document.getElementById(`untitled-node-${reqId}`);
        if (!sourceCard) return;

        const sRect = sourceCard.getBoundingClientRect();
        const x1 = Math.round((sRect.left + sRect.width / 2 - cRect.left) / scale);
        const y1 = Math.round((sRect.bottom - cRect.top) / scale);

        const isParentPurchased = !!(this.untitledUpgrades && this.untitledUpgrades[reqId]);
        const cy1 = y1 + (y2 - y1) * 0.5;
        const cy2 = y1 + (y2 - y1) * 0.5;
        const d = Math.abs(x1 - x2) < 2
          ? `M ${x1} ${y1} L ${x2} ${y2}`
          : `M ${x1} ${y1} C ${x1} ${cy1}, ${x2} ${cy2}, ${x2} ${y2}`;

        if (isParentPurchased) {
          // 前置已解锁：纯矢量双层霓虹流动连线 (以一层低透明宽描边提供高能光晕，无须昂贵的 CSS drop-shadow 滤镜，缩放至 45% 零卡顿零闪烁)
          pathsHtml += `
            <path d="${d}" 
                  fill="none" 
                  stroke="rgba(52, 211, 153, 0.22)" 
                  stroke-width="7" 
                  stroke-linecap="round" />
            <path d="${d}" 
                  fill="none" 
                  stroke="#34d399" 
                  stroke-width="3" 
                  stroke-linecap="round"
                  class="untitled-svg-line-active" />
            <circle cx="${x1}" cy="${y1}" r="4" fill="#34d399" />
            <circle cx="${x2}" cy="${y2}" r="4" fill="#10b981" />
          `;
        } else {
          // 前置未解锁：灰色半透明虚线
          pathsHtml += `
            <path d="${d}" 
                  fill="none" 
                  stroke="rgba(148, 163, 184, 0.35)" 
                  stroke-width="2" 
                  stroke-linecap="round" 
                  stroke-dasharray="6,4" 
                  class="untitled-svg-line-locked" />
            <circle cx="${x1}" cy="${y1}" r="3" fill="rgba(148, 163, 184, 0.4)" />
            <circle cx="${x2}" cy="${y2}" r="3" fill="rgba(148, 163, 184, 0.4)" />
          `;
        }
      });
    });

    svg.innerHTML = pathsHtml;
  }

  // 实时高频更新无标题面板 HUD 与节点状态 (停留在该子界面时毫秒级驱动)
  updateUntitledRealtimeUI() {
    const subviewUntitled = this.getEl('subview-untitled');
    if (!subviewUntitled || subviewUntitled.style.display === 'none') return;

    const rate = this.getAlphaRate();
    const alphaVal = this.alpha || 0;
    const totalVal = this.totalAlphaEarned || 0;

    // 1. 阿尔法储备量
    this.setDomText('alpha-amount-display', this.formatAlpha(alphaVal));

    // 2. 产出速率
    this.setDomText('alpha-rate-display', `+${this.formatAlpha(rate)} α/秒`);

    // 3. 累计历史获取
    this.setDomText('alpha-total-display', `${this.formatAlpha(totalVal)} α`);

    // 4. 单点步进节奏提示文本
    const cadenceTextEl = this.getEl('alpha-cadence-text');
    if (cadenceTextEl) {
      if (rate <= 0) {
        cadenceTextEl.textContent = '未激活 (需购买 #11)';
      } else if (alphaVal <= 1000) {
        const interval = 1.0 / rate;
        const intervalStr = interval.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
        cadenceTextEl.textContent = `每 ${intervalStr} 秒 +1 α`;
      } else {
        cadenceTextEl.textContent = `连续产出 (+${this.formatAlpha(rate)} α/秒)`;
      }
    }

    // 5. 临界超载指示徽章
    const overloadBadge = document.getElementById('untitled-overload-badge');
    const overloadTimeEl = document.getElementById('untitled-overload-time');
    if (overloadBadge && overloadTimeEl) {
      if ((this.alphaOverloadTimer || 0) > 0) {
        overloadBadge.style.display = 'inline-flex';
        overloadTimeEl.textContent = `${this.alphaOverloadTimer.toFixed(1)}s`;
      } else {
        overloadBadge.style.display = 'none';
      }
    }

    // 6. 贝塔 (β) 徽章与预演算指示
    const betaBadge = document.getElementById('untitled-beta-badge');
    const betaTextEl = document.getElementById('untitled-beta-text');
    if (betaBadge && betaTextEl) {
      const pendingBeta = this.getPendingBeta();
      if ((this.untitledUpgrades && this.untitledUpgrades['62']) || (this.beta || 0) > 0 || this.betaUnlocked) {
        betaBadge.style.display = 'inline-flex';
        betaTextEl.textContent = `持有 ${this.beta || 0} β (待兑现: +${pendingBeta} β)`;
      } else {
        betaBadge.style.display = 'none';
      }
    }

    // 7. 实时更新各节点的可负担/可研发状态与动态效果文字
    this.updateUntitledNodesStatus();
  }

  // 实时脏检查更新无标题节点卡片的按键状态与动态数值 (高性能 DOM 缓存 + 纯 textContent 局部更新，消除 innerHTML 重建与样式抖动)
  updateUntitledNodesStatus() {
    if (!this._untitledDomCache) return;

    const nodes = this.getUntitledNodes();
    const curAlpha = this.alpha || 0;

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const cache = this._untitledDomCache[node.id];
      if (!cache || !cache.card) continue;

      // 1. 实时更新动态效果文字 (仅当文字变化时改动 textContent，零 innerHTML)
      if (cache.effectText) {
        const liveDesc = this.getNodeEffectLiveDesc(node);
        if (cache.effectText.textContent !== liveDesc) {
          cache.effectText.textContent = liveDesc;
        }
      }

      const isPurchased = !!(this.untitledUpgrades && this.untitledUpgrades[node.id]);
      if (isPurchased) continue; // 已激活则跳过按键状态变更

      let isUnlocked = true;
      let missingReqNames = [];
      if (node.requires && node.requires.length > 0) {
        for (let j = 0; j < node.requires.length; j++) {
          const reqId = node.requires[j];
          if (!this.untitledUpgrades || !this.untitledUpgrades[reqId]) {
            isUnlocked = false;
            const reqNode = this.getUntitledNodeById(reqId);
            missingReqNames.push(reqNode ? reqNode.code : `#${reqId}`);
          }
        }
      }

      const cost = node.cost || 0;
      const canAfford = curAlpha >= cost;
      const targetState = !isUnlocked ? 'locked' : (canAfford ? 'can-buy' : 'unaffordable');

      // 仅当状态改变时切换 class 与 disabled，杜绝每帧样式重排
      if (cache.state !== targetState) {
        cache.state = targetState;
        cache.card.className = `untitled-node-card ${targetState}`;
        if (cache.btn) {
          cache.btn.className = `btn-untitled-node ${targetState}`;
          cache.btn.disabled = targetState !== 'can-buy';
          if (targetState === 'can-buy' && !cache.btn._hasListener) {
            cache.btn._hasListener = true;
            cache.btn.addEventListener('click', () => this.buyUntitledUpgrade(node.id));
          }
        }
        if (cache.statusIcon) {
          cache.statusIcon.textContent = !isUnlocked ? '🔒' : '✨';
        }
      }

      // 更新按钮内文字 (仅改动 textContent，绝不调用 innerHTML 销毁重建 DOM)
      if (cache.btnText) {
        let expectedBtnText = '';
        if (!isUnlocked) {
          expectedBtnText = `🔒 需先激活 ${missingReqNames.join(', ')}`;
        } else if (canAfford) {
          expectedBtnText = node.id === '71'
            ? '🌌 执行维度坍缩'
            : (cost === 0 ? '✨ 免费激活' : `⚡ 研发 (${this.formatAlphaCost(cost)} α)`);
        } else {
          const diff = Math.ceil(cost - curAlpha);
          expectedBtnText = `需 ${this.formatAlphaCost(cost)} α (缺 ${this.formatAlphaCost(diff)} α)`;
        }
        if (cache.btnText.textContent !== expectedBtnText) {
          cache.btnText.textContent = expectedBtnText;
        }
      }
    }
  }

  // 应用无标题画布当前的平移与缩放矩阵 (纯 2D GPU 硬件加速，像素取整消除亚像素高频抖动)
  applyUntitledTransform() {
    const canvas = document.getElementById('untitled-tree-canvas');
    if (!canvas) return;
    const vp = this.untitledViewport;
    const px = Math.round(vp.panX);
    const py = Math.round(vp.panY);
    const sc = Number(vp.scale.toFixed(3));
    canvas.style.transform = `translate(${px}px, ${py}px) scale(${sc})`;
    const zoomText = document.getElementById('untitled-zoom-level-text');
    if (zoomText) {
      zoomText.textContent = `${Math.round(vp.scale * 100)}%`;
    }
  }

  // 缩放无标题视口画布 (以指定焦点 focalX, focalY 为中心或以视口中心缩放)
  zoomUntitledViewport(factor, focalX, focalY) {
    const vp = this.untitledViewport;
    const oldScale = vp.scale;
    let newScale = oldScale * factor;
    newScale = Math.max(vp.minScale, Math.min(vp.maxScale, newScale));
    if (Math.abs(newScale - oldScale) < 0.001) return;

    const container = document.getElementById('untitled-viewport-container');
    if (!container) return;

    if (focalX === undefined || focalY === undefined) {
      const rect = container.getBoundingClientRect();
      focalX = rect.width / 2;
      focalY = rect.height / 2;
    }

    // 几何缩放不变量：保持光标或视口中心指向的画布物理坐标在屏幕上位置不变
    vp.panX = focalX - (focalX - vp.panX) * (newScale / oldScale);
    vp.panY = focalY - (focalY - vp.panY) * (newScale / oldScale);
    vp.scale = newScale;

    this.applyUntitledTransform();
  }

  // 重置/聚焦无标题升级树核心根节点
  recenterUntitledTree(targetScale) {
    const container = document.getElementById('untitled-viewport-container');
    const vp = this.untitledViewport;
    if (targetScale !== undefined) {
      vp.scale = Math.max(vp.minScale, Math.min(vp.maxScale, targetScale));
    }

    const vWidth = container ? container.clientWidth : 800;

    // 水平居中画布中心 (2400 / 2 = 1200)
    vp.panX = Math.round(vWidth / 2 - (vp.canvasWidth / 2) * vp.scale);
    // 垂直将根节点 #11 (y ≈ 180) 优雅定格在视口上方留白区
    vp.panY = Math.round(70 - 180 * vp.scale);

    this.applyUntitledTransform();
    requestAnimationFrame(() => this.drawUntitledConnections());
  }

  // 初始化无标题视口交互控制器 (拖拽平移、滚轮缩放、移动端单指平移与双指捏合缩放、快捷控件)
  initUntitledViewport() {
    const container = document.getElementById('untitled-viewport-container');
    if (!container) return;

    const vp = this.untitledViewport;
    vp.initialized = true;

    // 1. 鼠标按下开始拖拽
    container.addEventListener('mousedown', (e) => {
      if (e.target.closest('.untitled-viewport-controls')) return;

      vp.isDragging = true;
      vp.startX = e.clientX;
      vp.startY = e.clientY;
      vp.initialPanX = vp.panX;
      vp.initialPanY = vp.panY;
      vp.hasMoved = false;
      container.classList.add('is-dragging');
    });

    window.addEventListener('mousemove', (e) => {
      if (!vp.isDragging) return;
      const dx = e.clientX - vp.startX;
      const dy = e.clientY - vp.startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        vp.hasMoved = true;
      }
      vp.panX = vp.initialPanX + dx;
      vp.panY = vp.initialPanY + dy;
      this.applyUntitledTransform();
    });

    window.addEventListener('mouseup', () => {
      if (vp.isDragging) {
        vp.isDragging = false;
        container.classList.remove('is-dragging');
        setTimeout(() => {
          vp.hasMoved = false;
        }, 80);
      }
    });

    // 2. 滚轮以鼠标指针所在位置为中心缩放
    container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const focalX = e.clientX - rect.left;
      const focalY = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      this.zoomUntitledViewport(factor, focalX, focalY);
    }, { passive: false });

    // 3. 触摸屏手势 (单指平移 & 双指缩放)
    container.addEventListener('touchstart', (e) => {
      if (e.target.closest('.untitled-viewport-controls')) return;

      if (e.touches.length === 1) {
        const touch = e.touches[0];
        vp.isDragging = true;
        vp.isPinching = false;
        vp.startX = touch.clientX;
        vp.startY = touch.clientY;
        vp.initialPanX = vp.panX;
        vp.initialPanY = vp.panY;
        vp.hasMoved = false;
      } else if (e.touches.length === 2) {
        vp.isDragging = false;
        vp.isPinching = true;
        vp.hasMoved = true;
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        vp.initialPinchDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        vp.initialPinchScale = vp.scale;
        const rect = container.getBoundingClientRect();
        vp.pinchMidX = (t1.clientX + t2.clientX) / 2 - rect.left;
        vp.pinchMidY = (t1.clientY + t2.clientY) / 2 - rect.top;
      }
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
      if (vp.isPinching && e.touches.length === 2) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        if (vp.initialPinchDist > 0) {
          const ratio = dist / vp.initialPinchDist;
          const targetScale = Math.max(vp.minScale, Math.min(vp.maxScale, vp.initialPinchScale * ratio));
          const oldScale = vp.scale;
          if (Math.abs(targetScale - oldScale) > 0.002) {
            vp.panX = vp.pinchMidX - (vp.pinchMidX - vp.panX) * (targetScale / oldScale);
            vp.panY = vp.pinchMidY - (vp.pinchMidY - vp.panY) * (targetScale / oldScale);
            vp.scale = targetScale;
            this.applyUntitledTransform();
          }
        }
      } else if (vp.isDragging && e.touches.length === 1) {
        const touch = e.touches[0];
        const dx = touch.clientX - vp.startX;
        const dy = touch.clientY - vp.startY;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
          vp.hasMoved = true;
        }
        vp.panX = vp.initialPanX + dx;
        vp.panY = vp.initialPanY + dy;
        this.applyUntitledTransform();
      }
    }, { passive: false });

    const endTouch = () => {
      vp.isDragging = false;
      vp.isPinching = false;
      setTimeout(() => {
        vp.hasMoved = false;
      }, 80);
    };
    container.addEventListener('touchend', endTouch, { passive: true });
    container.addEventListener('touchcancel', endTouch, { passive: true });

    // 4. 浮动控件按键绑定
    const btnZoomIn = document.getElementById('btn-untitled-zoom-in');
    const btnZoomOut = document.getElementById('btn-untitled-zoom-out');
    const btnZoomReset = document.getElementById('btn-untitled-zoom-reset');
    const btnRecenter = document.getElementById('btn-untitled-recenter');

    if (btnZoomIn) {
      btnZoomIn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.zoomUntitledViewport(1.2);
      });
    }
    if (btnZoomOut) {
      btnZoomOut.addEventListener('click', (e) => {
        e.stopPropagation();
        this.zoomUntitledViewport(0.833);
      });
    }
    if (btnZoomReset) {
      btnZoomReset.addEventListener('click', (e) => {
        e.stopPropagation();
        this.recenterUntitledTree(1.0);
      });
    }
    if (btnRecenter) {
      btnRecenter.addEventListener('click', (e) => {
        e.stopPropagation();
        this.recenterUntitledTree(this.untitledViewport.scale);
      });
    }

    // 5. 窗口尺寸调整时更新连线
    window.addEventListener('resize', () => {
      if (this.currentTreeSubview === 'untitled') {
        this.drawUntitledConnections();
      }
    });

    // 初始应用变换并聚焦
    this.recenterUntitledTree();
  }
}

// 页面 DOM 加载完成后启动游戏
document.addEventListener('DOMContentLoaded', () => {
  const game = new CoffeeCapitalGame();
  window.GameInstance = game;
  game.init();
});
