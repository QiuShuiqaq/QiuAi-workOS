import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { serializeExpiredSessionCookie, serializeSessionCookie } from '../../shared/auth/session-cookie';
import { LoginRequestDto } from './dto/login-request.dto';
import { AuthSessionResponseDto, LogoutResponseDto } from './dto/auth-session-response.dto';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller({
  path: 'auth',
  version: '1'
})
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOkResponse({ type: AuthSessionResponseDto })
  async login(
    @Body() body: LoginRequestDto,
    @Res({ passthrough: true }) reply: FastifyReply,
    @Req() request: FastifyRequest
  ): Promise<AuthSessionResponseDto> {
    const result = await this.authService.login(body, {
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip
    });

    reply.header('set-cookie', serializeSessionCookie(result.sessionToken, result.maxAgeSeconds));
    return result.response;
  }

  @Get('session')
  @ApiOkResponse({ type: AuthSessionResponseDto })
  async getSession(@Req() request: FastifyRequest): Promise<AuthSessionResponseDto> {
    return this.authService.getSession(request.headers.cookie);
  }

  @Post('logout')
  @ApiOkResponse({ type: LogoutResponseDto })
  async logout(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply
  ): Promise<LogoutResponseDto> {
    const result = await this.authService.logout(request.headers.cookie);
    reply.header('set-cookie', serializeExpiredSessionCookie());
    return result.response;
  }
}
