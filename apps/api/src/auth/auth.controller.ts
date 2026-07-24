import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CurrentUser } from './auth.decorators';
import { AuthGuard } from './auth.guards';
import { AuthService } from './auth.service';
import type { AuthPrincipal, RequestWithAuth } from './auth.types';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  TokenDto,
} from './dto';

@Controller('v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  register(
    @Body() body: RegisterDto,
    @Req() request: RequestWithAuth,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.auth.register(body, request, response);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  login(
    @Body() body: LoginDto,
    @Req() request: RequestWithAuth,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.auth.login(body, request, response);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('refresh')
  refresh(
    @Req() request: RequestWithAuth,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.auth.refresh(
      request.cookies?.nsabores_refresh,
      request,
      response,
    );
  }

  @Post('logout')
  logout(
    @Req() request: RequestWithAuth,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.auth.logout(request.cookies?.nsabores_refresh, response);
  }

  @UseGuards(AuthGuard)
  @Post('logout-all')
  logoutAll(
    @CurrentUser() user: AuthPrincipal,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.auth.logoutAll(user.sub, response);
  }

  @UseGuards(AuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthPrincipal) {
    return this.auth.me(user.sub);
  }

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('forgot-password')
  forgot(@Body() body: ForgotPasswordDto) {
    return this.auth.forgotPassword(body.email);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('reset-password')
  reset(@Body() body: ResetPasswordDto) {
    return this.auth.resetPassword(body);
  }

  @Post('verify-email')
  verify(@Body() body: TokenDto) {
    return this.auth.verifyEmail(body.token);
  }

  @UseGuards(AuthGuard)
  @Post('resend-verification')
  resend(@CurrentUser() user: AuthPrincipal) {
    return this.auth.resendVerification(user.sub);
  }

  @UseGuards(AuthGuard)
  @Post('change-password')
  changePassword(
    @CurrentUser() user: AuthPrincipal,
    @Body() body: ChangePasswordDto,
  ) {
    return this.auth.changePassword(
      user.sub,
      body.currentPassword,
      body.newPassword,
    );
  }

  @UseGuards(AuthGuard)
  @Get('sessions')
  sessions(@CurrentUser() user: AuthPrincipal) {
    return this.auth.sessions(user.sub);
  }

  @UseGuards(AuthGuard)
  @Post('sessions/:id/revoke')
  revokeSession(@CurrentUser() user: AuthPrincipal, @Param('id') id: string) {
    return this.auth.revokeSession(user.sub, id);
  }
}
