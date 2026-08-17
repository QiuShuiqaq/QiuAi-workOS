import type {
  ModelProfile,
  RoleModelCredentialBinding,
  RolePackageManifest
} from './desktop-contract.js';
import { readRequiredModelProfileIdsForRolePackage } from './desktop-role-requirements.js';

export const defaultOfficialRuntimeModelBindings = [
  ['qiu-general-default', 'qiu-official-text-1'],
  ['qiu-reasoning-default', 'qiu-official-reasoning-1'],
  ['qiu-image-generation-default', 'qiu-official-image-1'],
  ['qiu-image-editing-default', 'qiu-official-image-1'],
  ['qiu-audio-generation-default', 'qiu-official-audio-1'],
  ['qiu-video-generation-default', 'qiu-official-video-2']
] as const;

export function buildMissingOfficialRoleModelCredentialBindings(input: {
  rolePackage: Pick<RolePackageManifest, 'roleCode' | 'modelProfileIds' | 'workflowGraph' | 'dependencyManifest'>;
  modelProfiles: ModelProfile[];
  currentBindings: RoleModelCredentialBinding[];
  updatedAt?: string;
}): RoleModelCredentialBinding[] {
  const existingBindingKeys = new Set(
    input.currentBindings.map((binding) => `${binding.roleCode}:${binding.modelProfileId}`)
  );
  const existingProfileIds = new Set(input.modelProfiles.map((profile) => profile.id));
  const requiredProfileIds = readRequiredModelProfileIdsForRolePackage(input.rolePackage);
  const updatedAt = input.updatedAt ?? new Date().toISOString();
  const bindings: RoleModelCredentialBinding[] = [];

  for (const [semanticProfileId, officialProfileId] of defaultOfficialRuntimeModelBindings) {
    const bindingKey = `${input.rolePackage.roleCode}:${semanticProfileId}`;
    if (
      requiredProfileIds.includes(semanticProfileId) &&
      !existingBindingKeys.has(bindingKey) &&
      existingProfileIds.has(officialProfileId)
    ) {
      bindings.push({
        roleCode: input.rolePackage.roleCode,
        modelProfileId: semanticProfileId,
        runtimeModelProfileId: officialProfileId,
        mode: 'provider_default',
        updatedAt
      });
      existingBindingKeys.add(bindingKey);
    }
  }

  return bindings;
}
