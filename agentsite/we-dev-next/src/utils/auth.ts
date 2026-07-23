import * as jose from 'jose';

export const getJwtSecret = () =>
  new TextEncoder().encode(process.env.JWT_SECRET || 'test123456');

export async function verifyToken(token: string) {
  const { payload } = await jose.jwtVerify(token, getJwtSecret());
  if (typeof payload.userId !== 'string' || !payload.userId) {
    throw new Error('Invalid token payload');
  }
  return { userId: payload.userId };
}

export async function generateToken(userId: string) {
  return new jose.SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getJwtSecret());
}
