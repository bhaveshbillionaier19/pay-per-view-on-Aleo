import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { registerAccessToken } from './accessStore.js';

export function issueVideoAccessToken(videoId) {
  const jti = crypto.randomUUID();
  const expiresInSeconds = config.tokenTtlSeconds;
  const expiresAtMillis = Date.now() + expiresInSeconds * 1000;

  const token = jwt.sign(
    {
      sub: 'ppv-viewer',
      scope: 'video:read',
      videoId,
    },
    config.jwtSecret,
    {
      jwtid: jti,
      expiresIn: expiresInSeconds,
    },
  );

  registerAccessToken(jti, videoId, expiresAtMillis);

  return {
    token,
    expiresInSeconds,
  };
}

export function verifyAccessToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

