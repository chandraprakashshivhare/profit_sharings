import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_ALGORITHM = 'HS256';
const ACCESS_TOKEN_TTL_MINUTES = Number(process.env.ACCESS_TOKEN_TTL_MINUTES || 30);

if (!JWT_SECRET) {
  throw new Error('Please define JWT_SECRET in .env');
}

export async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function createAccessToken(userId, email, name) {
  const payload = {
    sub: userId,
    email,
    name,
    exp: Math.floor(Date.now() / 1000) + (ACCESS_TOKEN_TTL_MINUTES * 60),
    type: 'access'
  };
  return jwt.sign(payload, JWT_SECRET, { algorithm: JWT_ALGORITHM });
}

export function createRefreshToken(userId) {
  const payload = {
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
    type: 'refresh'
  };
  return jwt.sign(payload, JWT_SECRET, { algorithm: JWT_ALGORITHM });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
  } catch (error) {
    return null;
  }
}

export async function getUserFromRequest(request) {
  const token = request.cookies.get('access_token')?.value || 
                request.headers.get('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return null;
  }

  const payload = verifyToken(token);
  if (!payload || payload.type !== 'access') {
    return null;
  }

  return payload;
}
