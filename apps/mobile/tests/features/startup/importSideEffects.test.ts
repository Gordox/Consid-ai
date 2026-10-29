// Importing the gate and the root layout must not open, create or delete any database. Only
// DatabaseGate's lifecycle opens the app's database, once it is mounted.

const mockOpenDatabaseAsync = jest.fn();
const mockDeleteDatabaseAsync = jest.fn();

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: mockOpenDatabaseAsync,
  deleteDatabaseAsync: mockDeleteDatabaseAsync,
}));

describe('module imports', () => {
  it('open and delete no database', () => {
    jest.isolateModules(() => {
      require('../../../src/features/startup/DatabaseGate');
      require('../../../src/features/startup/trackedConnection');
      require('../../../app/_layout');
    });

    expect(mockOpenDatabaseAsync).not.toHaveBeenCalled();
    expect(mockDeleteDatabaseAsync).not.toHaveBeenCalled();
  });
});
