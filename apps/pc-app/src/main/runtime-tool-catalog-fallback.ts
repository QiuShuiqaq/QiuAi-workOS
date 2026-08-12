import type { DesktopRuntimeState } from '../shared/desktop-api.js';

export function preserveCachedToolCatalogOnSyncFailure(
  state: DesktopRuntimeState
): DesktopRuntimeState {
  if (state.tools.length > 0) {
    return state;
  }

  return {
    ...state,
    tools: [],
    localRuntime: {
      ...state.localRuntime,
      enabledToolIds: []
    },
    runtimeSnapshot: {
      ...state.runtimeSnapshot,
      tools: [],
      toolActions: []
    }
  };
}
