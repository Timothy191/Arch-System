import {
  bumpPrivilegeVersion,
  type EmployeeRecord,
  employeeCacheKey,
  getPrivilegeVersion,
  privilegeVersionKey,
  readSession,
  revokeSession,
  sessionKey,
  sessionTtl,
  touchSession,
  writeSession,
} from '../src/session';

const mockSendSafe = jest.fn();
const mockCacheGet = jest.fn();
const mockCacheSet = jest.fn();
const mockMemoryDelete = jest.fn();
const mockIncrementCounter = jest.fn();

jest.mock('../src/client', () => ({
  getRedisClient: jest.fn(async () => ({})),
}));

jest.mock('../src/raw', () => {
  const original = jest.requireActual('../src/raw');
  return {
    ...original,
    sendSafe: (...args: unknown[]) => mockSendSafe(...args),
  };
});

jest.mock('../src/cache', () => ({
  cacheGet: (...args: unknown[]) => mockCacheGet(...args),
  cacheSet: (...args: unknown[]) => mockCacheSet(...args),
  memoryDelete: (...args: unknown[]) => mockMemoryDelete(...args),
}));

jest.mock('../src/analytics', () => ({
  incrementCounter: (...args: unknown[]) => mockIncrementCounter(...args),
}));

describe('Session & Privilege Fencing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const sampleEmployee: EmployeeRecord = {
    id: 'emp-101',
    role: 'operator',
    department_id: 'dept-mining',
    accessible_departments: ['dept-mining', 'dept-plant'],
  };

  test('constructs proper key formats', () => {
    expect(employeeCacheKey('usr-1')).toBe('arch:auth:employee:usr-1');
    expect(privilegeVersionKey('usr-1')).toBe('arch:auth:privilege:usr-1');
    expect(sessionKey('usr-1')).toBe('arch:auth:employee:usr-1');
    expect(sessionKey('usr-1', { sessionId: 'tab-99' })).toBe(
      'arch:auth:employee:usr-1:session:tab-99'
    );
  });

  test('reads privilege version from Redis', async () => {
    mockSendSafe.mockResolvedValueOnce('5');
    const version = await getPrivilegeVersion('usr-1');
    expect(version).toBe(5);
    expect(mockSendSafe).toHaveBeenCalledWith(expect.anything(), [
      'GET',
      'arch:auth:privilege:usr-1',
    ]);
  });

  test('bumps privilege version and purges keys', async () => {
    mockSendSafe.mockResolvedValueOnce(6); // INCR
    mockSendSafe.mockResolvedValueOnce('OK'); // DEL
    mockSendSafe.mockResolvedValueOnce('OK'); // EXPIRE

    const newVersion = await bumpPrivilegeVersion('usr-1');
    expect(newVersion).toBe(6);
    expect(mockMemoryDelete).toHaveBeenCalledWith('arch:auth:employee:usr-1');
  });

  test('writeSession stamps the record with current privilege version', async () => {
    mockSendSafe.mockResolvedValueOnce('3'); // getPrivilegeVersion returns 3

    await writeSession({ userId: 'usr-1', employee: sampleEmployee });

    expect(mockCacheSet).toHaveBeenCalledWith(
      'arch:auth:employee:usr-1',
      expect.objectContaining({
        id: 'emp-101',
        role: 'operator',
        privilegeVersion: 3,
      }),
      expect.any(Number)
    );
  });

  test('readSession returns null if privilege version does not match', async () => {
    mockSendSafe.mockResolvedValueOnce('4'); // current version = 4
    mockCacheGet.mockResolvedValueOnce({
      ...sampleEmployee,
      privilegeVersion: 3, // Stale version!
    });

    const result = await readSession('usr-1');
    expect(result).toBeNull();
  });

  test('readSession returns employee record when versions match', async () => {
    mockSendSafe.mockResolvedValueOnce('4'); // current version = 4
    mockCacheGet.mockResolvedValueOnce({
      ...sampleEmployee,
      privilegeVersion: 4,
    });

    const result = await readSession('usr-1');
    expect(result).toEqual(sampleEmployee);
  });

  test('revokeSession triggers privilege version bump and counter', async () => {
    mockSendSafe.mockResolvedValueOnce(7); // INCR

    await revokeSession('usr-1', { reason: 'logout' });

    expect(mockIncrementCounter).toHaveBeenCalledWith('auth.session.revoked', {
      dimension: 'logout',
    });
  });

  test('sessionTtl retrieves remaining seconds', async () => {
    mockSendSafe.mockResolvedValueOnce(1800);
    const ttl = await sessionTtl('usr-1');
    expect(ttl).toBe(1800);
  });

  test('touchSession extends session expiry with GETEX', async () => {
    mockSendSafe.mockResolvedValueOnce('stored-json');
    const extended = await touchSession('usr-1', { force: true });
    expect(extended).toBe(true);
    expect(mockSendSafe).toHaveBeenCalledWith(expect.anything(), [
      'GETEX',
      'arch:auth:employee:usr-1',
      'EX',
      expect.any(Number),
    ]);
  });
});
