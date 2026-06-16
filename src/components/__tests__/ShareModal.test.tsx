import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { ShareModal } from '../ShareModal';
import { useVaultStore } from '../../store/vaultStore';
import { shareFile } from '../../services/googleDrive';

vi.mock('../../store/vaultStore', () => ({
  useVaultStore: vi.fn(),
}));

vi.mock('../../services/googleDrive', () => ({
  shareFile: vi.fn().mockResolvedValue(undefined),
  startOAuthFlow: vi.fn(),
}));

describe('ShareModal Component', () => {
  const mockVault = {
    entries: [{ id: '1', name: 'Test Entry', username: 'user', password: 'pass' }],
    groups: [],
    owner: 'owner@example.com',
    sharedWith: [],
    deletionRequests: [],
    version: '1.0',
  };

  const mockTarget = {
    id: '1',
    name: 'Test Entry',
    username: 'user',
    password: 'pass',
  } as any;

  const updateSharedUserRole = vi.fn();
  const addVaultPasswordSlot = vi.fn().mockResolvedValue(undefined);
  const syncToCloud = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.mocked(useVaultStore).mockReturnValue({
      vault: mockVault,
      googleToken: { access_token: 'token', expires_at: Date.now() + 3600000, token_type: 'Bearer' },
      userInfo: { email: 'owner@example.com', name: 'Owner', picture: '' },
      driveFileId: 'drive-file-id',
      setGoogleToken: vi.fn(),
      ensureValidToken: vi.fn().mockResolvedValue({ access_token: 'token', expires_at: Date.now() + 3600000, token_type: 'Bearer' }),
      updateSharedUserRole,
      syncToCloud,
      addVaultPasswordSlot,
    } as any);
    (useVaultStore as any).getState = vi.fn().mockReturnValue({ driveFileId: 'drive-file-id' });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should render share modal when target provided', () => {
    render(<ShareModal target={mockTarget} type="entry" onClose={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Compartilhar' })).toBeInTheDocument();
    expect(screen.getByText(/Senha: Test Entry/)).toBeInTheDocument();
    expect(screen.getByText('Senha de compartilhamento')).toBeInTheDocument();
  });

  it('should share the main Drive file and store scoped permission', async () => {
    render(<ShareModal target={mockTarget} type="entry" onClose={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('destinatario@gmail.com'), { target: { value: 'dest@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Senha para abrir este cofre'), { target: { value: 'share-secret' } });
    screen.getByRole('button', { name: /compartilhar/i }).click();

    await waitFor(() => {
      expect(shareFile).toHaveBeenCalledWith(
        expect.objectContaining({ access_token: 'token' }),
        'drive-file-id',
        'dest@example.com',
        'reader',
        expect.any(String)
      );
    });
    expect(updateSharedUserRole).toHaveBeenCalledWith('dest@example.com', 'reader', 'entry', '1', 'Test Entry');
    expect(addVaultPasswordSlot).toHaveBeenCalledWith('share:dest@example.com:entry:1', 'share-secret');
    expect(syncToCloud).toHaveBeenCalled();
  });
});
