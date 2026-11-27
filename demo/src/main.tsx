import { Component, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Le champ virtuel — erreur inattendue', error, info);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="crash" role="alert">
        <p className="eyebrow">Le champ virtuel</p>
        <h1>La visite s’est interrompue.</h1>
        <p>
          Rechargez la page pour retrouver la parcelle. Rien n’a été enregistré : la démonstration ne modifie aucune
          donnée.
        </p>
        <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
          Recharger la visite
        </button>
      </div>
    );
  }
}

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <Boundary>
      <App />
    </Boundary>,
  );
}
