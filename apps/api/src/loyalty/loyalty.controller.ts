import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import { AuthGuard, RolesGuard } from '../auth/auth.guards';
import type { AuthPrincipal } from '../auth/auth.types';
import {
  GiftCardBlockDto,
  GiftCardLookupDto,
  IssueGiftCardDto,
  LoyaltyAdjustmentDto,
  LoyaltyRuleDto,
} from './dto';
import { LoyaltyReleaseService } from './loyalty-release.service';
import { LoyaltyService } from './loyalty.service';

@UseGuards(AuthGuard)
@Controller('v1/account/loyalty')
export class AccountLoyaltyController {
  constructor(
    private readonly loyalty: LoyaltyService,
    private readonly releases: LoyaltyReleaseService,
  ) {}

  @Get()
  async account(@CurrentUser() user: AuthPrincipal) {
    await this.releases.releaseDueForUser(user.sub);
    return this.loyalty.account(user.sub);
  }
}

@Controller('v1/gift-cards')
export class PublicGiftCardController {
  constructor(private readonly loyalty: LoyaltyService) {}

  @Post('lookup')
  lookup(@Body() body: GiftCardLookupDto) {
    return this.loyalty.lookupGiftCard(body.code);
  }
}

@UseGuards(AuthGuard, RolesGuard)
@Roles('STAFF', 'ADMIN')
@Controller('v1/admin/loyalty')
export class AdminLoyaltyController {
  constructor(
    private readonly loyalty: LoyaltyService,
    private readonly releases: LoyaltyReleaseService,
  ) {}

  @Get('rules')
  rules() {
    return this.loyalty.rules();
  }

  @Post('rules')
  createRule(@Body() body: LoyaltyRuleDto) {
    return this.loyalty.createRule(body);
  }

  @Get('accounts/:userId')
  async account(@Param('userId') userId: string) {
    await this.releases.releaseDueForUser(userId);
    return this.loyalty.account(userId);
  }

  @Post('accounts/:userId/adjust')
  adjust(
    @Param('userId') userId: string,
    @CurrentUser() author: AuthPrincipal,
    @Body() body: LoyaltyAdjustmentDto,
  ) {
    return this.loyalty.adjust(userId, body, author.sub);
  }

  @Get('gift-cards')
  giftCards() {
    return this.loyalty.giftCards();
  }

  @Post('gift-cards')
  issue(@CurrentUser() user: AuthPrincipal, @Body() body: IssueGiftCardDto) {
    return this.loyalty.issueGiftCard(body, user.sub);
  }

  @Patch('gift-cards/:id/block')
  block(@Param('id') id: string, @Body() body: GiftCardBlockDto) {
    return this.loyalty.blockGiftCard(id, body);
  }
}
