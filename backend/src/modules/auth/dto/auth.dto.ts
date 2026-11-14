export interface JwtPayload {
  sub: string; // user id
  email: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
    avatar?: string;
    provider: string;
  };
  accessToken: string;
}

export interface OAuthProfile {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  provider: 'google' | 'github' | 'facebook' | 'twitter';
}
