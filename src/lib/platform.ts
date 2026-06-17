// 偵測使用者裝置平台,用來在首頁過濾掉「這台機器幾乎用不到」的工具

export function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android/i.test(navigator.userAgent)
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/i.test(ua)) return true
  // iPad iOS 13+ 會偽裝成 macOS,用 touch points 判斷
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
}

export function isMobile(): boolean {
  return isAndroid() || isIOS()
}
