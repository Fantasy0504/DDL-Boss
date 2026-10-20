import { useEffect, useRef, useState } from 'react';
import { hp, status, timeLeft, type BossType } from '../../shared/domain';
import { initialize, useStore } from '../store';
import { useClock } from '../hooks';
import Sprite from './Sprite';

export default function FloatingBoss() {
  const data = useStore((s) => s.data);
  const battle = useStore((s) => s.battle);
  const [currentId, setCurrentId] = useState<string | undefined>();
  const [hover, setHover] = useState(false);
  const [hit, setHit] = useState(false);
  const pet = useRef<HTMLDivElement>(null);
  const tooltip = useRef<HTMLDivElement>(null);
  const pixels = useRef<ImageData | null>(null);
  const dragging = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const interactive = useRef(false);
  const now = useClock();
  useEffect(() => {
    void initialize();
    const img = new Image();
    img.src = './assets/characters.png';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0);
      pixels.current = ctx.getImageData(0, 0, img.width, img.height);
    };
  }, []);
  const candidate = data?.tasks
    .filter((t) => !t.defeatedAt)
    .sort((a, b) => a.deadline - b.deadline)[0];
  const current = data?.tasks.find((t) => t.id === currentId);
  useEffect(() => {
    if (!current || current.defeatedAt) {
      const timer = setTimeout(
        () => {
          setCurrentId(candidate?.id);
          if (candidate) useStore.getState().select(candidate.id);
        },
        current?.defeatedAt ? 1100 : 0,
      );
      return () => clearTimeout(timer);
    }
    if (candidate && candidate.id !== currentId) {
      setCurrentId(candidate.id);
      useStore.getState().select(candidate.id);
    }
  }, [candidate?.id, currentId, current?.defeatedAt]);
  useEffect(() => {
    if (battle?.taskId !== currentId) return;
    setHit(true);
    const timer = setTimeout(() => setHit(false), 750);
    return () => clearTimeout(timer);
  }, [battle, currentId]);
  const type: BossType | 'cat' = current?.bossType ?? 'cat';
  useEffect(() => {
    const check = (event: MouseEvent) => {
      if (dragging.current) return;
      let solid = false;
      const tip = tooltip.current?.getBoundingClientRect();
      if (
        hover &&
        tip &&
        event.clientX >= tip.left &&
        event.clientX < tip.right &&
        event.clientY >= tip.top &&
        event.clientY < tip.bottom
      )
        solid = true;
      const rect = pet.current?.getBoundingClientRect(),
        image = pixels.current;
      if (!solid && rect && image) {
        const x = (event.clientX - rect.left) / rect.width,
          y = (event.clientY - rect.top) / rect.height;
        if (x >= 0 && x < 1 && y >= 0 && y < 1) {
          const col = type === 'slime' || type === 'cat' ? 1 : 0,
            row = type === 'skeleton' || type === 'cat' ? 1 : 0;
          const sx = Math.min(image.width - 1, Math.floor(((col + x) * image.width) / 2));
          const sy = Math.min(image.height - 1, Math.floor(((row + y) * image.height) / 2));
          solid = image.data[(sy * image.width + sx) * 4 + 3] > 30;
        }
      }
      if (solid !== interactive.current) {
        interactive.current = solid;
        window.dungeon?.mouseInteractive(solid);
        setHover(solid);
      }
    };
    const leave = () => {
      if (!dragging.current) {
        interactive.current = false;
        setHover(false);
        window.dungeon?.mouseInteractive(false);
      }
    };
    document.addEventListener('mousemove', check);
    document.addEventListener('mouseleave', leave);
    return () => {
      document.removeEventListener('mousemove', check);
      document.removeEventListener('mouseleave', leave);
    };
  }, [type, hover]);
  return (
    <div
      className="floating-root"
      onContextMenu={(e) => {
        e.preventDefault();
        window.dungeon?.floatingMenu();
      }}
    >
      <div ref={tooltip} className={`float-tooltip ${hover ? 'visible' : ''}`}>
        <strong>{current?.title ?? '今天的 DDL，全部拿下！'}</strong>
        <p>
          <span>{current ? timeLeft(current.deadline, now) : '休息一下，再出发'}</span>
          <b>{current ? hp(current) : 0} / 1000</b>
        </p>
        <div className="bar red">
          <div style={{ width: `${current ? hp(current) / 10 : 0}%` }} />
        </div>
        <small>单击打开 · 拖动移动 · 右键菜单</small>
      </div>
      <div
        ref={pet}
        className={`float-pet ${current ? status(current, now) : ''} ${hit ? 'hit' : ''}`}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          pet.current?.setPointerCapture(e.pointerId);
          dragging.current = { x: e.screenX, y: e.screenY, moved: false };
          window.dungeon?.drag('start', e.screenX, e.screenY);
        }}
        onPointerMove={(e) => {
          const drag = dragging.current;
          if (!drag) return;
          if (Math.abs(e.screenX - drag.x) + Math.abs(e.screenY - drag.y) > 5) drag.moved = true;
          if (drag.moved) window.dungeon?.drag('move', e.screenX, e.screenY);
        }}
        onPointerUp={(e) => {
          const drag = dragging.current;
          if (!drag) return;
          dragging.current = null;
          window.dungeon?.drag('end', e.screenX, e.screenY);
          pet.current?.releasePointerCapture(e.pointerId);
          if (!drag.moved) window.dungeon?.windowAction('show', current?.id);
        }}
        onPointerCancel={(e) => {
          dragging.current = null;
          window.dungeon?.drag('end', e.screenX, e.screenY);
        }}
      >
        <Sprite type={type} />
      </div>
      {hit && battle && (
        <span className="float-damage" key={battle.key}>
          −{battle.damage}
        </span>
      )}
    </div>
  );
}
