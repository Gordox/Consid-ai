// Importing the developer checks, the gate and the routes must not open, create or delete any
// database. Only explicit calls from the developer screen may do that.

const mockOpenDatabaseAsync = jest.fn();
const mockDeleteDatabaseAsync = jest.fn();

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: mockOpenDatabaseAsync,
  deleteDatabaseAsync: mockDeleteDatabaseAsync,
}));

// Lucide ships its icons as ES modules, which Jest does not load. The icons are irrelevant here.
jest.mock('lucide-react-native/icons/activity', () => ({ __esModule: true, default: () => null }));
jest.mock('lucide-react-native/icons/check', () => ({ __esModule: true, default: () => null }));
jest.mock('lucide-react-native/icons/chevron-left', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('lucide-react-native/icons/circle', () => ({ __esModule: true, default: () => null }));
jest.mock('lucide-react-native/icons/circle-alert', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('lucide-react-native/icons/lock', () => ({ __esModule: true, default: () => null }));
jest.mock('lucide-react-native/icons/plus', () => ({ __esModule: true, default: () => null }));
jest.mock('lucide-react-native/icons/refresh-cw', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('lucide-react-native/icons/triangle-alert', () => ({
  __esModule: true,
  default: () => null,
}));

describe('module imports', () => {
  it('open and delete no database', () => {
    jest.isolateModules(() => {
      require('../../../src/features/dev-tools/testDatabases');
      require('../../../src/features/dev-tools/DevChecksScreen');
      require('../../../src/features/dev-tools/TestModeBanner');
      require('../../../src/features/startup/DatabaseGate');
      require('../../../src/features/startup/trackedConnection');
      require('../../../app/dev/checks');
      require('../../../app/_layout');
    });

    expect(mockOpenDatabaseAsync).not.toHaveBeenCalled();
    expect(mockDeleteDatabaseAsync).not.toHaveBeenCalled();
  });
});
