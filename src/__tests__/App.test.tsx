import { render, act } from '@testing-library/react';
import { vi } from 'vitest';
import { App } from '../App';
import { useVaultStore } from '../store/vaultStore';

vi.mock('../store/vaultStore', () => ({
  useVaultStore: vi.fn(),
}));

vi.mock('../components/MasterPasswordScreen', () => ({ MasterPasswordScreen: () => <div>Locked</div> }));
vi.mock('../components/Sidebar', () => ({ Sidebar: () => <aside>Sidebar</aside> }));
vi.mock('../components/PasswordGrid', () => ({ PasswordGrid: () => <main>Grid</main> }));
vi.mock('../components/AppMenuBar', () => ({ AppMenuBar: () => <nav>Menu</nav> }));
vi.mock('../components/PasswordForm', () => ({ PasswordForm: () => <div>Form</div> }));
vi.mock('../hooks/usePlatform', () => ({ usePlatform: () => ({ isAndroid: false }) }));

describe('App Component - Auto Lock & Polling', () => {
  const makeState = (overrides: Record<string, unknown> = {}) => ({
    isLocked: false,
    isDirty: false,
    isSyncing: false,
    syncError: null,
    vault: { entries: [], groups: [], sharedWith: [], deletionRequests: [], owner: 'test@example.com', version: '1.0' },
    googleToken: null,
    localVaultPath: null,
    driveFileId: null,
    syncToCloud: vi.fn(),
    saveToLocalFile: vi.fn(),
    initFromStorage: vi.fn().mockResolvedValue(undefined),
    initDriveChangesToken: vi.fn().mockResolvedValue(undefined),
    pollDriveChanges: vi.fn().mockResolvedValue(false),
    forceSync: vi.fn(),
    clearSyncError: vi.fn(),
    lockVault: vi.fn(),
    currentUserRole: vi.fn().mockReturnValue('owner'),
    ...overrides,
  });

  let state: ReturnType<typeof makeState>;

  beforeEach(() => {
    vi.useFakeTimers();
    state = makeState();
    vi.mocked(useVaultStore).mockImplementation(() => state as any);
    (useVaultStore as any).getState = vi.fn(() => state);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  it('should start with unlocked vault', () => {
    render(<App />);
    expect(useVaultStore).toHaveBeenCalled();
  });

  it('should lock vault after 5 minutes of inactivity', () => {
    render(<App />);

    act(() => {
      window.dispatchEvent(new Event('mousemove'));
      vi.advanceTimersByTime(5 * 60 * 1000);
    });

    expect(state.lockVault).toHaveBeenCalled();
  });

  it('should reset inactivity timer on user activity', () => {
    render(<App />);

    act(() => {
      window.dispatchEvent(new Event('mousemove'));
      vi.advanceTimersByTime(4 * 60 * 1000);
      window.dispatchEvent(new Event('keypress'));
      vi.advanceTimersByTime(4 * 60 * 1000);
    });

    expect(state.lockVault).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(60 * 1000);
    });

    expect(state.lockVault).toHaveBeenCalled();
  });

  it('should not start timer when vault is already locked', () => {
    state = makeState({ isLocked: true, lockVault: vi.fn() });
    vi.mocked(useVaultStore).mockImplementation(() => state as any);
    (useVaultStore as any).getState = vi.fn(() => state);

    render(<App />);

    act(() => {
      window.dispatchEvent(new Event('mousemove'));
      vi.advanceTimersByTime(10 * 60 * 1000);
    });

    expect(state.lockVault).not.toHaveBeenCalled();
  });

  it('should call pollDriveChanges on interval when Drive is connected', () => {
    state = makeState({ googleToken: { access_token: 'tok', expires_at: Date.now() + 3600000, token_type: 'Bearer' } });
    vi.mocked(useVaultStore).mockImplementation(() => state as any);
    (useVaultStore as any).getState = vi.fn(() => state);

    render(<App />);

    act(() => { vi.advanceTimersByTime(5000); });
    expect(state.pollDriveChanges).toHaveBeenCalledTimes(1);

    act(() => { vi.advanceTimersByTime(5000); });
    expect(state.pollDriveChanges).toHaveBeenCalledTimes(2);
  });

  it('should NOT call pollDriveChanges when Drive is not connected', () => {
    // googleToken: null (default state)
    render(<App />);

    act(() => { vi.advanceTimersByTime(15000); });
    expect(state.pollDriveChanges).not.toHaveBeenCalled();
  });
});
