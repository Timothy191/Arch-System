import { logError } from '@/lib/errors/error-logger';
import { type PluginHooks, type PluginWidget } from './types';

/**
 * Failure-isolated entry points into the plugin orchestrator.
 *
 * Domain write paths (daily logs, breakdowns) call these fire-and-forget:
 * a crashing or slow plugin must never fail the underlying operation, so
 * every call is swallowed into structured error logging.
 */

type HookName = keyof PluginHooks;

export async function triggerPluginHook(hookName: HookName, data: unknown): Promise<void> {
  try {
    const { pluginOrchestrator } = await import('./orchestrator');
    await pluginOrchestrator.triggerHook(hookName, data);
  } catch (error) {
    logError(error, { context: 'plugin_hook_dispatch', hookName });
  }
}

export async function getPluginWidgets(): Promise<PluginWidget[]> {
  try {
    const { pluginOrchestrator } = await import('./orchestrator');
    return await pluginOrchestrator.getActiveWidgets();
  } catch (error) {
    logError(error, { context: 'plugin_widgets_fetch' });
    return [];
  }
}
