# ☕ 咖啡资本家 (Coffee Capital)

> 一款基于原生 JavaScript 构建的高性能增量经营（Incremental / Idle）创业模拟游戏。从清晨街头的一辆单头手冲滴滤小摊起步，逐步扩张为自动化连锁手冲咖啡商业帝国！

[![Deploy to GitHub Pages](https://github.com/lonelai/coffee-capital/actions/workflows/deploy.yml/badge.svg)](https://github.com/lonelai/coffee-capital/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Web%20%2F%20Mobile%20PWA-orange)](https://coffee-capital-44d.pages.dev)

---

## 🌐 在线体验与运行

- **Cloudflare Pages 生产部署**：[https://coffee-capital-44d.pages.dev](https://coffee-capital-44d.pages.dev)
- **GitHub Pages 在线游玩**：[https://lonelai.github.io/coffee-capital](https://lonelai.github.io/coffee-capital)

---

## ✨ 核心游戏玩法与系统特色

### 1. ☕ 滴滤小摊 (Coffee Stall)
- **多台滴滤器并行冲煮**：支持最多购置 10 台咖啡滴滤设备，支持单台手动萃取与全自动一键批量萃取。
- **动态客流与连售机制**：客流率决定顾客购买频率，当咖啡库存 ≥ 2 且客流充裕时，可触发双杯连售暴击！
- **商业升级与选址**：提升手冲手法缩短萃取耗时（急速手冲 0.5s），扩张优质商圈选址提高基础客流。

### 2. 🎒 三层转生重置体系 (Prestige Layers)
- **第一层 · 摆摊经验 (EP - Stall Experience)**：现金满 ¥100 起步折算，解锁自动滴滤设备、现磨不隔夜与指数级定价科技。累积 3.0 EP 激活【记下笔记】，永久保留小摊设备与升级。
- **第二层 · 特许经营 (FP - Franchise Points)**：连锁化经营，解锁品牌倍率与区域垄断特权。
- **第三层 · 资本帝国 (CE - Capital Empire)**：进入金融与资本运作，跨国咖啡期货与资本并购。

### 3. 🌳 无标题科技树 (Untitled Tech Tree)
- 纯 2D GPU 高性能矢量连线与平滑拖拽缩放系统（支持 45% ~ 200% 平滑缩放），无缝驱动阿尔法 (α) 与贝塔 (β) 能量生产线。

### 4. 🏆 成就系统 (Achievements)
- 拥有 50 项进阶成就与里程碑，每项成就赋予单杯咖啡售价 1.02x 永久复利加成。
- 移动端专属单行圆角矩形优雅通知条，兼顾沉浸感与紧凑视觉。

### 5. 📱 全平台环境适配 (Device Adaptive)
- 内置 `device.js` 设备与触控深度检测引擎，完美自适应桌面端、平板、折叠屏与各类手机屏幕尺寸，支持深浅色与 Miuix 质感主题切换。

---

## 🛠️ 技术栈与架构设计

- **前端架构**：原生 HTML5 + 现代化纯 CSS3 (Grid/Flex/Custom Properties) + ES6+ JavaScript（零构建工具依赖，即拉即跑）。
- **边缘计算支持**：Cloudflare Workers (`_worker.js`)，支持 `/api/compute` 边缘分流推演与离线收益推算。
- **本地存档系统**：`LocalStorage` 毫秒级防抖持久化，支持 Base64 编码存档一键导入导出。
- **部署与同步保证**：内置 `tools/check-sync.mjs`，确保根目录（唯一真源）、`public/` 与部署包 `coffee-capital-cf-deploy.zip` 严格保持 SHA-256 逐字节一致。

---

## 🚀 本地开发与运行

无需复杂的 `npm install` 或构建流程：

```bash
# 1. 克隆代码仓库
git clone https://github.com/lonelai/coffee-capital.git
cd coffee-capital

# 2. 本地静态服务启动（任意方式均可）
# 使用 Python 启动:
python -m http.server 8080

# 或使用 Node.js 启动:
npx serve .
```

在浏览器打开 `http://localhost:8080` 即可畅玩！

---

## 📦 副本同步校验

当修改核心静态文件后，可一键验证并同步至部署镜像与离线安装包：

```bash
# 检查三份部署副本一致性
node tools/check-sync.mjs

# 自动修复并重建差异项
node tools/check-sync.mjs --fix
```

---

## 📄 开源许可证

本项目采用 [MIT 许可证](LICENSE)。
