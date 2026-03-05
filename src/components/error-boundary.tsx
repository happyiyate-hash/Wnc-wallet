
'use client';

import React from 'react';
import { handleError } from '@/lib/errors/error-handler';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * INTERFACE ERROR BOUNDARY
 * Protects the terminal from component-level protocol failures.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown) {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, errorInfo: unknown) {
    const message = handleError(error, 'Interface Crash');
    this.setState({ message });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center space-y-6 bg-black/20 backdrop-blur-xl rounded-[3rem] border border-white/10 m-4 shadow-2xl animate-in fade-in zoom-in-95 duration-500">
          <div className="w-16 h-16 rounded-[1.5rem] bg-destructive/10 flex items-center justify-center text-destructive border border-destructive/20 shadow-lg">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-black uppercase tracking-tight text-white">Interface Protocol Failure</h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-[280px] mx-auto font-medium">
              {this.state.message || 'An unexpected error has interrupted the terminal node.'}
            </p>
          </div>
          <Button 
            onClick={() => window.location.reload()}
            className="h-14 px-8 rounded-2xl font-black uppercase tracking-widest bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20 transition-all active:scale-95"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Restart Node
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
