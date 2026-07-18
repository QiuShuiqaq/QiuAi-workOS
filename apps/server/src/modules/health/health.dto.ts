import { ApiProperty } from '@nestjs/swagger';

export class HealthResponse {
  @ApiProperty({ example: 'ok' })
  status!: 'ok';

  @ApiProperty({ example: 'qiuai-workos-server' })
  service!: string;

  @ApiProperty({ example: '2026-07-18T00:00:00.000Z' })
  timestamp!: string;
}
