import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ConnectAccount } from './connect-account';

describe('ConnectAccount', () => {
  it('renders the title "Conectá tu cuenta de Instagram"', () => {
    render(<ConnectAccount />);
    expect(
      screen.getByText('Conectá tu cuenta de Instagram'),
    ).toBeInTheDocument();
  });

  it('renders the connect button', () => {
    render(<ConnectAccount />);
    expect(
      screen.getByRole('button', { name: 'Conectar Instagram' }),
    ).toBeInTheDocument();
  });

  it('renders the requirements list', () => {
    render(<ConnectAccount />);
    expect(screen.getByText('Requisitos:')).toBeInTheDocument();
    expect(
      screen.getByText(/Cuenta de Instagram Business o Creator/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Cuenta vinculada a una página de Facebook/),
    ).toBeInTheDocument();
  });

  it('renders the disclaimer text', () => {
    render(<ConnectAccount />);
    expect(screen.getByText(/Al conectar, autorizás a Corehub/)).toBeInTheDocument();
  });

  it('renders the description paragraph', () => {
    render(<ConnectAccount />);
    expect(
      screen.getByText(/Para empezar a analizar tu contenido/),
    ).toBeInTheDocument();
  });
});
