import { useEffect, useState } from 'react';
export function useClock() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
export function dateText(time: number, year = false) {
  return new Intl.DateTimeFormat('zh-CN', {
    ...(year ? { year: 'numeric' } : {}),
    month: '2-digit',
    day: '2-digit',
  })
    .format(time)
    .replaceAll('/', ' / ');
}
export function relativeText(time: number, now = Date.now()) {
  const diff = Math.max(0, now - time);
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return `${Math.floor(diff / 86_400_000)} 天前`;
}
