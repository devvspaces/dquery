import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../../database/database.service';
import { eq, and } from 'drizzle-orm';
import { users, credits } from '../../database/schema';
import { OAuthProfile, JwtPayload, AuthResponse } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private databaseService: DatabaseService,
    private jwtService: JwtService,
  ) {}

  async validateOAuthUser(profile: OAuthProfile): Promise<AuthResponse> {
    const db = this.databaseService.getDb();

    // Check if user exists
    const existingUsers = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.email, profile.email),
          eq(users.provider, profile.provider),
        ),
      )
      .limit(1);

    let user = existingUsers[0];

    if (!user) {
      // Create new user
      const newUsers = await db
        .insert(users)
        .values({
          email: profile.email,
          name: profile.name,
          avatar: profile.avatar,
          provider: profile.provider,
          providerId: profile.id,
        })
        .returning();

      user = newUsers[0];

      // Create initial credits entry with 25 free credits
      await db.insert(credits).values({
        userId: user.id,
        balance: '25.00',
        totalPurchased: '0.00',
        totalUsed: '0.00',
      });
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
