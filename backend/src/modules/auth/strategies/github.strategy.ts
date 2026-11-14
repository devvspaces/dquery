import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { OAuthProfile } from '../dto/auth.dto';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(private configService: ConfigService) {
    super({
      clientID: configService.get<string>('GITHUB_CLIENT_ID') || 'dummy',
      clientSecret:
        configService.get<string>('GITHUB_CLIENT_SECRET') || 'dummy',
      callbackURL:
        configService.get<string>('GITHUB_CALLBACK_URL') ||
        'http://localhost:3001/api/auth/github/callback',
      scope: ['user:email'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: (err: unknown, user?: unknown) => void,
  ): Promise<any> {
    const { id, displayName, emails, photos } = profile;

    const oauthProfile: OAuthProfile = {
      id,
      email: emails[0].value,
      name: displayName || profile.username,
      avatar: photos[0]?.value,
      provider: 'github',
    };

    done(null, oauthProfile);
  }
}
