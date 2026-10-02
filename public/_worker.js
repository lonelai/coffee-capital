/**
 * _worker.js - Cloudflare Pages Advanced Mode Worker
 * 处理 /api/compute 边缘计算请求，其余静态资产通过 env.ASSETS 回源
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 边缘计算 API 路由
    if (url.pathname === '/api/compute' || url.pathname === '/api/compute/') {
      return handleCompute(request);
    }

    // 健康检查与系统自检
    if (url.pathname === '/api/health') {
      return new Response(JSON.stringify({
        status: 'healthy',
        service: 'coffee-capital-edge-compute',
        cfColo: request.cf ? request.cf.colo : 'local',
        timestamp: Date.now()
      }), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store'
        }
      });
    }

    // 默认回源静态文件
    if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  }
};

/**
 * 核心边缘计算处理函数
 */
async function handleCompute(request) {
  // 处理 OPTIONS 预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

  let params = {};
  if (request.method === 'POST') {
    try {
      params = await request.json();
    } catch (e) {
      return errorResponse('Invalid JSON body', 400);
    }
  } else {
    const url = new URL(request.url);
    for (const [key, val] of url.searchParams.entries()) {
      params[key] = val;
    }
  }

  const action = params.action || 'ping';

  try {
    let result = null;
    switch (action) {
      case 'offline':
        result = computeOffline(params);
        break;
      case 'prestige':
        result = computePrestige(params);
        break;
      case 'bank':
        result = computeBank(params);
        break;
      case 'ping':
      default:
        result = {
          success: true,
          message: 'Cloudflare Edge Compute Engine Online',
          supportedActions: ['offline', 'prestige', 'bank'],
          timestamp: Date.now()
        };
        break;
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store'
      }
    });
  } catch (err) {
    return errorResponse(err.message || 'Compute Error', 500);
  }
}

/**
 * 1. 离线挂机长周期精密推演 (边缘分流)
 */
function computeOffline(p) {
  const lastSaveTime = Number(p.lastSaveTime) || 0;
  const now = Number(p.currentTime) || Date.now();
  const rawElapsed = Math.max(0, (now - lastSaveTime) / 1000);

  // 离线时间上限保护 (例如最长 48 小时挂机收益)
  const elapsedSeconds = Math.min(172800, rawElapsed);

  if (elapsedSeconds < 5) {
    return {
      success: true,
      action: 'offline',
      elapsedSeconds,
      brewedCups: 0,
      soldCups: 0,
      offlineCost: 0,
      offlineRevenue: 0,
      netIncome: 0,
      finalStock: Number(p.coffeeStock) || 0,
      finalR: Number(p.r) || 0,
      note: 'Offline duration under 5s, skipped'
    };
  }

  const dripFiltersCount = Math.max(0, Number(p.dripFiltersCount) || 0);
  const brewSpeed = Math.max(0.1, Number(p.brewSpeed) || 3.0);
  const autoDripUnlocked = Boolean(p.autoDripUnlocked);
  const autoDripEnabled = Boolean(p.autoDripEnabled);
  const unitCost = Math.max(0, Number(p.unitCost) || 0.4);
  const unitPrice = Math.max(0, Number(p.unitPrice) || 3.0);
  const salesFrequency = Math.max(0.1, Number(p.salesFrequency) || 1.0);
  const effectiveTraffic = Math.max(0, Number(p.effectiveTraffic) || 0.5);

  let initialStock = Math.max(0, Number(p.coffeeStock) || 0);
  let currentR = Math.max(0, Number(p.r) || 0);

  let brewedCups = 0;
  let offlineCost = 0;

  // 自动滴滤萃取计算
  if (autoDripUnlocked && autoDripEnabled && dripFiltersCount > 0) {
    const cupsPerSec = dripFiltersCount / brewSpeed;
    const theoreticalBrews = Math.floor(elapsedSeconds * cupsPerSec);

    if (unitCost > 0) {
      const maxAffordable = Math.floor(currentR / unitCost);
      brewedCups = Math.min(theoreticalBrews, maxAffordable);
    } else {
      brewedCups = theoreticalBrews;
    }

    offlineCost = Math.round(brewedCups * unitCost * 100) / 100;
  }

  const availableStock = initialStock + brewedCups;

  // 销售出单计算
  const salesRate = salesFrequency * effectiveTraffic;
  const theoreticalSales = Math.floor(elapsedSeconds * salesRate);
  const soldCups = Math.min(availableStock, theoreticalSales);
  const offlineRevenue = Math.round(soldCups * unitPrice * 100) / 100;

  const finalStock = availableStock - soldCups;
  const netIncome = Math.round((offlineRevenue - offlineCost) * 100) / 100;
  const finalR = Math.max(0, Math.round((currentR + netIncome) * 100) / 100);

  return {
    success: true,
    action: 'offline',
    serverVerified: true,
    elapsedSeconds: Math.round(elapsedSeconds),
    brewedCups,
    soldCups,
    offlineCost,
    offlineRevenue,
    netIncome,
    finalStock,
    finalR,
    computedAt: Date.now()
  };
}

/**
 * 2. 摆摊经验 (EP) 阶梯阈值推演与多档转生预测
 */
function computePrestige(p) {
  const r = Math.max(0, Number(p.r) || 0);

  // 计算当前可获得 EP
  let ep = 0;
  if (r >= 100) {
    let t = 100;
    while (r >= t) {
      ep++;
      t *= (ep % 2 === 1) ? 5 : 2;
    }
  }

  // 辅助函数：根据目标 EP 计算所需金额阈值
  function getThresholdForEp(targetEp) {
    if (targetEp <= 0) return 0;
    let t = 100;
    for (let i = 1; i < targetEp; i++) {
      t *= (i % 2 === 1) ? 5 : 2;
    }
    return t;
  }

  const nextThreshold = getThresholdForEp(ep + 1);
  const diffToNext = Math.max(0, nextThreshold - r);

  // 预测未来 5 档里程碑
  const nextMilestones = [];
  for (let step = 1; step <= 5; step++) {
    const target = ep + step;
    const thresh = getThresholdForEp(target);
    nextMilestones.push({
      targetEp: target,
      requiredR: thresh,
      needMoreR: Math.max(0, thresh - r)
    });
  }

  // 综合评估是否推荐立即转生
  let recommendPrestige = false;
  let recommendationReason = '';
  if (ep === 0) {
    recommendPrestige = false;
    recommendationReason = `资金未达首次转生门槛 (需累积 ¥100.00，还差 ¥${diffToNext.toFixed(2)})`;
  } else if (diffToNext / nextThreshold < 0.15) {
    recommendPrestige = false;
    recommendationReason = `距离达成下一个 EP (+${ep + 1} EP) 仅差不到 15%，建议稍作等待！`;
  } else {
    recommendPrestige = true;
    recommendationReason = `收益处于稳定期，可获取 +${ep} EP 升级核心能力！`;
  }

  return {
    success: true,
    action: 'prestige',
    serverVerified: true,
    currentMoney: r,
    currentEp: ep,
    nextThreshold,
    diffToNext,
    recommendPrestige,
    recommendationReason,
    nextMilestones,
    computedAt: Date.now()
  };
}

/**
 * 3. 商业信贷额度与资产试算
 */
function computeBank(p) {
  const r = Math.max(0, Number(p.r) || 0);
  const debt = Math.max(0, Number(p.debt) || 0);

  const ownMoney = Math.max(0, r - debt);
  const maxLoanLimit = ownMoney >= 10000 ? Math.floor(ownMoney * 10) : 0;
  const availableLoan = Math.max(0, maxLoanLimit - debt);

  let costDebuff = 0;
  if (debt > 0) {
    if (maxLoanLimit <= 0 || availableLoan <= 0) {
      costDebuff = 0.5; // 最大 50% debuff
    } else {
      costDebuff = (1 - (availableLoan / maxLoanLimit)) * 0.5;
    }
  }

  return {
    success: true,
    action: 'bank',
    serverVerified: true,
    ownMoney,
    maxLoanLimit,
    availableLoan,
    debtCostDebuffPercent: +(costDebuff * 100).toFixed(1),
    computedAt: Date.now()
  };
}

function errorResponse(msg, status = 400) {
  return new Response(JSON.stringify({ success: false, error: msg }), {
    status: status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
