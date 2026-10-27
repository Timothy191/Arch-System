import { dispatchActiveModuleChange, dispatchSystemNotification } from './event-manager';

describe('event-manager', () => {
  let dispatchEventSpy: jest.SpyInstance;

  beforeEach(() => {
    dispatchEventSpy = jest.spyOn(window, 'dispatchEvent');
  });

  afterEach(() => {
    dispatchEventSpy.mockRestore();
  });

  it('dispatches arch:active-module-change CustomEvent with module detail', () => {
    const detail = { name: 'mining', title: 'Mining Operations' };

    dispatchActiveModuleChange(detail);

    expect(dispatchEventSpy).toHaveBeenCalledTimes(1);
    const dispatchedEvent = dispatchEventSpy.mock.calls[0][0] as CustomEvent;
    expect(dispatchedEvent.type).toBe('arch:active-module-change');
    expect(dispatchedEvent.detail).toEqual(detail);
  });

  it('dispatches arch-system-notification CustomEvent with notification detail', () => {
    const detail = {
      id: 'notif-1',
      title: 'Clearance Updated',
      message: 'Access granted to Control Room',
      unread: true,
    };

    dispatchSystemNotification(detail);

    expect(dispatchEventSpy).toHaveBeenCalledTimes(1);
    const dispatchedEvent = dispatchEventSpy.mock.calls[0][0] as CustomEvent;
    expect(dispatchedEvent.type).toBe('arch-system-notification');
    expect(dispatchedEvent.detail).toEqual(detail);
  });
});
