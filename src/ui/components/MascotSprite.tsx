// The parrot in the dashboard hero: the stage grid from src/ui/sprites/parrot.ts
// drawn by <PixelSprite> at 4× (24-grid → 96 px). One place to change how the
// mascot is drawn; the stage itself is decided by src/core/mascot.ts.
import { PixelSprite } from '@/src/ui/PixelSprite';
import { PARROT_STAGES } from '@/src/ui/sprites/parrot';

interface Props {
  stage: number;
  /** grid pixels → screen pixels; the hero uses 4 */
  scale?: number;
  title: string;
  className?: string;
}

export function MascotSprite({ stage, scale = 4, title, className }: Props) {
  const grid = PARROT_STAGES[stage] ?? PARROT_STAGES[0];
  return (
    <div data-sprite-stage={stage} className={`shrink-0 ${className ?? ''}`}>
      <PixelSprite grid={grid} scale={scale} title={title} />
    </div>
  );
}
