import { Component, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Without this, an uncaught error anywhere in the render tree unmounts the
 * whole app and leaves nothing but the dark <body> background - a silent
 * blank screen with no indication anything went wrong. This catches that and
 * shows a recoverable message with the actual error instead.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('Onyx Code crashed:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }

    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-[#18181b] p-8 text-center font-sans text-[#cccccc]">
        <AlertTriangle size={32} className="text-red-400" />
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-white">Onyx Code hit an unexpected error</p>
          <p className="max-w-lg text-xs text-[#858585]">
            Something in the UI crashed instead of the whole window going blank. The details below
            may point at the cause; reloading usually recovers cleanly.
          </p>
        </div>
        <pre className="max-h-40 max-w-xl overflow-auto rounded border border-[#333333] bg-[#111318] p-3 text-left text-[11px] text-red-300">
          {error.message}
        </pre>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-1.5 rounded bg-[#007acc] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0062a3]"
        >
          <RotateCcw size={12} />
          Reload
        </button>
      </div>
    );
  }
}
