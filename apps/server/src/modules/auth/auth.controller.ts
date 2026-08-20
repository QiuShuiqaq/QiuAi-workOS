import { Body, Controller, Get, Inject, Post, Req, Res } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { serializeExpiredSessionCookie, serializeSessionCookie } from '../../shared/auth/session-cookie';
import { readTrustedClientIpAddress } from '../../shared/network/client-ip';
import { LoginRequestDto } from './dto/login-request.dto';
import { RegisterRequestDto } from './dto/register-request.dto';
import { AuthSessionResponseDto, LogoutResponseDto } from './dto/auth-session-response.dto';
import { AuthService } from './auth.service';
import { AuthRateLimitService } from './auth-rate-limit.service';

@ApiTags('auth')
@Controller({
  path: 'auth',
  version: '1'
})
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(AuthRateLimitService) private readonly authRateLimitService: AuthRateLimitService
  ) {}

  @Post('login')
  @ApiOkResponse({ type: AuthSessionResponseDto })
  async login(
    @Body() body: LoginRequestDto,
    @Res({ passthrough: true }) reply: FastifyReply,
    @Req() request: FastifyRequest
  ): Promise<AuthSessionResponseDto> {
    const ipAddress = readTrustedClientIpAddress(request);
    await this.authRateLimitService.assertLoginAllowed({
      email: body.email,
      ipAddress
    });

    const result = await this.authService.login(body, {
      userAgent: request.headers['user-agent'],
      ipAddress
    });

    reply.header('set-cookie', serializeSessionCookie(result.sessionToken, result.maxAgeSeconds));
    return result.response;
  }

  @Post('register')
  @ApiCreatedResponse({ type: AuthSessionResponseDto })
  async register(
    @Body() body: RegisterRequestDto,
    @Res({ passthrough: true }) reply: FastifyReply,
    @Req() request: FastifyRequest
  ): Promise<AuthSessionResponseDto> {
    const ipAddress = readTrustedClientIpAddress(request);
    await this.authRateLimitService.assertRegisterAllowed({
      email: body.email,
      ipAddress
    });

    const result = await this.authService.register(body, {
      userAgent: request.headers['user-agent'],
      ipAddress
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
