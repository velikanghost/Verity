import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { User, UserDocument } from '../../modules/users/users.model';

export interface AuthUser {
  id: string;
  email?: string;
  walletAddress?: string;
}

let clientInstance: ReturnType<typeof jwksClient> | null = null;

function getJwksClient() {
  if (clientInstance) return clientInstance;
  const appId = process.env.PRIVY_APP_ID || '';
  clientInstance = jwksClient({
    jwksUri: `https://auth.privy.io/api/v1/apps/${appId}/jwks.json`,
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 10,
  });
  return clientInstance;
}

function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
  if (!header.kid) {
    callback(new Error('Missing kid in JWT header'));
    return;
  }
  getJwksClient().getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
    } else {
      const signingKey = key?.getPublicKey();
      callback(null, signingKey);
    }
  });
}

async function fetchPrivyUserDetails(
  privyDid: string,
): Promise<{ email?: string; walletAddress?: string }> {
  const appId = process.env.PRIVY_APP_ID || '';
  const appSecret = process.env.PRIVY_APP_SECRET;

  if (!appSecret) {
    console.warn(
      'JwtAuthGuard: PRIVY_APP_SECRET is not set, skipping Privy API details fetch.',
    );
    return {};
  }

  try {
    const authHeader =
      'Basic ' + Buffer.from(`${appId}:${appSecret}`).toString('base64');
    const response = await fetch(`https://api.privy.io/v1/users/${privyDid}`, {
      method: 'GET',
      headers: {
        'privy-app-id': appId,
        Authorization: authHeader,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      console.error(
        `JwtAuthGuard: Failed to fetch user from Privy API: ${response.status} ${response.statusText}`,
      );
      return {};
    }

    const data = (await response.json()) as any;

    let email: string | undefined;
    let walletAddress: string | undefined;

    const linkedAccounts = data.linked_accounts || data.linkedAccounts || [];
    for (const account of linkedAccounts) {
      if (account.type === 'email' && account.address) {
        email = account.address;
      }
      if (account.type === 'wallet' && account.address) {
        // We look for any wallet client, prioritizing 'privy' embedded wallet
        if (!walletAddress || account.wallet_client === 'privy') {
          walletAddress = account.address;
        }
      }
    }

    if (!email && data.email) {
      email = data.email;
    }

    return { email, walletAddress };
  } catch (err) {
    console.error(
      `JwtAuthGuard: Error fetching user details from Privy API for DID ${privyDid}:`,
      err,
    );
    return {};
  }
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const authHeader = request.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : null;

    if (!token) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    try {
      const appId = process.env.PRIVY_APP_ID || '';
      const decoded = await new Promise<any>((resolve, reject) => {
        jwt.verify(
          token,
          getKey,
          {
            issuer: 'privy.io',
            audience: appId,
          },
          (err, decodedToken) => {
            if (err) reject(err);
            else resolve(decodedToken);
          },
        );
      });

      // Look up user by privyDid (decoded.sub)
      let user = await this.userModel.findOne({ privyDid: decoded.sub });

      // As long as they have a smart wallet, they are authenticated already
      if (user && user.walletAddress) {
        request.user = {
          id: user.id || (user as any)._id?.toString(),
          email: user.email || undefined,
          walletAddress: user.walletAddress || undefined,
        };
        return true;
      }

      const privyDetails = await fetchPrivyUserDetails(decoded.sub);

      const walletParam = request.params['walletAddress'];
      const urlWallet =
        typeof walletParam === 'string' ? walletParam.toLowerCase() : null;
      const targetWallet =
        urlWallet || privyDetails.walletAddress?.toLowerCase() || null;

      if (!user) {
        if (targetWallet) {
          // Check if user already exists by walletAddress
          user = await this.userModel.findOne({ walletAddress: targetWallet });

          if (user) {
            user.privyDid = decoded.sub;
            if (privyDetails.email && !user.email) {
              user.email = privyDetails.email.toLowerCase();
            }
            await user.save();
          } else {
            // Securely register new user bound to their Privy DID
            const username = `user_${targetWallet.slice(-4).toLowerCase()}_${Math.floor(Math.random() * 9000 + 1000)}`;
            user = await this.userModel.create({
              walletAddress: targetWallet,
              privyDid: decoded.sub,
              email: privyDetails.email
                ? privyDetails.email.toLowerCase()
                : null,
              username,
              displayName: `User ${targetWallet.slice(-4).toUpperCase()}`,
            });
          }
        } else {
          // Create placeholder user with just privyDid and email
          const username = `user_${decoded.sub.slice(-6).toLowerCase()}_${Math.floor(Math.random() * 9000 + 1000)}`;
          user = await this.userModel.create({
            privyDid: decoded.sub,
            email: privyDetails.email ? privyDetails.email.toLowerCase() : null,
            username,
            displayName: `User Privy`,
          });
        }
      } else {
        // User exists by privyDid, but has no wallet address. Link it if available now!
        let needsSave = false;
        if (targetWallet && !user.walletAddress) {
          user.walletAddress = targetWallet;
          needsSave = true;
        }
        if (privyDetails.email && !user.email) {
          user.email = privyDetails.email.toLowerCase();
          needsSave = true;
        }
        if (needsSave) {
          await user.save();
        }
      }

      if (!user) {
        throw new UnauthorizedException(
          'User not registered in local database.',
        );
      }

      request.user = {
        id: user.id || (user as any)._id?.toString(),
        email: user.email || undefined,
        walletAddress: user.walletAddress || undefined,
      };

      return true;
    } catch (error) {
      throw new UnauthorizedException(
        error instanceof Error
          ? error.message
          : 'Invalid or expired Privy token.',
      );
    }
  }
}
