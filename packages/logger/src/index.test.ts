import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { browserLogger, createChildLogger, createLogger, serverLogger } from './index';

describe('@repo/logger structured logging suite', () => {
  describe('Given serverLogger and createLogger', () => {
    it('When creating a named server logger, Then it exposes standard Pino log methods and preserves the logger name', () => {
      const customLogger = createLogger('telemetry-worker');

      expect(customLogger).toBeDefined();
      expect(typeof customLogger.info).toBe('function');
      expect(typeof customLogger.warn).toBe('function');
      expect(typeof customLogger.error).toBe('function');
      expect(typeof customLogger.debug).toBe('function');
      expect(customLogger.bindings().name).toBe('telemetry-worker');
    });

    it('When creating a child logger via createChildLogger, Then it binds context metadata and optional custom name', () => {
      const child = createChildLogger({ deptId: 'mining-01', shift: 'night' }, 'shift-audit');
      const bindings = child.bindings();

      expect(bindings.deptId).toBe('mining-01');
      expect(bindings.shift).toBe('night');
      expect(bindings.name).toBe('shift-audit');

      const defaultChild = createChildLogger({ requestId: 'req-123' });
      expect(defaultChild.bindings().requestId).toBe('req-123');
      expect(defaultChild.bindings().name).toBe(serverLogger.bindings().name);
    });
  });

  describe('Given browserLogger structured console wrapper', () => {
    let debugSpy: jest.SpyInstance;
    let infoSpy: jest.SpyInstance;
    let warnSpy: jest.SpyInstance;
    let errorSpy: jest.SpyInstance;

    beforeEach(() => {
      debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => undefined);
      infoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
      warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('When logging at debug, info, warn, and error levels, Then it outputs serialized JSON with level, timestamp, and optional data', () => {
      browserLogger.debug('debug trace', { step: 1 });
      browserLogger.info('system ready');
      browserLogger.warn('high latency', { latencyMs: 1450 });
      browserLogger.error('connection lost', { code: 'ECONNRESET' });

      expect(debugSpy).toHaveBeenCalledTimes(1);
      const debugPayload = JSON.parse(debugSpy.mock.calls[0][0] as string) as Record<
        string,
        unknown
      >;
      expect(debugPayload.level).toBe('debug');
      expect(debugPayload.msg).toBe('debug trace');
      expect(debugPayload.data).toEqual([{ step: 1 }]);
      expect(typeof debugPayload.timestamp).toBe('string');

      expect(infoSpy).toHaveBeenCalledTimes(1);
      const infoPayload = JSON.parse(infoSpy.mock.calls[0][0] as string) as Record<string, unknown>;
      expect(infoPayload.level).toBe('info');
      expect(infoPayload.msg).toBe('system ready');
      expect(infoPayload.data).toBeUndefined();

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledTimes(1);
    });

    it('When logging a message containing an email address, Then it redacts PII before outputting JSON', () => {
      browserLogger.info('Operator login for operator.jane@arch-mining.com succeeded');

      const payload = JSON.parse(infoSpy.mock.calls[0][0] as string) as Record<string, unknown>;
      expect(payload.msg).toBe('Operator login for [EMAIL_REDACTED] succeeded');
    });

    it('When creating nested child loggers in browserLogger, Then it prefixes messages with formatted key-value bindings', () => {
      const child = browserLogger.child({ module: 'conveyor' });
      const nested = child.child({ zone: 'pit-north' });

      nested.info('belt speed nominal', { rpm: 1200 });

      expect(infoSpy).toHaveBeenCalledTimes(1);
      const payload = JSON.parse(infoSpy.mock.calls[0][0] as string) as Record<string, unknown>;
      expect(payload.msg).toBe('[module=conveyor zone=pit-north] belt speed nominal');
      expect(payload.data).toEqual([{ rpm: 1200 }]);
    });
  });
});
