import { useState, useEffect } from 'react';

declare global {
  interface Window {
    dkb: {
      minimizeWindow: () => Promise<void>;
      maximizeWindow: () => Promise<void>;
      closeWindow: () => Promise<void>;
      isMaximized: () => Promise<boolean>;
    };
  }
}

function isElectron(): boolean {
  return typeof window !== 'undefined' && 'dkb' in window;
}

function MinimizeIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 1">
      <rect width="10" height="1" fill="currentColor" />
    </svg>
  );
}

function MaximizeIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10">
      <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" />
    </svg>
  );
}

function RestoreIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10">
      <rect x="3" y="0" width="7" height="7" fill="none" stroke="currentColor" />
      <rect x="0" y="3" width="7" height="7" fill="none" stroke="currentColor" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10">
      <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="1" />
      <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

export default function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (isElectron()) {
      window.dkb.isMaximized().then(setIsMaximized);
    }
  }, []);

  if (!isElectron()) return null;

  const handleMaximize = async () => {
    await window.dkb.maximizeWindow();
    const updated = await window.dkb.isMaximized();
    setIsMaximized(updated);
  };

  return (
    <div
      className="h-8 bg-surface border-b border-border flex items-center justify-between select-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="flex items-center gap-2 px-3">
        <span className="text-sm font-semibold text-gray-300">DKB Bilanz</span>
      </div>
      <div
        className="flex items-center"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={() => window.dkb.minimizeWindow()}
          className="w-12 h-8 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
        >
          <MinimizeIcon />
        </button>
        <button
          onClick={handleMaximize}
          className="w-12 h-8 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
        >
          {isMaximized ? <RestoreIcon /> : <MaximizeIcon />}
        </button>
        <button
          onClick={() => window.dkb.closeWindow()}
          className="w-12 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-danger/50 transition-colors"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}
