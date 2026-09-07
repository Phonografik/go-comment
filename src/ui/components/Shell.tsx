// The 320×600 frame every screen sits in, plus the two shared chrome pieces:
// the pixel wordmark and the back-button header for the sub-screens.
import type { ReactNode } from 'react';
import { Glyph } from './Glyph';

export function Frame({ screen, children }: { screen: string; children: ReactNode }) {
  return (
    <div data-screen={screen} className="flex h-[600px] w-[320px] flex-col overflow-hidden bg-ink text-text">
      {children}
    </div>
  );
}

export function Wordmark({ className = 'text-[14px]' }: { className?: string }) {
  return <div className={`font-pixel tracking-[0.5px] text-cyan ${className}`}>GO COMMENT</div>;
}

interface HeaderProps {
  title: string;
  onBack: () => void;
  right?: ReactNode;
}

export function ScreenHeader({ title, onBack, right }: HeaderProps) {
  return (
    <div className="flex items-center gap-3 px-3.5 pt-3 pb-2">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back to dashboard"
        className="flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-surface hover:text-text"
      >
        <Glyph name="back" size={10} />
      </button>
      <h1 className="font-pixel text-[13px] tracking-[0.5px] text-cyan">{title}</h1>
      {right ? <div className="ml-auto text-[11px] text-muted">{right}</div> : null}
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded border border-line bg-surface px-3 py-2 ${className}`}>{children}</section>;
}
