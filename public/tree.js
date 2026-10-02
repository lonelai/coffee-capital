/**
 * tree.js - 咖啡商业科技升级树定义与交互渲染引擎
 */

window.TreeSystem = (function() {
  // 科技树节点定义表
  const TREE_NODES = [
    // ---------- 制作速度升级链路 (提升速度 Lv.1 -> Lv.2 -> Lv.3) ----------
    {
      id: 'km',
      branch: 'speed',
      baseName: '提升速度',
      isMultiLevel: true,
      maxLevel: 3,
      requires: [],
      levels: [
        {
          level: 1,
          name: '提升速度 Lv.1',
          cost: 10,
          currency: 'r',
          desc: '熟练掌握手冲冲煮手法',
          effectText: '提升制作速度至 2 秒',
          speed: 2.0
        },
        {
          level: 2,
          name: '提升速度 Lv.2',
          cost: 120,
          currency: 'r',
          desc: '精研滴滤注水节律',
          effectText: '提升制作速度至 1 秒',
          speed: 1.0
        },
        {
          level: 3,
          name: '提升速度 Lv.3',
          cost: 600,
          currency: 'r',
          desc: '人机合一极速注水',
          effectText: '提升制作速度至 0.5 秒',
          speed: 0.5
        }
      ]
    },

    // ---------- 客流运营升级链路 (优化选址 Lv.1, Lv.2, ...) ----------
    {
      id: 'location',
      branch: 'traffic',
      baseName: '优化选址',
      isMultiLevel: true,
      maxLevel: 50,
      requires: [],
      levels: (function() {
        const arr = [];
        for (let lvl = 1; lvl <= 50; lvl++) {
          const cost = Math.round(25 * Math.pow(1.45, lvl - 1));
          arr.push({
            level: lvl,
            name: `优化选址 Lv.${lvl}`,
            cost: cost,
            currency: 'r',
            desc: '设摊于人流繁华街区',
            effectText: `客流提升 +10% (升级后达 ${(50 + lvl * 10)}% 客流)`
          });
        }
        return arr;
      })()
    }
  ];

  // 分支列配置 (自动滴滤已移至摆摊经验进阶研发)
  const BRANCHES = [
    { id: 'speed', name: '制作速度' },
    { id: 'traffic', name: '客流运营' }
  ];

  // 初始化渲染科技树
  function initTree(game) {
    const columnsContainer = document.getElementById('tree-branch-columns');
    if (!columnsContainer) return;

    columnsContainer.innerHTML = '';

    // 为每个分支创建一列 (按要求删除分支便签)
    BRANCHES.forEach(branch => {
      const colEl = document.createElement('div');
      colEl.className = 'tree-branch-col';
      colEl.dataset.branch = branch.id;

      // 找出当前分支的所有节点
      const nodes = TREE_NODES.filter(n => n.branch === branch.id);
      nodes.forEach(node => {
        const card = createNodeCard(node, game);
        colEl.appendChild(card);
      });

      columnsContainer.appendChild(colEl);
    });

    // 绘制连线
    requestAnimationFrame(() => {
      drawConnections(game);
    });
  }

  // 创建节点 DOM 卡片
  function createNodeCard(node, game) {
    const card = document.createElement('div');
    card.className = 'tree-node-card';
    card.id = `node-${node.id}`;
    card.dataset.id = node.id;

    updateNodeCardState(card, node, game);

    card.addEventListener('click', () => {
      onNodeClick(node, game);
    });

    return card;
  }

  // 获取多等级节点当前等级 (隔离各升级项，严格避免跨节点联动)
  function getNodeLevel(node, game) {
    if (!game.upgradesPurchased) return 0;
    if (typeof game.upgradesPurchased[node.id] === 'number') {
      return game.upgradesPurchased[node.id];
    }
    // 仅针对快男处理历史老旧存档兼容标记
    if (node.id === 'km') {
      if (game.upgradesPurchased['km3']) return 3;
      if (game.upgradesPurchased['km2']) return 2;
      if (game.upgradesPurchased['km1']) return 1;
    }
    return 0;
  }

  // 更新节点状态
  function updateNodeCardState(card, node, game) {
    const inInitial = typeof game.isInitialPhase === 'function' ? game.isInitialPhase() : ((game.totalCoffeeSold || 0) < 1);
    if (inInitial) {
      card.classList.remove('purchased', 'available', 'can-afford', 'cannot-afford');
      card.classList.add('locked');
      card.dataset.canAfford = '0';
      const displayName = node.isMultiLevel ? node.levels[0].name : node.name;
      const displayCost = node.isMultiLevel ? node.levels[0].cost : node.cost;
      const displayDesc = node.isMultiLevel ? node.levels[0].desc : node.desc;
      const displayEffect = node.isMultiLevel ? node.levels[0].effectText : node.effectText;
      card.innerHTML = `
        <div class="node-header-row">
          <div class="node-title">${displayName}</div>
          <div class="node-cost">¥${displayCost >= 1000 ? displayCost.toLocaleString() : displayCost}</div>
        </div>
        <div class="node-desc">${displayDesc}</div>
        <div class="node-footer">
          <span style="font-size: 0.7rem; color: #94a3b8;">${displayEffect}</span>
          <span class="node-status-text">🔒 起初需先制作并售出首杯咖啡</span>
        </div>
      `;
      return;
    }

    if (node.isMultiLevel) {
      const curLevel = getNodeLevel(node, game);

      card.classList.remove('purchased', 'available', 'locked', 'can-afford', 'cannot-afford');

      if (curLevel >= node.maxLevel) {
        const lastLevel = node.levels[node.maxLevel - 1];
        card.classList.add('purchased');
        card.dataset.canAfford = '0';
        card.innerHTML = `
          <div class="node-header-row">
            <div class="node-title">${lastLevel.name} <span class="badge-limit" style="background: rgba(16,185,129,0.2); color: #34d399; font-size: 0.68rem;">MAX</span></div>
            <div class="node-cost" style="color: #34d399;">已达最高级</div>
          </div>
          <div class="node-desc">${lastLevel.desc}</div>
          <div class="node-footer">
            <span style="font-size: 0.7rem; color: #94a3b8;">${lastLevel.effectText}</span>
            <span class="node-status-text">✓ 已研发至最高等级</span>
          </div>
        `;
      } else {
        const nextLevelInfo = node.levels[curLevel];
        const canAfford = game.r >= nextLevelInfo.cost;
        card.classList.add('available');
        card.classList.add(canAfford ? 'can-afford' : 'cannot-afford');
        card.dataset.canAfford = canAfford ? '1' : '0';

        let levelTag = curLevel > 0 ? `<span class="badge-limit" style="font-size: 0.68rem; background: rgba(245,158,11,0.2); color: #fbbf24;">当前 Lv.${curLevel}</span>` : '';
        let statusHtml = `<span class="node-status-text">${canAfford ? '⚡ 可点击研发' : '资金不足'}</span>`;

        card.innerHTML = `
          <div class="node-header-row">
            <div class="node-title">${nextLevelInfo.name} ${levelTag}</div>
            <div class="node-cost">¥${nextLevelInfo.cost >= 1000 ? nextLevelInfo.cost.toLocaleString() : nextLevelInfo.cost}</div>
          </div>
          <div class="node-desc">${nextLevelInfo.desc}</div>
          <div class="node-footer">
            <span style="font-size: 0.7rem; color: #94a3b8;">${nextLevelInfo.effectText}</span>
            ${statusHtml}
          </div>
        `;
      }
      return;
    }

    const isPurchased = game.upgradesPurchased && !!game.upgradesPurchased[node.id];
    const canAfford = game.r >= node.cost;
    const prereqsMet = (node.requires || []).every(reqId => game.upgradesPurchased && game.upgradesPurchased[reqId]);

    card.classList.remove('purchased', 'available', 'locked', 'can-afford', 'cannot-afford');

    let statusHtml = '';
    if (isPurchased) {
      card.classList.add('purchased');
      card.dataset.canAfford = '0';
      statusHtml = '<span class="node-status-text">✓ 已研发激活</span>';
    } else if (prereqsMet) {
      card.classList.add('available');
      card.classList.add(canAfford ? 'can-afford' : 'cannot-afford');
      card.dataset.canAfford = canAfford ? '1' : '0';
      statusHtml = `<span class="node-status-text">${canAfford ? '⚡ 可点击研发' : '资金不足'}</span>`;
    } else {
      card.classList.add('locked');
      card.dataset.canAfford = '0';
      const reqNames = (node.requires || []).map(r => {
        const found = TREE_NODES.find(n => n.id === r);
        return found ? (found.baseName || found.name) : r;
      }).join(', ');
      statusHtml = `<span class="node-status-text">🔒 需前置: ${reqNames}</span>`;
    }

    card.innerHTML = `
      <div class="node-header-row">
        <div class="node-title">${node.name}</div>
        <div class="node-cost">¥${node.cost >= 1000 ? node.cost.toLocaleString() : node.cost}</div>
      </div>
      <div class="node-desc">${node.desc}</div>
      <div class="node-footer">
        <span style="font-size: 0.7rem; color: #94a3b8;">${node.effectText}</span>
        ${statusHtml}
      </div>
    `;
  }

  // 点击购买节点
  function onNodeClick(node, game) {
    const inInitial = typeof game.isInitialPhase === 'function' ? game.isInitialPhase() : ((game.totalCoffeeSold || 0) < 1);
    if (inInitial) {
      game.showToast('起初请先购买咖啡滴滤器并制作售出首杯咖啡！', 'warning');
      return;
    }

    if (node.isMultiLevel) {
      const curLevel = getNodeLevel(node, game);

      if (curLevel >= node.maxLevel) {
        game.showToast(`【${node.baseName}】已研发至最高等级 (Lv.${node.maxLevel})`, 'info');
        return;
      }

      const nextLevelInfo = node.levels[curLevel];
      if (game.r < nextLevelInfo.cost) {
        game.showToast(`资金不足：研发【${nextLevelInfo.name}】需要 ¥${nextLevelInfo.cost >= 1000 ? nextLevelInfo.cost.toLocaleString() : nextLevelInfo.cost}，当前拥有 ¥${game.formatMoney(game.r)}`, 'warning');
        return;
      }

      // 购买扣费
      game.r -= nextLevelInfo.cost;
      game.recordEarning(-nextLevelInfo.cost);
      const newLevel = curLevel + 1;
      game.upgradesPurchased[node.id] = newLevel;

      // 生效多等级升级效果
      if (node.id === 'km') {
        // 兼容历史成就标记
        if (newLevel === 1) game.upgradesPurchased['km1'] = true;
        if (newLevel === 2) game.upgradesPurchased['km2'] = true;
        if (newLevel === 3) game.upgradesPurchased['km3'] = true;
        game.brewSpeed = nextLevelInfo.speed;
        game.showToast(`🎉 成功研发升级：【${nextLevelInfo.name}】！制作耗时缩短至 ${nextLevelInfo.speed} 秒`, 'success');
      } else if (node.id === 'location') {
        if (typeof game.recalcTrafficRate === 'function') {
          game.recalcTrafficRate();
        }
        game.showToast(`🎉 成功研发升级：【${nextLevelInfo.name}】！客流概率提升至 ${(game.trafficBaseRate * 100).toFixed(0)}%`, 'success');
      }
      game.checkAchievements();
      if (typeof game.renderDripSlots === 'function') {
        game.renderDripSlots();
      }
      updateAllNodes(game);
      game.updateUI();
      return;
    }

    if (game.upgradesPurchased[node.id]) {
      game.showToast(`【${node.name}】已激活`, 'info');
      return;
    }

    // 检查前置
    const prereqsMet = (node.requires || []).every(reqId => game.upgradesPurchased[reqId]);
    if (!prereqsMet) {
      const reqNames = (node.requires || []).map(r => {
        const found = TREE_NODES.find(n => n.id === r);
        return found ? (found.baseName || found.name) : r;
      }).join(', ');
      game.showToast(`无法研发：需要前置科技【${reqNames}】`, 'warning');
      return;
    }

    // 检查资金
    if (game.r < node.cost) {
      game.showToast(`资金不足：研发【${node.name}】需要 ¥${node.cost >= 1000 ? node.cost.toLocaleString() : node.cost}，当前拥有 ¥${game.formatMoney(game.r)}`, 'warning');
      return;
    }

    // 购买扣费
    game.r -= node.cost;
    game.recordEarning(-node.cost);
    game.upgradesPurchased[node.id] = true;

    // 生效加成
    if (typeof node.apply === 'function') {
      node.apply(game);
    }

    game.showToast(`🎉 成功研发科技：【${node.name}】！`, 'success');

    // 检查是否有解锁成就
    game.checkAchievements();

    // 更新界面与槽位
    if (typeof game.renderDripSlots === 'function') {
      game.renderDripSlots();
    }
    updateAllNodes(game);
    game.updateUI();
  }

  // 刷新所有节点卡片状态与连线高亮
  function updateAllNodes(game) {
    TREE_NODES.forEach(node => {
      const card = document.getElementById(`node-${node.id}`);
      if (card) {
        updateNodeCardState(card, node, game);
      }
    });

    drawConnections(game);

    const inInitial = typeof game.isInitialPhase === 'function' ? game.isInitialPhase() : ((game.totalCoffeeSold || 0) < 1);
    if (inInitial) {
      const badge = document.getElementById('badge-tech-avail');
      if (badge) badge.style.display = 'none';
      return;
    }

    // 检查是否有新可用科技用于徽章提醒
    let hasAvailable = false;
    TREE_NODES.forEach(node => {
      if (node.isMultiLevel) {
        const curLevel = getNodeLevel(node, game);
        if (curLevel < node.maxLevel) {
          const nextCost = node.levels[curLevel].cost;
          if (game.r >= nextCost) hasAvailable = true;
        }
      } else {
        if (!game.upgradesPurchased[node.id]) {
          const prereqsMet = (node.requires || []).every(reqId => game.upgradesPurchased[reqId]);
          if (prereqsMet && game.r >= node.cost) {
            hasAvailable = true;
          }
        }
      }
    });

    const badge = document.getElementById('badge-tech-avail');
    if (badge) {
      badge.style.display = hasAvailable ? 'inline-block' : 'none';
    }
  }

  // 快速实时更新卡片可研发/资金充足高亮状态 (高频帧循环调用，脏检查切换高亮类与状态文本，零重绘开销)
  function updateAffordability(game) {
    const inInitial = typeof game.isInitialPhase === 'function' ? game.isInitialPhase() : ((game.totalCoffeeSold || 0) < 1);
    if (inInitial) {
      const badge = document.getElementById('badge-tech-avail');
      if (badge) badge.style.display = 'none';
      return;
    }

    let hasAvailable = false;

    TREE_NODES.forEach(node => {
      const card = document.getElementById(`node-${node.id}`);
      if (!card) return;

      let canAfford = false;
      let isAvailable = false;

      if (node.isMultiLevel) {
        const curLevel = getNodeLevel(node, game);
        if (curLevel < node.maxLevel) {
          isAvailable = true;
          const cost = node.levels[curLevel].cost;
          canAfford = game.r >= cost;
        }
      } else {
        const isPurchased = game.upgradesPurchased && !!game.upgradesPurchased[node.id];
        if (!isPurchased) {
          const prereqsMet = (node.requires || []).every(reqId => game.upgradesPurchased && game.upgradesPurchased[reqId]);
          if (prereqsMet) {
            isAvailable = true;
            canAfford = game.r >= node.cost;
          }
        }
      }

      if (isAvailable) {
        if (canAfford) hasAvailable = true;
        const targetAffordStr = canAfford ? '1' : '0';
        if (card.dataset.canAfford !== targetAffordStr) {
          card.dataset.canAfford = targetAffordStr;
          if (canAfford) {
            card.classList.add('can-afford');
            card.classList.remove('cannot-afford');
          } else {
            card.classList.remove('can-afford');
            card.classList.add('cannot-afford');
          }
          const statusTextEl = card.querySelector('.node-status-text');
          if (statusTextEl) {
            statusTextEl.textContent = canAfford ? '⚡ 可点击研发' : '资金不足';
          }
        }
      }
    });

    const badge = document.getElementById('badge-tech-avail');
    if (badge) {
      badge.style.display = hasAvailable ? 'inline-block' : 'none';
    }
  }

  // 绘制 SVG 连接线
  function drawConnections(game) {
    const svg = document.getElementById('tree-svg-canvas');
    const board = document.getElementById('tree-canvas-board');
    if (!svg || !board) return;

    svg.innerHTML = '';

    const hasAnyConnection = TREE_NODES.some(node => node.requires && node.requires.length > 0);
    if (!hasAnyConnection) {
      svg.style.width = '100%';
      svg.style.height = '100%';
      return;
    }

    const isMobile = window.DeviceDetector ? window.DeviceDetector.isMobile() : false;
    if (isMobile) {
      svg.style.width = '100%';
      svg.style.height = '100%';
    } else {
      svg.style.width = `${Math.max(board.scrollWidth, board.clientWidth)}px`;
      svg.style.height = `${Math.max(board.scrollHeight, board.clientHeight)}px`;
    }
    const boardRect = board.getBoundingClientRect();

    TREE_NODES.forEach(node => {
      if (!node.requires || node.requires.length === 0) return;

      const toCard = document.getElementById(`node-${node.id}`);
      if (!toCard) return;
      const toRect = toCard.getBoundingClientRect();

      node.requires.forEach(parentReqId => {
        const fromCard = document.getElementById(`node-${parentReqId}`);
        if (!fromCard) return;
        const fromRect = fromCard.getBoundingClientRect();

        // 坐标相对于 SVG 容器
        const x1 = fromRect.left + fromRect.width / 2 - boardRect.left + board.scrollLeft;
        const y1 = fromRect.bottom - boardRect.top + board.scrollTop;

        const x2 = toRect.left + toRect.width / 2 - boardRect.left + board.scrollLeft;
        const y2 = toRect.top - boardRect.top + board.scrollTop;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

        // 贝塞尔曲线
        const cy1 = y1 + (y2 - y1) * 0.5;
        const cy2 = y1 + (y2 - y1) * 0.5;
        const d = `M ${x1} ${y1} C ${x1} ${cy1}, ${x2} ${cy2}, ${x2} ${y2}`;

        path.setAttribute('d', d);
        path.setAttribute('fill', 'none');

        const isParentPurchased = game.upgradesPurchased && game.upgradesPurchased[parentReqId];
        const isChildPurchased = game.upgradesPurchased && game.upgradesPurchased[node.id];

        if (isChildPurchased) {
          path.setAttribute('stroke', '#10b981');
          path.setAttribute('stroke-width', '3');
          path.setAttribute('stroke-dasharray', 'none');
          path.setAttribute('filter', 'drop-shadow(0 0 4px rgba(16,185,129,0.5))');
        } else if (isParentPurchased) {
          path.setAttribute('stroke', '#06b6d4');
          path.setAttribute('stroke-width', '2.5');
          path.setAttribute('stroke-dasharray', '6,4');
          path.setAttribute('filter', 'drop-shadow(0 0 4px rgba(6,182,212,0.5))');
        } else {
          path.setAttribute('stroke', 'rgba(255,255,255,0.12)');
          path.setAttribute('stroke-width', '2');
          path.setAttribute('stroke-dasharray', 'none');
        }

        svg.appendChild(path);
      });
    });
  }

  // 重新计算并应用所有已购升级加成 (用于读档或重置)
  function recalculateAllUpgrades(game) {
    // 重置基础属性至默认值
    game.brewSpeed = 3.0;
    game.beanCostMultiplier = 1.0;
    game.autoDripUnlocked = !!(game.epUpgrades && game.epUpgrades.autoDrip) || (game.upgradesPurchased && !!game.upgradesPurchased['god']);
    game.salesMultiplier = 1.0;
    game.trafficBaseRate = 0.5;
    game.salesBaseFrequency = 1.0;
    game.brewYieldMultiplier = 1;
    game.passiveInterestUnlocked = false;

    // 快男系列等级计算 (兼容老存档 km1, km2, km3)
    const kmLevel = getNodeLevel({ id: 'km' }, game);
    if (game.upgradesPurchased) {
      game.upgradesPurchased['km'] = kmLevel;
    }

    if (kmLevel >= 3) {
      game.brewSpeed = 0.5;
    } else if (kmLevel === 2) {
      game.brewSpeed = 1.0;
    } else if (kmLevel === 1) {
      game.brewSpeed = 2.0;
    } else {
      game.brewSpeed = 3.0;
    }

    // 重新计算客流基础概率 (基于优化选址等级)
    if (typeof game.recalcTrafficRate === 'function') {
      game.recalcTrafficRate();
    }

    // 依次应用常规单级升级
    TREE_NODES.forEach(node => {
      if (!node.isMultiLevel && game.upgradesPurchased && game.upgradesPurchased[node.id]) {
        if (typeof node.apply === 'function') {
          node.apply(game);
        }
      }
    });

    // 连锁加盟与资本上市永久加成结算
    if (game.fp > 0) {
      // 每个声誉点永久提供 +2% 销售售价
      game.salesMultiplier += game.fp * 0.02;
    }
    if (game.ce > 0) {
      // 每一点股权提供 +10% 销售售价与 0.5% 生产成本削减
      game.salesMultiplier += game.ce * 0.10;
      game.beanCostMultiplier = Math.max(0.3, game.beanCostMultiplier - game.ce * 0.005);
    }
  }

  // 仅局部更新神也怕累节点卡片状态，避免全量重算与 SVG 连线重绘导致的重影闪烁
  function updateGodNodeCard(game) {
    const card = document.getElementById('node-god');
    if (!card) return;
    const isAuto = game.autoDripEnabled !== false;
    const badgeEl = card.querySelector('.badge-limit');
    const costEl = card.querySelector('.node-cost');
    const footerSpan = card.querySelector('.node-footer span:first-child');
    const statusText = card.querySelector('.node-status-text');

    if (badgeEl) {
      badgeEl.style.background = isAuto ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)';
      badgeEl.style.color = isAuto ? '#34d399' : '#fbbf24';
      badgeEl.textContent = isAuto ? '🤖 自动模式' : '✋ 手动模式';
    }
    if (costEl) {
      costEl.style.color = isAuto ? '#34d399' : '#fbbf24';
      costEl.textContent = isAuto ? '自动运转中' : '已暂停自动';
    }
    if (footerSpan) {
      footerSpan.textContent = isAuto ? '滴滤器全自动循环萃取' : '已切回手动，需点击开始萃取';
    }
    if (statusText) {
      statusText.style.color = isAuto ? '#34d399' : '#38bdf8';
      statusText.textContent = `🔄 点击切换为【${isAuto ? '手动' : '自动'}】`;
    }
  }

  // 窗口改变与屏幕旋转时重绘 SVG
  window.addEventListener('resize', () => {
    if (window.GameInstance) {
      drawConnections(window.GameInstance);
    }
  });
  window.addEventListener('orientationchange', () => {
    if (window.GameInstance) {
      setTimeout(() => drawConnections(window.GameInstance), 120);
    }
  });

  return {
    TREE_NODES,
    initTree,
    updateAllNodes,
    updateAffordability,
    updateGodNodeCard,
    drawConnections,
    recalculateAllUpgrades,
    onNodeClick
  };
})();
