import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { PasswordGrid } from '../PasswordGrid';
import { useVaultStore } from '../../store/vaultStore';

vi.mock('../../store/vaultStore', () => ({
  useVaultStore: vi.fn(),
}));

describe('PasswordGrid Component', () => {
  const mockEntry = {
    id: 'test-id',
    name: 'Test Entry',
    username: 'testuser',
    password: 'testpass123',
    url: 'https://example.com',
    notes: 'Test notes',
    icon: 'test-icon',
    groupId: undefined,
    favorite: false,
    createdAt: '2023-01-01T00:00:00.000Z',
    updatedAt: '2023-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    vi.mocked(useVaultStore).mockReturnValue({
      vault: { entries: [mockEntry], groups: [], sharedWith: [], deletionRequests: [], owner: 'test@example.com', version: '1.0' },
      sharedSources: [],
      activeView: 'all',
      selectedGroupId: null,
      selectedEntryId: null,
      searchQuery: '',
      viewMode: 'grid',
      getFilteredEntries: vi.fn().mockReturnValue([mockEntry]),
      selectEntry: vi.fn(),
      toggleFavorite: vi.fn(),
      setViewMode: vi.fn(),
      setActiveView: vi.fn(),
      selectGroup: vi.fn(),
      currentUserRole: vi.fn().mockReturnValue('owner'),
      canViewGroup: vi.fn().mockReturnValue(true),
      canViewEntry: vi.fn().mockReturnValue(true),
      canEditGroup: vi.fn().mockReturnValue(true),
    } as any);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should render password grid', () => {
    render(<PasswordGrid onAddEntry={vi.fn()} />);

    expect(screen.getByText('Test Entry')).toBeInTheDocument();
    expect(screen.getByText('testuser')).toBeInTheDocument();
  });

  it('should copy username from entry card', async () => {
    render(<PasswordGrid onAddEntry={vi.fn()} />);

    screen.getAllByTitle('Copiar usuário')[0].click();

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('testuser');
    });
  });

  it('should copy password from entry card', async () => {
    render(<PasswordGrid onAddEntry={vi.fn()} />);

    screen.getAllByTitle('Copiar senha')[0].click();

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('testpass123');
    });
  });
});
