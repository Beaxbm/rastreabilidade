import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { asyncHandler, createError } from '../middleware/errorHandler.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = Router();
const prisma = new PrismaClient();

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required')
});

// Login
router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  const body = loginSchema.parse(req.body);

  // Find user
  const user = await prisma.user.findUnique({
    where: { email: body.email }
  });

  if (!user || !user.isActive) {
    throw createError('Invalid email or password', 401);
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(body.password, user.password);
  if (!isPasswordValid) {
    throw createError('Invalid email or password', 401);
  }

  // Generate JWT
  if (!process.env.JWT_SECRET) {
    throw createError('JWT configuration error', 500);
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions
  );

  logger.info(`User logged in: ${user.email}`, {
    userId: user.id,
    ip: req.ip
  });

  res.json({
    message: 'Login successful',
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    }
  });
}));

// Get current user profile
router.get('/profile', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      updatedAt: true
    }
  });

  if (!user) {
    throw createError('User not found', 404);
  }

  res.json({ user });
}));

export { router as authRoutes };
export default router;