import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../../database/database.service';
import { eq, count, sql } from 'drizzle-orm';
import { users, credits, creditTransactions } from '../../database/schema';
import { CreditsService } from '../credits/credits.service';

/** Arbitrary constant identifying the sign-up advisory lock. */
const SIGNUP_LOCK_KEY = 728_461_001;
import { OAuthProfile, JwtPayload, AuthResponse } from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private databaseService: DatabaseService,
    private jwtService: JwtService,
    private creditsService: CreditsService,
  ) {}

  async validateOAuthUser(profile: OAuthProfile): Promise<AuthResponse> {
    const db = this.databaseService.getDb();

    // One account per email, whichever OAuth provider they sign in with,
    // so switching providers never grants a second set of free credits.
    const existingUsers = await db
      .select()
      .from(users)
      .where(eq(users.email, profile.email))
      .limit(1);

    let user = existingUsers[0];

    if (!user) {
      user = await this.createUserWithGrant(profile);
    }

    // Generate JWT token
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar || undefined,
        provider: user.provider,
      },
      accessToken,
    };
  }

  /**
   * Create the user, their wallet and the welcome-credit ledger entry atomically.
   * An advisory lock serialises sign-ups so the "first N users" count is exact.
   */
  private async createUserWithGrant(profile: OAuthProfile) {
    const db = this.databaseService.getDb();
    return db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${SIGNUP_LOCK_KEY})`);

      const [{ value: existing }] = await tx
        .select({ value: count() })
        .from(users);
      const grant = this.creditsService.signupGrantAmount(Number(existing));

      const [user] = await tx
        .insert(users)
        .values({
          email: profile.email,
          name: profile.name,
          avatar: profile.avatar,
          provider: profile.provider,
          providerId: profile.id,
        })
        .returning();

      await tx.insert(credits).values({
        userId: user.id,
        balance: grant.toFixed(2),
        totalPurchased: '0.00',
        totalUsed: '0.00',
      });

      await tx.insert(creditTransactions).values({
        userId: user.id,
        amount: grant.toFixed(2),
        type: 'bonus',
        description: 'Welcome credits',
        balanceBefore: '0.00',
        balanceAfter: grant.toFixed(2),
        idempotencyKey: `signup:${user.id}`,
      });

      this.logger.log(
        `New user ${user.id} (#${Number(existing) + 1}) granted ${grant} credits`,
      );
      return user;
    });
  }

  async validateUserById(userId: string) {
    const db = this.databaseService.getDb();
    const result = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return result[0] || null;
  }
}
