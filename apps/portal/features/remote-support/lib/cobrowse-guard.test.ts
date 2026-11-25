import '@testing-library/jest-dom';
import {
  applySensitiveRedaction,
  executeCoBrowseAction,
  isSensitiveElement,
} from './cobrowse-guard';

describe('cobrowse-guard safety controls', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
  });

  it('blocks co-browse actions when co-browsing is disabled', () => {
    const result = executeCoBrowseAction({
      action: { kind: 'scroll', deltaX: 0, deltaY: 120 },
      isCobrowseEnabled: false,
    });
    expect(result).toEqual({ executed: false, reason: 'cobrowse_disabled' });
  });

  it('identifies password fields, redacted fields, and support overlay controls as sensitive', () => {
    document.body.innerHTML = `
      <input id="pw" type="password" />
      <div data-remote-redact="true"><input id="secret-text" type="text" /></div>
      <div data-remote-support-overlay="true"><button id="kill">End</button></div>
      <button id="safe-btn">Save</button>
    `;

    expect(isSensitiveElement(document.getElementById('pw'))).toBe(true);
    expect(isSensitiveElement(document.getElementById('secret-text'))).toBe(true);
    expect(isSensitiveElement(document.getElementById('kill'))).toBe(true);
    expect(isSensitiveElement(document.getElementById('safe-btn'))).toBe(false);
  });

  it('blurs sensitive fields when redaction is enabled and clears on disable', () => {
    document.body.innerHTML = `<input id="pw" type="password" /><input id="plain" type="text" />`;
    const maskedCount = applySensitiveRedaction(true);
    expect(maskedCount).toBe(1);
    expect(document.getElementById('pw')?.getAttribute('data-arch-remote-redacted')).toBe('true');

    const clearedCount = applySensitiveRedaction(false);
    expect(clearedCount).toBe(1);
    expect(document.getElementById('pw')?.getAttribute('data-arch-remote-redacted')).toBeNull();
  });

  it('blocks remote clicks on sensitive elements and executes clicks/inputs on safe targets', () => {
    document.body.innerHTML = `
      <input id="pw" type="password" />
      <input id="notes" type="text" />
      <button id="safe-btn" type="button">Submit</button>
    `;

    const pw = document.getElementById('pw') as HTMLInputElement;
    const notes = document.getElementById('notes') as HTMLInputElement;
    const btn = document.getElementById('safe-btn') as HTMLButtonElement;
    const btnClickSpy = jest.fn();
    btn.addEventListener('click', btnClickSpy);

    const mockElementFromPoint = jest.fn();
    document.elementFromPoint = mockElementFromPoint;

    mockElementFromPoint.mockReturnValue(pw);
    expect(
      executeCoBrowseAction({
        action: { kind: 'input', x: 0.2, y: 0.2, value: '1234' },
        isCobrowseEnabled: true,
      })
    ).toEqual({ executed: false, reason: 'sensitive_element_blocked' });
    expect(pw.value).toBe('');

    mockElementFromPoint.mockReturnValue(notes);
    expect(
      executeCoBrowseAction({
        action: { kind: 'input', x: 0.3, y: 0.3, value: 'Updated check' },
        isCobrowseEnabled: true,
      })
    ).toEqual({ executed: true });
    expect(notes.value).toBe('Updated check');

    mockElementFromPoint.mockReturnValue(btn);
    expect(
      executeCoBrowseAction({
        action: { kind: 'click', x: 0.4, y: 0.4 },
        isCobrowseEnabled: true,
      })
    ).toEqual({ executed: true });
    expect(btnClickSpy).toHaveBeenCalledTimes(1);
  });

  it('rejects protocol-relative navigation attempts and allows safe internal paths', () => {
    const onNavigate = jest.fn();
    expect(
      executeCoBrowseAction({
        action: { kind: 'navigate', path: '//evil.example' },
        isCobrowseEnabled: true,
        onNavigate,
      })
    ).toEqual({ executed: false, reason: 'invalid_internal_path' });

    expect(
      executeCoBrowseAction({
        action: { kind: 'navigate', path: '/control-room' },
        isCobrowseEnabled: true,
        onNavigate,
      })
    ).toEqual({ executed: true });
    expect(onNavigate).toHaveBeenCalledWith('/control-room');
  });
});
