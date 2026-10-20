import type { BossType } from '../../shared/domain';
export default function Sprite({
  type,
  className = '',
}: {
  type: BossType | 'cat';
  className?: string;
}) {
  return (
    <div
      role="img"
      aria-label={
        { knight: '深渊骑士', slime: '森林史莱姆', skeleton: '骷髅法师', cat: '巫师猫' }[type]
      }
      className={`sprite sprite-${type} ${className}`}
    />
  );
}
