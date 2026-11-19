/*
Shared loading, error, and empty states so every page looks and behaves the
same way while data is loading, when a request fails, or when there is
nothing to show yet.
*/

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import './PageState.css';

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="recipe-state state-box state-loading" role="status">
      <span className="state-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

// Placeholder recipe cards shown while a recipe list loads.
export function RecipeGridSkeleton({
  label,
  count = 6,
}: {
  label: string;
  count?: number;
}) {
  return (
    <div className="recipe-grid" role="status" aria-busy="true">
      <span className="state-visually-hidden">{label}</span>
      {Array.from({ length: count }, (_, index) => (
        <div className="skeleton-card" key={index} aria-hidden="true">
          <div className="skeleton-block skeleton-image" />
          <div className="skeleton-body">
            <div className="skeleton-block skeleton-line" />
            <div className="skeleton-block skeleton-line short" />
          </div>
        </div>
      ))}
    </div>
  );
}

// A failed request. Pass onRetry to show a Try again button.
export function ErrorState({
  message,
  onRetry,
  retryLabel = 'Try again',
  children,
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  children?: ReactNode;
}) {
  return (
    <div className="recipe-state state-box state-error" role="alert">
      <p>{message}</p>
      {onRetry && (
        <button className="secondary-button" onClick={onRetry} type="button">
          {retryLabel}
        </button>
      )}
      {children}
    </div>
  );
}

// Nothing to show yet. Children are an optional call to action.
export function EmptyState({
  title,
  message,
  children,
}: {
  title?: string;
  message: string;
  children?: ReactNode;
}) {
  return (
    <div className="recipe-state state-box">
      {title && <p className="state-title">{title}</p>}
      <p>{message}</p>
      {children}
    </div>
  );
}

/** Shown instead of data when the server says the user is not signed in. */
export function LoginPrompt({ message }: { message: string }) {
  return (
    <EmptyState message={message}>
      <Link className="primary-button" to="/login">
        Log in
      </Link>
    </EmptyState>
  );
}

// Link-styled call to action. ex) "Find a recipe" on an empty page.
export function EmptyStateLink({
  to,
  children,
}: {
  to: string;
  children: ReactNode;
}) {
  return (
    <Link className="secondary-button" to={to}>
      {children}
    </Link>
  );
}
