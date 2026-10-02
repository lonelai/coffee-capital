/**
 * save.js - 本地存储、离线挂机进度补偿引擎与 Base64 导入导出系统
 */

window.SaveSystem = (function() {
  const SAVE_STORAGE_KEY = 'coffee_capital_save_v1';
  let autoSaveTimer = null;
  let isResetting = false;

  // UTF-8 安全的字符串转 Base64
  function utf8ToBase64(str) {
    return window.btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function toSolidBytes(match, p1) {
      return String.fromCharCode('0x' + p1);
    }));
  }

  // Base64 安全解码为 UTF-8 字符串
  function base64ToUtf8(b64) {
    return decodeURIComponent(atob(b64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
  }

  // 获取序列化游戏状态
  function serializeGameState(game) {
    return {
      version: 1,
      gameVersion: game.version || 'a0.8.0',
      r: game.r,
      fp: game.fp,
      ce: game.ce,
      coffeeStock: game.coffeeStock,
      totalCoffeeSold: game.totalCoffeeSold,
      runCoffeeSold: game.runCoffeeSold !== undefined ? game.runCoffeeSold : 0,
      totalRevenueEarned: game.totalRevenueEarned,
      filterCount: game.dripFilters.length,
      frequencyUpgradeLevel: game.frequencyUpgradeLevel || 0,
      autoDripEnabled: game.autoDripEnabled !== false,
      upgradesPurchased: game.upgradesPurchased || {},
      achievementsUnlocked: game.achievementsUnlocked || {},
      ep: Math.max(0, game.ep || 0),
      totalEpEarned: Math.max(0, game.totalEpEarned || 0),
      epResetsCount: Math.max(0, game.epResetsCount || 0),
      epUpgrades: game.epUpgrades || { notes: false, autoDrip: false, freshGround: false, agitator: false },
      epPricingLevel: Math.max(0, game.epPricingLevel || 0),
      dailyUnlocked: !!game.dailyUnlocked || ((game.totalEpEarned || 0) >= 1.0),
      dp: Math.max(0, game.dp || 0),
      totalDpClaimed: Math.max(0, game.totalDpClaimed || 0),
      lastDailyClaimTime: game.lastDailyClaimTime || 0,
      dpInvestments: game.dpInvestments || { price: 0, ep: 0 },
      alpha: Math.max(0, game.alpha || 0),
      totalAlphaEarned: Math.max(0, game.totalAlphaEarned || 0),
      untitledUpgrades: game.untitledUpgrades || {},
      beta: Math.max(0, game.beta || 0),
      totalBetaEarned: Math.max(0, game.totalBetaEarned || 0),
      betaUnlocked: !!game.betaUnlocked,
      alphaIdleTimer: Math.max(0, game.alphaIdleTimer || 0),
      theme: game.theme || 'cyber',
      autoSaveInterval: game.autoSaveInterval || 10,
      lastSaveTime: Date.now()
    };
  }

  // 写入 LocalStorage
  function saveToLocalStorage(game, showNotice = false) {
    if (isResetting) return false;
    try {
      const data = serializeGameState(game);
      const jsonStr = JSON.stringify(data);
      localStorage.setItem(SAVE_STORAGE_KEY, jsonStr);

      const timeEl = document.getElementById('last-saved-time');
      if (timeEl) {
        const d = new Date();
        timeEl.textContent = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
      }

      if (showNotice) {
        game.showToast('💾 游戏进度已成功保存在浏览器中', 'success');
      }
      return true;
    } catch (e) {
      console.error('Save failed:', e);
      if (showNotice) {
        game.showToast('❌ 保存失败：浏览器存储异常', 'error');
      }
      return false;
    }
  }

  // 从 LocalStorage 加载
  function loadFromLocalStorage(game) {
    try {
      const raw = localStorage.getItem(SAVE_STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      return applyLoadedData(game, data);
    } catch (e) {
      console.error('Load failed:', e);
      return false;
    }
  }

  // 应用已加载的数据对象到游戏状态
  function applyLoadedData(game, data) {
    if (!data || typeof data.r !== 'number') return false;

    game.r = Math.max(0, data.r);
    game.fp = Math.max(0, data.fp || 0);
    game.ce = Math.max(0, data.ce || 0);
    game.debt = 0;
    game.coffeeStock = Math.max(0, data.coffeeStock || 0);
    game.totalCoffeeSold = data.totalCoffeeSold || 0;
    game.totalRevenueEarned = data.totalRevenueEarned || 0;
    // 若为未售出首杯咖啡的初始纯新档且资金小于 11.2，自动修正为 11.2 (购买 1 台滴滤器 ¥10 + 制作首杯咖啡 ¥1.2)
    if (game.totalCoffeeSold === 0 && (!data.filterCount || data.filterCount === 0) && game.r < 11.2) {
      game.r = 11.2;
    }
    // 若已买 1 台滴滤器尚未售出首杯，若资金受浮点误差影响接近 1.2，修正为精准 1.20
    if (game.totalCoffeeSold === 0 && data.filterCount === 1 && Math.abs(game.r - 1.2) < 0.05) {
      game.r = 1.2;
    }
    game.totalDebtRepaid = 0;
    game.frequencyUpgradeLevel = Math.max(0, data.frequencyUpgradeLevel || 0);
    game.autoDripEnabled = data.autoDripEnabled !== undefined ? !!data.autoDripEnabled : true;

    game.upgradesPurchased = data.upgradesPurchased || {};
    game.achievementsUnlocked = data.achievementsUnlocked || {};
    game.runCoffeeSold = data.runCoffeeSold !== undefined ? data.runCoffeeSold : ((data.r <= 11.25 && (data.coffeeStock || 0) === 0) ? 0 : (game.totalCoffeeSold || 0));

    game.ep = Math.max(0, data.ep || 0);
    game.totalEpEarned = Math.max(0, data.totalEpEarned || 0);
    game.epResetsCount = Math.max(0, data.epResetsCount || 0);
    game.epUpgrades = data.epUpgrades || { notes: false, autoDrip: false, freshGround: false, agitator: false };
    if (data.upgradesPurchased && data.upgradesPurchased['god']) {
      game.epUpgrades.autoDrip = true;
    }
    game.autoDripUnlocked = !!(game.epUpgrades && game.epUpgrades.autoDrip);
    game.epPricingLevel = Math.max(0, data.epPricingLevel || 0);

    // 每日签到系统状态恢复
    game.dailyUnlocked = !!data.dailyUnlocked || (game.totalEpEarned >= 1.0) || ((data.totalEpEarned || 0) >= 1.0);
    game.dp = Math.max(0, data.dp || 0);
    game.totalDpClaimed = Math.max(0, data.totalDpClaimed || 0);
    game.lastDailyClaimTime = Number(data.lastDailyClaimTime) || 0;
    game.dpInvestments = data.dpInvestments || { price: 0, ep: 0 };
    if (!game.dpInvestments.price) game.dpInvestments.price = 0;
    if (!game.dpInvestments.ep) game.dpInvestments.ep = 0;

    // 无标题升级树与 α (阿尔法) / β (贝塔) 状态恢复
    game.alpha = Math.max(0, data.alpha || 0);
    game.totalAlphaEarned = Math.max(0, data.totalAlphaEarned || 0);
    game.untitledUpgrades = Object.assign({
      '11': false, '21': false, '31': false, '32': false, '33': false,
      '41': false, '42': false, '43': false, '44': false,
      '51': false, '52': false, '53': false,
      '61': false, '62': false, '71': false
    }, data.untitledUpgrades || {});
    game.beta = Math.max(0, data.beta || 0);
    game.totalBetaEarned = Math.max(0, data.totalBetaEarned || 0);
    game.betaUnlocked = !!data.betaUnlocked;
    game.alphaIdleTimer = Math.max(0, data.alphaIdleTimer || 0);

    // 加载自动保存频率配置 (默认 10 秒，支持 5s/10s/20s/30s)
    const validIntervals = [5, 10, 20, 30];
    game.autoSaveInterval = validIntervals.includes(Number(data.autoSaveInterval)) ? Number(data.autoSaveInterval) : 10;

    // 恢复视觉主题风格 (深空磨砂 / 小米澎湃 Miuix)
    if (data.theme) {
      game.theme = (data.theme === 'miuix') ? 'miuix' : 'cyber';
      if (typeof game.setTheme === 'function') {
        game.setTheme(game.theme, false);
      }
    }

    // 重新应用科技树已激活节点
    if (window.TreeSystem) {
      window.TreeSystem.recalculateAllUpgrades(game);
    }

    // 重构滴滤器数组
    const targetFilterCount = Math.min(10, Math.max(0, data.filterCount || 0));
    game.dripFilters = [];
    for (let i = 0; i < targetFilterCount; i++) {
      game.dripFilters.push({
        id: i + 1,
        progress: 0,
        isBrewing: false,
        isAuto: !!(game.autoDripUnlocked && game.autoDripEnabled)
      });
    }

    // 处理离线挂机进度补偿
    if (data.lastSaveTime) {
      calculateOfflineProgress(game, data.lastSaveTime);
    }

    return true;
  }

  // 离线挂机进度补偿计算逻辑 (优先接入 Cloudflare Edge 算力分流，离线时无缝本地降级)
  async function calculateOfflineProgress(game, lastTime) {
    const now = Date.now();
    const offlineSeconds = Math.max(0, (now - lastTime) / 1000);

    // 小于 5 秒视为正常刷新，不弹窗打扰
    if (offlineSeconds < 5) return;

    // 格式化时长
    const hours = Math.floor(offlineSeconds / 3600);
    const minutes = Math.floor((offlineSeconds % 3600) / 60);
    const seconds = Math.floor(offlineSeconds % 60);
    const durationStr = `${hours > 0 ? hours + '小时 ' : ''}${minutes > 0 ? minutes + '分 ' : ''}${seconds}秒`;

    let brewedCups = 0;
    let soldCups = 0;
    let offlineRevenue = 0;
    let offlineCost = 0;
    let netIncome = 0;
    let serverComputed = false;

    // 优先调用 Cloudflare Edge Server 离线挂机精密推演
    try {
      const payload = {
        action: 'offline',
        lastSaveTime: lastTime,
        currentTime: now,
        dripFiltersCount: game.dripFilters ? game.dripFilters.length : 0,
        brewSpeed: game.brewSpeed || 3.0,
        autoDripUnlocked: !!game.autoDripUnlocked,
        autoDripEnabled: game.autoDripEnabled !== false,
        unitCost: typeof game.getUnitCost === 'function' ? game.getUnitCost() : 1.2,
        unitPrice: typeof game.getSellingPrice === 'function' ? game.getSellingPrice() : 3.0,
        salesFrequency: typeof game.getSalesFrequency === 'function' ? game.getSalesFrequency() : 1.0,
        effectiveTraffic: typeof game.getEffectiveTrafficRate === 'function' ? game.getEffectiveTrafficRate() : 0.5,
        coffeeStock: game.coffeeStock || 0,
        r: game.r || 0
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const endpoint = window.CF_EDGE_API || 'https://coffee-capital-compute.kakalone984.workers.dev/api/compute';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const edgeData = await response.json();
        if (edgeData && edgeData.success && edgeData.serverVerified) {
          brewedCups = edgeData.brewedCups;
          soldCups = edgeData.soldCups;
          offlineCost = edgeData.offlineCost;
          offlineRevenue = edgeData.offlineRevenue;
          netIncome = edgeData.netIncome;
          game.coffeeStock = edgeData.finalStock;
          game.r = edgeData.finalR;
          game.totalCoffeeSold = (game.totalCoffeeSold || 0) + soldCups;
          game.totalRevenueEarned = (game.totalRevenueEarned || 0) + offlineRevenue;
          serverComputed = true;
        }
      }
    } catch (e) {
      // 网络离线或请求异常，静默降级为本地计算
    }

    if (!serverComputed) {
      // 本地备用极速计算
      const unitCost = typeof game.getUnitCost === 'function' ? game.getUnitCost() : 1.2;
      const unitPrice = typeof game.getSellingPrice === 'function' ? game.getSellingPrice() : (3.0 * (game.salesMultiplier || 1.0));

      if (game.autoDripUnlocked && game.autoDripEnabled !== false && game.dripFilters.length > 0) {
        const brewSpeed = game.brewSpeed || 3.0;
        const cupsPerSecond = game.dripFilters.length / brewSpeed;
        const theoreticalBrewCups = Math.floor(offlineSeconds * cupsPerSecond);

        const maxAffordableCups = Math.floor(game.r / Math.max(0.01, unitCost));
        brewedCups = Math.min(theoreticalBrewCups, maxAffordableCups + theoreticalBrewCups);
        if (brewedCups > 0) {
          offlineCost = brewedCups * unitCost;
          game.coffeeStock += brewedCups;
        }
      }

      const effectiveTraffic = (typeof game.getEffectiveTrafficRate === 'function')
        ? game.getEffectiveTrafficRate()
        : ((game.trafficBaseRate || 0.5) * (game.epUpgrades && game.epUpgrades.agitator ? 2.0 : 1.0));
      const salesFrequency = typeof game.getSalesFrequency === 'function' ? game.getSalesFrequency() : (game.salesBaseFrequency || 1.0);
      const theoreticalSalesCups = Math.floor(offlineSeconds * salesFrequency * effectiveTraffic);

      soldCups = Math.min(game.coffeeStock, theoreticalSalesCups);
      if (soldCups > 0) {
        game.coffeeStock -= soldCups;
        offlineRevenue = soldCups * unitPrice;
        game.totalCoffeeSold += soldCups;
        game.totalRevenueEarned += offlineRevenue;
      }

      netIncome = Math.max(0, offlineRevenue - offlineCost);
      game.r += netIncome;
    }

    // 离线阿尔法 (α) 脉冲产出结算
    let offlineAlpha = 0;
    const alphaRate = (typeof game.getAlphaRate === 'function') ? game.getAlphaRate() : 0;
    if (alphaRate > 0 && offlineSeconds > 0) {
      // #51 虚时间态插值: 使离线收益率提升至 100% (未解锁前为 50%)
      const offlineRatio = (game.untitledUpgrades && game.untitledUpgrades['51']) ? 1.0 : 0.5;
      offlineAlpha = offlineSeconds * alphaRate * offlineRatio;
      game.alpha = (game.alpha || 0) + offlineAlpha;
      game.totalAlphaEarned = (game.totalAlphaEarned || 0) + offlineAlpha;
    }

    // 显示离线挂机补偿结算模态弹窗
    const modal = document.getElementById('offline-modal');
    if (modal) {
      document.getElementById('off-duration').textContent = durationStr;
      document.getElementById('off-brewed').textContent = `${brewedCups.toLocaleString()} 杯`;
      document.getElementById('off-sold').textContent = `${soldCups.toLocaleString()} 杯`;
      document.getElementById('off-income').textContent = `+¥${game.formatMoney(netIncome)}`;

      let badge = document.getElementById('off-cloud-badge');
      if (!badge) {
        const card = modal.querySelector('.offline-modal-card') || modal.querySelector('.modal-content');
        if (card) {
          badge = document.createElement('div');
          badge.id = 'off-cloud-badge';
          badge.style.cssText = 'font-size: 0.75rem; color: #38bdf8; text-align: center; margin-top: -6px; margin-bottom: 12px;';
          const grid = card.querySelector('.offline-stat-grid');
          if (grid) card.insertBefore(badge, grid);
        }
      }
      if (badge) {
        badge.textContent = serverComputed ? '⚡ 运算已由 Cloudflare 边缘节点核算完成' : '📱 运算已由本地引擎即时核算完成';
      }

      modal.classList.add('open');

      const claimBtn = document.getElementById('offline-modal-claim');
      const closeClaim = () => {
        modal.classList.remove('open');
        claimBtn.removeEventListener('click', closeClaim);
        let claimMsg = `✨ 已成功领取挂机收益 +¥${game.formatMoney(netIncome)}`;
        if (offlineAlpha > 0) {
          claimMsg += ` 与 +${typeof game.formatAlpha === 'function' ? game.formatAlpha(offlineAlpha) : Math.floor(offlineAlpha)} α`;
        }
        game.showToast(claimMsg, 'success');
        game.updateUI();
      };
      claimBtn.addEventListener('click', closeClaim);
    }
  }

  // 导出 Base64 存档字符串
  function exportSaveToBase64(game) {
    const data = serializeGameState(game);
    const json = JSON.stringify(data);
    return utf8ToBase64(json);
  }

  // 导入 Base64 存档字符串
  function importSaveFromBase64(game, base64Str) {
    try {
      if (!base64Str || typeof base64Str !== 'string') {
        throw new Error('存档字符串为空');
      }
      const jsonStr = base64ToUtf8(base64Str.trim());
      const data = JSON.parse(jsonStr);

      if (!data || typeof data.r !== 'number') {
        throw new Error('无效的存档结构');
      }

      applyLoadedData(game, data);
      saveToLocalStorage(game, false);
      game.checkAchievements();
      game.updateUI();
      if (window.TreeSystem) {
        window.TreeSystem.updateAllNodes(game);
      }
      game.showToast('🎉 Base64 存档导入成功，进度已完全恢复！', 'success');
      return true;
    } catch (e) {
      console.error('Import error:', e);
      game.showToast('❌ 存档导入失败：字符串损坏或格式不兼容', 'error');
      return false;
    }
  }

  // 复制文本至系统剪贴板 (现代 API + 传统 Fallback 双重保障)
  function copyTextToClipboard(text, onSuccess, onError) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(onSuccess).catch(() => {
        fallbackCopy(text, onSuccess, onError);
      });
    } else {
      fallbackCopy(text, onSuccess, onError);
    }
  }

  function fallbackCopy(text, onSuccess, onError) {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (successful) {
        if (onSuccess) onSuccess();
      } else {
        if (onError) onError();
      }
    } catch (err) {
      if (onError) onError();
    }
  }

  // 启动定时自动保存 (默认 10 秒，支持 5s/10s/20s/30s 动态调整)
  function startAutoSave(game, intervalSeconds) {
    if (autoSaveTimer) clearInterval(autoSaveTimer);

    const validIntervals = [5, 10, 20, 30];
    let sec = 10;
    const savedPref = Number(localStorage.getItem('coffee_capital_auto_save_interval'));
    if (validIntervals.includes(Number(intervalSeconds))) {
      sec = Number(intervalSeconds);
    } else if (validIntervals.includes(Number(game && game.autoSaveInterval))) {
      sec = Number(game.autoSaveInterval);
    } else if (validIntervals.includes(savedPref)) {
      sec = savedPref;
    }
    game.autoSaveInterval = sec;
    try {
      localStorage.setItem('coffee_capital_auto_save_interval', String(sec));
    } catch (e) {}

    autoSaveTimer = setInterval(() => {
      if (!isResetting) {
        saveToLocalStorage(game, false);
      }
    }, sec * 1000);

    if (!window._beforeUnloadRegistered) {
      window._beforeUnloadRegistered = true;
      window.addEventListener('beforeunload', () => {
        if (!isResetting) {
          saveToLocalStorage(game, false);
        }
      });
    }

    updateAutoSaveUI(game);
  }

  // 动态修改自动保存间隔 (5s / 10s / 20s / 30s)
  function setAutoSaveInterval(game, seconds) {
    const validIntervals = [5, 10, 20, 30];
    const sec = validIntervals.includes(Number(seconds)) ? Number(seconds) : 10;
    game.autoSaveInterval = sec;
    try {
      localStorage.setItem('coffee_capital_auto_save_interval', String(sec));
    } catch (e) {
      console.warn('Failed to save autosave interval preference', e);
    }
    startAutoSave(game, sec);
    updateAutoSaveUI(game);
    saveToLocalStorage(game, false);
  }

  // 刷新设置界面的自动保存选项高亮与提示文字
  function updateAutoSaveUI(game) {
    const sec = (game && game.autoSaveInterval) ? game.autoSaveInterval : 10;
    const desc = document.getElementById('autosave-interval-desc');
    if (desc) {
      desc.textContent = `当前频率：每 ${sec} 秒自动保存一次到本地存储${sec === 10 ? ' (默认推荐)' : ''}`;
    }
    const btns = document.querySelectorAll('#autosave-btn-group .btn-interval-opt');
    btns.forEach(b => {
      const bSec = parseInt(b.dataset.interval, 10);
      if (bSec === sec) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });
  }

  // 抹除数据硬重置 (保留用户在设置界面的个性化偏好：显示风格与自动保存间隔)
  function hardReset(game) {
    isResetting = true;
    if (autoSaveTimer) {
      clearInterval(autoSaveTimer);
      autoSaveTimer = null;
    }

    // 捕获用户个性化偏好
    const preservedTheme = (game && game.theme) || localStorage.getItem('coffee_capital_theme') || 'cyber';
    const rawPrefInterval = (game && game.autoSaveInterval) || localStorage.getItem('coffee_capital_auto_save_interval') || '10';
    const preservedInterval = String(rawPrefInterval);

    try {
      // 仅移除游戏进程存档，保留用户在设置界面配置的显示风格与自动保存间隔
      localStorage.removeItem(SAVE_STORAGE_KEY);
      localStorage.setItem('coffee_capital_theme', preservedTheme);
      localStorage.setItem('coffee_capital_auto_save_interval', preservedInterval);
    } catch (e) {
      console.error('Storage preserve failed during hard reset:', e);
    }
    location.reload();
  }

  return {
    saveToLocalStorage,
    loadFromLocalStorage,
    exportSaveToBase64,
    importSaveFromBase64,
    copyTextToClipboard,
    startAutoSave,
    setAutoSaveInterval,
    updateAutoSaveUI,
    hardReset
  };
})();
