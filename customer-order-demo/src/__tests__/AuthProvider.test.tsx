import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AuthProvider, useAuth } from '@/hooks/AuthContext';
import type { IAuthService } from '@/services/IAuthService';

const stubAuthService: IAuthService = {
  fabricAuthEnabled: false,
  async signIn() {
    return { id: 'u1', email: 'dev@contoso.com', name: 'dev' };
  },
  async signOut() {},
  async getCurrentUser() {
    return null;
  },
  async initEmbeddedAuth() {
    return null;
  },
};

describe('AuthProvider', () => {
  it('renders children once initial auth check completes', async () => {
    render(
      <AuthProvider authService={stubAuthService}>
        <div data-testid="content">ready</div>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('content')).toHaveTextContent('ready');
    });
  });

  it('surfaces authentication initialization failures', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    function AuthStatus() {
      const { error, loading } = useAuth();
      return <div>{loading ? 'Loading' : error}</div>;
    }
    render(
      <AuthProvider authService={{ ...stubAuthService, initEmbeddedAuth: async () => { throw new Error('Fabric sign-in unavailable'); } }}>
        <AuthStatus />
      </AuthProvider>
    );
    expect(await screen.findByText('Fabric sign-in unavailable')).toBeInTheDocument();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it('awaits embedded authentication before restoring an existing user', async () => {
    let finish!: () => void;
    const embedded = new Promise<null>(resolve => { finish = () => resolve(null); });
    const current = vi.fn().mockResolvedValue({ id: 'u1', email: 'demo@example.com', name: 'Demo' });
    function AuthStatus() {
      const { user, loading } = useAuth();
      return <div>{loading ? 'Loading' : user?.name}</div>;
    }
    render(
      <AuthProvider authService={{ ...stubAuthService, initEmbeddedAuth: () => embedded, getCurrentUser: current }}>
        <AuthStatus />
      </AuthProvider>
    );
    expect(current).not.toHaveBeenCalled();
    finish();
    expect(await screen.findByText('Demo')).toBeInTheDocument();
    expect(current).toHaveBeenCalledTimes(1);
  });
});
