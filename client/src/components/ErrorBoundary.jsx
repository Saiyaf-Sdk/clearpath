import { Component } from 'react';
import { RefreshCw, TriangleAlert } from 'lucide-react';

// Catches a crash inside a page so the rest of the app (sidebar, top bar) keeps working
// and the user sees a clear message instead of a blank screen.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Page crashed:', error, info?.componentStack);
  }

  componentDidUpdate(prev) {
    // Navigating to another page clears the error
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    // After a new deployment, old page files no longer exist – a reload fetches the new version
    const isChunk = /Loading chunk|dynamically imported module|Importing a module script failed/i.test(String(error?.message));
    return (
      <div className="crash">
        <div className="crash-icon"><TriangleAlert size={26} /></div>
        <h2>{isChunk ? 'A new version of ClearPath is available' : 'This page ran into a problem'}</h2>
        <p className="muted">
          {isChunk ? 'Reload to get the latest version.' : 'The rest of the app still works. Try again, or reload the page.'}
        </p>
        <div className="row-gap" style={{ justifyContent: 'center', marginTop: 16 }}>
          {!isChunk && <button className="btn btn-ghost" onClick={() => this.setState({ error: null })}>Try again</button>}
          <button className="btn btn-primary" onClick={() => window.location.reload()}><RefreshCw size={16} /> Reload page</button>
        </div>
        {import.meta.env.DEV && <pre className="crash-detail">{String(error?.stack || error)}</pre>}
      </div>
    );
  }
}
