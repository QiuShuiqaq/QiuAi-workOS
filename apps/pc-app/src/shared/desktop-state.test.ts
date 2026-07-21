import assert from 'node:assert/strict';
import {
  validateLocalRuntimeContract,
  validateModelProfile,
  validateRolePackageManifest,
  validateToolManifest
} from '../../../../packages/domain/src/index';
import { createDesktopRuntimePreviewState } from './desktop-state';

const state = createDesktopRuntimePreviewState();

assert.equal(state.app.appName, 'QiuAI WorkOS');
assert.equal(state.localRuntime.syncPolicy, 'summary_only');
assert.equal(state.runtimeSnapshot.rolePackages.length, state.rolePackages.length);
assert.equal(state.runtimeSnapshot.tasks.length, 2);
assert.equal(state.taskDetails?.length, 2);
assert.deepEqual(state.knowledgeSources, []);
assert.equal(state.runtimeSnapshot.tasks[0].state, 'completed');
assert.equal(state.runtimeSnapshot.tasks[1].state, 'waiting_approval');
assert.ok(state.runtimeSnapshot.tasks[0].executionContext);
assert.equal(state.runtimeSnapshot.tasks[0].executionContext?.toolIds.length, 3);
assert.ok(state.taskDetails?.[0].executionContext);
assert.equal(state.taskDetails?.[0].executionContext?.modelProfileIds.length, 2);

validateLocalRuntimeContract(state.localRuntime);

for (const rolePackage of state.rolePackages) {
  validateRolePackageManifest(rolePackage);
}

for (const modelProfile of state.modelProfiles) {
  validateModelProfile(modelProfile);
}

for (const tool of state.tools) {
  validateToolManifest(tool);
}

console.log('Desktop runtime preview state contract passed.');
