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
assert.equal(state.rolePackages.length, 0);
assert.deepEqual(state.localRuntime.installedRoleCodes, []);
assert.equal(state.localRuntime.activeRoleCode, undefined);
assert.equal(state.runtimeSnapshot.tasks.length, 0);
assert.equal(state.taskDetails?.length, 0);
assert.deepEqual(state.knowledgeSources, []);

assert.ok(state.modelProfiles.some((profile) => profile.id === 'qiu-official-text-1'));
assert.ok(state.modelProfiles.some((profile) => profile.id === 'qiu-official-image-1'));
assert.ok(state.modelProfiles.some((profile) => profile.id === 'qiu-official-image-2'));
assert.ok(state.modelProfiles.some((profile) => profile.id === 'qiu-official-image-3'));
assert.ok(state.modelProfiles.some((profile) => profile.id === 'qiu-official-image-4'));
assert.ok(state.modelProfiles.some((profile) => profile.id === 'qiu-official-video-1'));
assert.equal(
  state.modelProfiles.some((profile) => profile.billingMode === 'official_points' && /DeepSeek|GRSAI|MiniMax|Hailuo|gpt-image|nano-banana/i.test(`${profile.providerName} ${profile.modelName}`)),
  false
);

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
