import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';

import { AssetCenterService } from './asset-center.service';
import {
  CreateAdminAssetDefinitionRequestDto,
  CreateAdminAssetDefinitionResponseDto,
  DeleteAdminAssetDefinitionResponseDto,
  ListAdminAssetDefinitionsQueryDto,
  ListAdminAssetDefinitionsResponseDto,
  UpdateAdminAssetDefinitionRequestDto,
  UpdateAdminAssetDefinitionResponseDto
} from './dto/asset-center.dto';

@ApiTags('admin-assets')
@Controller({
  path: 'admin/assets',
  version: '1'
})
export class AssetCenterController {
  constructor(@Inject(AssetCenterService) private readonly assetCenterService: AssetCenterService) {}

  @Get()
  @ApiOkResponse({ type: ListAdminAssetDefinitionsResponseDto })
  listAssets(
    @Query() query: ListAdminAssetDefinitionsQueryDto,
    @Req() request: FastifyRequest
  ): Promise<ListAdminAssetDefinitionsResponseDto> {
    return this.assetCenterService.listAssets(query, request.headers.cookie);
  }

  @Post()
  @ApiOkResponse({ type: CreateAdminAssetDefinitionResponseDto })
  createAsset(
    @Body() body: CreateAdminAssetDefinitionRequestDto,
    @Req() request: FastifyRequest
  ): Promise<CreateAdminAssetDefinitionResponseDto> {
    return this.assetCenterService.createAsset(body, request.headers.cookie);
  }

  @Patch(':assetId')
  @ApiOkResponse({ type: UpdateAdminAssetDefinitionResponseDto })
  updateAsset(
    @Param('assetId') assetId: string,
    @Body() body: UpdateAdminAssetDefinitionRequestDto,
    @Req() request: FastifyRequest
  ): Promise<UpdateAdminAssetDefinitionResponseDto> {
    return this.assetCenterService.updateAsset(assetId, body, request.headers.cookie);
  }

  @Delete(':assetId')
  @ApiOkResponse({ type: DeleteAdminAssetDefinitionResponseDto })
  deleteAsset(
    @Param('assetId') assetId: string,
    @Req() request: FastifyRequest
  ): Promise<DeleteAdminAssetDefinitionResponseDto> {
    return this.assetCenterService.deleteAsset(assetId, request.headers.cookie);
  }
}
