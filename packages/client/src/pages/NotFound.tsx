import { EmptyState, EmptyStateLink } from '../components/PageState.tsx';

export default function NotFound() {
  return (
    <section>
      <h1>Page not found</h1>
      <EmptyState message="We couldn’t find the page you were looking for.">
        <EmptyStateLink to="/">Back to Home</EmptyStateLink>
      </EmptyState>
    </section>
  );
}
