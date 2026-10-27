import {
  assertDevelopment,
  assertTestDatabaseName,
  databaseNameForMode,
  deleteTestDatabase,
  DEVICE_CHECK_DATABASE_NAME,
  DevelopmentOnlyError,
  NotATestDatabaseError,
  UI_CHECK_DATABASE_NAME,
} from '../../../src/features/dev-tools/testDatabases';
import { DATABASE_NAME } from '../../../src/persistence/database';

function recordingDeps(options: { isDevelopment?: boolean; closeError?: unknown } = {}) {
  const events: string[] = [];
  return {
    events,
    deps: {
      isDevelopment: options.isDevelopment,
      open: async (name: string) => {
        events.push(`open ${name}`);
        return {
          closeAsync: async () => {
            events.push(`close ${name}`);
            if (options.closeError !== undefined) {
              throw options.closeError;
            }
          },
        };
      },
      deleteDatabase: async (name: string) => {
        events.push(`delete ${name}`);
      },
    },
  };
}

describe('assertDevelopment', () => {
  it('passes in development and refuses outside it', () => {
    expect(() => assertDevelopment(true)).not.toThrow();
    expect(() => assertDevelopment(false)).toThrow(DevelopmentOnlyError);
  });
});

describe('assertTestDatabaseName', () => {
  it('accepts exactly the two test databases', () => {
    expect(assertTestDatabaseName(DEVICE_CHECK_DATABASE_NAME)).toBe(DEVICE_CHECK_DATABASE_NAME);
    expect(assertTestDatabaseName(UI_CHECK_DATABASE_NAME)).toBe(UI_CHECK_DATABASE_NAME);
  });

  it.each([
    ['the normal database', DATABASE_NAME],
    ['an empty name', ''],
    ['another case', 'TARGET-PRACTICE-UI-CHECK.db'],
    ['surrounding space', ` ${UI_CHECK_DATABASE_NAME}`],
    ['a path', `../${UI_CHECK_DATABASE_NAME}`],
    ['a missing extension', 'target-practice-ui-check'],
    ['another name', 'target-practice-test.db'],
  ])('refuses %s without echoing the name', (_label, name) => {
    expect(() => assertTestDatabaseName(name)).toThrow(NotATestDatabaseError);
    try {
      assertTestDatabaseName(name);
    } catch (error) {
      expect(error instanceof Error && name !== '' && error.message.includes(name)).toBe(false);
    }
  });
});

describe('databaseNameForMode', () => {
  it('opens the normal database in normal mode, also outside development', () => {
    expect(databaseNameForMode('normal', true)).toBe(DATABASE_NAME);
    expect(databaseNameForMode('normal', false)).toBe(DATABASE_NAME);
  });

  it('opens the UI check database in test mode only in development', () => {
    expect(databaseNameForMode('test', true)).toBe(UI_CHECK_DATABASE_NAME);
    expect(() => databaseNameForMode('test', false)).toThrow(DevelopmentOnlyError);
  });
});

describe('deleteTestDatabase', () => {
  it('opens, closes and then deletes an allowed test database', async () => {
    const { events, deps } = recordingDeps({ isDevelopment: true });

    await deleteTestDatabase(UI_CHECK_DATABASE_NAME, deps);

    expect(events).toEqual([
      `open ${UI_CHECK_DATABASE_NAME}`,
      `close ${UI_CHECK_DATABASE_NAME}`,
      `delete ${UI_CHECK_DATABASE_NAME}`,
    ]);
  });

  it('touches nothing outside development', async () => {
    const { events, deps } = recordingDeps({ isDevelopment: false });

    await expect(deleteTestDatabase(UI_CHECK_DATABASE_NAME, deps)).rejects.toThrow(
      DevelopmentOnlyError,
    );
    expect(events).toEqual([]);
  });

  it('never opens or deletes the normal database or another name', async () => {
    const { events, deps } = recordingDeps({ isDevelopment: true });

    await expect(deleteTestDatabase(DATABASE_NAME, deps)).rejects.toThrow(NotATestDatabaseError);
    await expect(deleteTestDatabase('other.db', deps)).rejects.toThrow(NotATestDatabaseError);
    expect(events).toEqual([]);
  });

  it('does not delete when the close fails, and reports the failure', async () => {
    const closeError = new Error('close failed');
    const { events, deps } = recordingDeps({ isDevelopment: true, closeError });

    await expect(deleteTestDatabase(UI_CHECK_DATABASE_NAME, deps)).rejects.toBe(closeError);
    expect(events).not.toContain(`delete ${UI_CHECK_DATABASE_NAME}`);
  });
});
