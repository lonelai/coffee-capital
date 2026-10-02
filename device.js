/**
 * device.js - 移动端与跨平台设备环境识别、User-Agent (UA) 深度检测与自适应布局引擎
 */

window.DeviceDetector = (function() {
  const rawUa = navigator.userAgent || navigator.vendor || window.opera || '';
  const ua = rawUa.toLowerCase();

  // 1. 深度系统内核识别
  const isIos = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /android/i.test(ua);
  const isHarmony = /harmonyos|hmos/i.test(ua);
  const isWindows = /windows nt/i.test(ua);
  const isMac = /macintosh|mac os x/i.test(ua) && !isIos;
  const isLinux = /linux/i.test(ua) && !isAndroid;
  const isWeChat = /micromessenger/i.test(ua);

  // 2. 移动设备与触控识别
  const isMobileUA = /android|webos|iphone|ipod|blackberry|iemobile|opera mini|mobile|crios/i.test(ua);
  const isTabletUA = /ipad|tablet|(android(?!.*mobile))/i.test(ua);
  const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0);

  // 3. 操作系统名称格式化
  let osName = '通用平台';
  if (isIos) osName = 'Apple iOS';
  else if (isHarmony) osName = 'Huawei HarmonyOS';
  else if (isAndroid) osName = 'Google Android';
  else if (isWindows) osName = 'Microsoft Windows';
  else if (isMac) osName = 'Apple macOS';
  else if (isLinux) osName = 'Linux';

  // 4. 浏览器环境名称
  let browserName = '标准浏览器';
  if (isWeChat) browserName = '微信内置浏览器 (WeChat)';
  else if (/edg/i.test(ua)) browserName = 'Microsoft Edge';
  else if (/chrome|crios/i.test(ua)) browserName = 'Google Chrome';
  else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) browserName = 'Apple Safari';
  else if (/firefox/i.test(ua)) browserName = 'Mozilla Firefox';

  // 5. 动态判定是否应激活移动端布局 (基于物理屏幕、UA、触控或视口)
  const isPhysicalMobile = (typeof window !== 'undefined' && window.screen)
    ? (Math.min(window.screen.width, window.screen.height) <= 500)
    : false;
  const isPhysicalTablet = (typeof window !== 'undefined' && window.screen)
    ? (Math.min(window.screen.width, window.screen.height) <= 1024 && isTouchDevice)
    : false;

  let hasEverBeenMobile = false;

  function checkIsMobile() {
    const screenMin = (typeof window !== 'undefined' && window.screen && window.screen.width)
      ? Math.min(window.screen.width, window.screen.height)
      : 1024;
    const vpWidth = window.innerWidth || (document.documentElement && document.documentElement.clientWidth) || 1024;

    // 1. 物理屏幕本身为手机（无论旋转方向、无论网页缩放多少），坚决永久锁定为移动端模式
    if (isPhysicalMobile || screenMin <= 500) {
      hasEverBeenMobile = true;
      return true;
    }

    // 2. UA 带有移动设备标识（iOS、Android、HarmonyOS、WeChat、Mobile等）
    if (isMobileUA || isIos || isAndroid || isHarmony) {
      hasEverBeenMobile = true;
      return true;
    }

    // 3. 平板或触控手势设备
    if (isTabletUA || isPhysicalTablet || (isTouchDevice && screenMin <= 1024 && isTabletUA)) {
      hasEverBeenMobile = true;
      return true;
    }

    // 4. 一旦被识别为移动端，严禁因滚动或页面内容溢出导致的 innerWidth 放大而降级为桌面模式
    if (hasEverBeenMobile && (isTouchDevice || isMobileUA || screenMin <= 500)) {
      return true;
    }

    // 5. 视口宽度判定（适用于 PC 浏览器缩窄窗口体验移动端）
    const isVpMobile = vpWidth <= 960;
    return isVpMobile;
  }

  // 6. 将识别结果应用为 HTML / Body 的 class 标记，驱动 CSS 自适应布局
  function applyDeviceClasses() {
    const isMobile = checkIsMobile();
    const root = document.documentElement;
    const body = document.body;

    if (!root) return;

    if (isMobile) {
      root.classList.add('is-mobile');
      root.classList.remove('is-desktop');
      if (body) {
        body.classList.add('is-mobile');
        body.classList.remove('is-desktop');
      }
    } else {
      root.classList.add('is-desktop');
      root.classList.remove('is-mobile');
      if (body) {
        body.classList.add('is-desktop');
        body.classList.remove('is-mobile');
      }
    }

    if (isTouchDevice) {
      root.classList.add('is-touch');
      if (body) body.classList.add('is-touch');
    }

    if (isIos) root.classList.add('os-ios');
    if (isAndroid) root.classList.add('os-android');
    if (isHarmony) root.classList.add('os-harmony');
  }

  // 立即在脚本解析时给 html 添加初始类，杜绝初始渲染闪烁
  if (document.documentElement) {
    applyDeviceClasses();
  }

  // 7. 屏幕尺寸变化与横竖屏旋转监听 (防抖 80ms)
  let resizeTimer = null;
  function handleResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      applyDeviceClasses();
      updateSettingsUI();
      // 通知升级树重绘 SVG 连接线以适应新宽度
      if (window.TreeSystem && window.GameInstance) {
        requestAnimationFrame(() => {
          window.TreeSystem.drawConnections(window.GameInstance);
        });
      }
    }, 80);
  }

  window.addEventListener('resize', handleResize);
  window.addEventListener('orientationchange', handleResize);

  // 8. 刷新设置页面中的「设备与环境识别」卡片
  function updateSettingsUI() {
    const isMobile = checkIsMobile();
    const badgeEl = document.getElementById('device-type-badge');
    const descEl = document.getElementById('device-mode-desc');
    const osEl = document.getElementById('device-os-text');
    const screenEl = document.getElementById('device-screen-val');
    const uaEl = document.getElementById('device-ua-text');

    if (badgeEl) {
      badgeEl.textContent = isMobile ? '📱 移动端自适应模式' : '💻 桌面宽屏模式';
      badgeEl.style.background = isMobile ? 'rgba(16, 185, 129, 0.2)' : 'rgba(56, 189, 248, 0.2)';
      badgeEl.style.color = isMobile ? '#34d399' : '#38bdf8';
    }

    if (descEl) {
      descEl.textContent = isMobile
        ? '已识别移动端 UA/视口：自动启用单列流式排版、大拇指触控按键与手势安全区适配。'
        : '已识别桌面端 UA/视口：自动开启全景双栏工坊、宽幅科技树与精密高光交互。';
    }

    if (osEl) {
      osEl.textContent = `${osName} · ${browserName}${isTouchDevice ? ' · 触摸屏' : ''}`;
    }

    if (screenEl) {
      const dpr = window.devicePixelRatio ? window.devicePixelRatio.toFixed(1) : '1.0';
      screenEl.textContent = `${window.innerWidth} × ${window.innerHeight} (DPR: ${dpr})`;
    }

    if (uaEl) {
      uaEl.textContent = rawUa;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    applyDeviceClasses();
    updateSettingsUI();
  });

  return {
    isMobile: checkIsMobile,
    isTouch: () => isTouchDevice,
    isIos: () => isIos,
    isAndroid: () => isAndroid,
    getOS: () => osName,
    getBrowser: () => browserName,
    getUA: () => rawUa,
    applyDeviceClasses,
    updateSettingsUI
  };
})();
