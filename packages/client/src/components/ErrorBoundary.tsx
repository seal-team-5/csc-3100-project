/*
Catches unexpected rendering errors so one broken page shows a friendly
message instead of a blank screen. The navbar stays usable, and the boundary
resets when the route changes because App gives it a key per route.
*/

import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { ErrorState } from './PageState';

type Props = { children: ReactNode };
type State = { failed: boolean };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Page crashed:', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section>
        <h1>Something went wrong</h1>
        <ErrorState
          message="This page ran into an unexpected problem."
          onRetry={() => window.location.reload()}
          retryLabel="Reload page"
        />
      </section>
    );
  }
}
