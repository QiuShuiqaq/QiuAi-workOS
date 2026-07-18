import { Injectable } from '@nestjs/common';

import { MockPlatformStore } from '../../shared/mock/mock-platform-store.service';

interface InstallRoleInput {
  templateId: string;
  name?: string;
  departmentName?: string;
}

@Injectable()
export class RoleService {
  constructor(private readonly store: MockPlatformStore) {}

  listTemplates() {
    return {
      data: this.store.listRoleTemplates()
    };
  }

  listRoles(workspaceId: string) {
    return {
      data: this.store.listRoles(workspaceId)
    };
  }

  getRole(workspaceId: string, roleId: string) {
    const role = this.store.getRole(workspaceId, roleId);
    return role ? { data: role } : undefined;
  }

  installRole(workspaceId: string, input: InstallRoleInput) {
    const role = this.store.installRole(workspaceId, input);
    return role ? { data: role } : undefined;
  }
}
