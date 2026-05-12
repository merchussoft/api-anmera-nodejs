import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import prisma from '../../config/database';
import config from '../../config/env';
import { AuthRequest, RegisterDTO, LoginDTO, UpdateProfileDTO } from '../../types';
import { successResponse, errorResponse } from '../../utils/response';
import { LoggerService } from '../services/logger.service';
import { normalizeNumber, normalizeString, normalizeBoolean } from '../../utils/normalization';

const generateTokens = (id: string) => {
    const accessToken = jwt.sign({ id }, config.jwtSecret, {
        expiresIn: '15m'
    } as jwt.SignOptions);

    const refreshToken = jwt.sign({ id }, config.jwtSecret, {
        expiresIn: '7d'
    } as jwt.SignOptions);

    return { accessToken, refreshToken };
};

const sanitizeUser = (user: any, userType: string = 'CUSTOMER') => {
    const baseUser = {
        id: normalizeString(user.id),
        name: normalizeString(user.name),
        email: normalizeString(user.email),
        isActive: normalizeBoolean(user.isActive, true),
        created_at: user.created_at ? user.created_at.toISOString() : undefined,
        updated_at: user.updated_at ? user.updated_at.toISOString() : undefined,
        userType: user.role || userType,
    };

    if (userType === 'CUSTOMER') {
        return {
            ...baseUser,
            phone: user.phone ? normalizeString(user.phone) : null,
            street: user.street ? normalizeString(user.street) : null,
            neighborhood: user.neighborhood ? normalizeString(user.neighborhood) : null,
            city: user.city ? normalizeString(user.city) : null,
            department: user.department ? normalizeString(user.department) : null,
        };
    }

    return {
        ...baseUser,
        role: user.role || userType,
    };
};

class AuthController {
    async register(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const { name, email, password, password_confirmation, phone, street, neighborhood, city, department }: RegisterDTO = req.body;

            if (!password || !password_confirmation) {
                res.status(400).json(errorResponse('Password and confirmation are required', 400));
                return;
            }

            if (password !== password_confirmation) {
                res.status(400).json(errorResponse('Passwords do not match', 400));
                return;
            }

            const userExists = await prisma.users.findUnique({ where: { email } });

            if (userExists) {
                res.status(400).json(errorResponse('Email already registered', 400));
                return;
            }

            const hashedPassword = await bcrypt.hash(password, 10);

            const customer = await prisma.users.create({
                data: {
                    name,
                    email,
                    password: hashedPassword,
                    phone,
                    street,
                    neighborhood,
                    city,
                    department,
                    role: 'CUSTOMER'
                },
            });

            const tokens = generateTokens(customer.id);

            await LoggerService.success('REGISTER', 'New customer registered', { email: customer.email, id: customer.id });

            const { password: _, ...customerWithoutPassword } = customer;
            const sanitizedUser = sanitizeUser(customerWithoutPassword, 'CUSTOMER');

            res.status(201).json(
                successResponse({
                    user: sanitizedUser,
                    accessToken: tokens.accessToken,
                    refreshToken: tokens.refreshToken,
                    token: tokens.accessToken,
                    ...sanitizedUser
                }, 'Registration successful')
            );
        } catch (error: any) {
            await LoggerService.error('REGISTER_ERROR', 'Registration failed', { error: error.message || String(error) });
            next(error);
        }
    }

    async login(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const { email, password }: LoginDTO = req.body;

            if (!email || !password) {
                res.status(400).json(errorResponse('Please provide email and password', 400));
                return;
            }

            let user: any = await prisma.users.findUnique({ where: { email } });
            let userType: any;

            if (user) {
                userType = user.role;
            }

            if (!user) {
                await LoggerService.warn('LOGIN_FAIL', 'Invalid credentials', { email });
                res.status(401).json(errorResponse('Invalid credentials', 401));
                return;
            }

            const isPasswordValid = await bcrypt.compare(password, user.password);

            if (!isPasswordValid) {
                await LoggerService.warn('LOGIN_FAIL', 'Invalid credentials', { email });
                res.status(401).json(errorResponse('Invalid credentials', 401));
                return;
            }

            if (!user.isActive) {
                await LoggerService.warn('LOGIN_BLOCK', 'Inactive account attempt', { email });
                res.status(401).json(errorResponse('Account is inactive', 401));
                return;
            }

            const tokens = generateTokens(user.id);
            const { password: _, ...userWithoutPassword } = user;

            await LoggerService.success('LOGIN', 'User logged in', { email, userType });

            res.cookie('refreshToken', tokens.refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000
            });

            const sanitizedUser = sanitizeUser(userWithoutPassword, userType);

            res.json(
                successResponse({
                    user: sanitizedUser,
                    accessToken: tokens.accessToken,
                    refreshToken: tokens.refreshToken,
                    token: tokens.accessToken, // matching common naming
                    ...sanitizedUser // Flatten fields for frontend compatibility
                }, 'Login successful')
            );
        } catch (error: any) {
            await LoggerService.error('LOGIN_ERROR', 'Login error', { error: error.message || String(error) });
            next(error);
        }
    }

    async getProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const sanitizedUser = sanitizeUser(req.user, req.userType);
            res.json(successResponse({ user: sanitizedUser, ...sanitizedUser }, 'Profile retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async updateProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const { name, phone, street, neighborhood, city, department }: UpdateProfileDTO = req.body;
            const id = req.user!.id;

            const updatedUser = await prisma.users.update({
                where: { id },
                data: { name, phone, street, neighborhood, city, department },
            });

            const { password: _, ...userWithoutPassword } = updatedUser;

            await LoggerService.success('UPDATE_PROFILE', 'Profile updated', { id, userType: req.userType });

            const sanitizedUser = sanitizeUser(userWithoutPassword, req.userType);
            res.json(successResponse({ user: sanitizedUser, ...sanitizedUser }, 'Profile updated successfully'));
        } catch (error: any) {
            await LoggerService.error('UPDATE_PROFILE_ERROR', 'Profile update failed', { error: error.message || String(error) });
            next(error);
        }
    }

    async changePassword(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const { currentPassword, newPassword } = req.body;
            const id = req.user!.id;

            if (!currentPassword || !newPassword) {
                res.status(400).json(errorResponse('Please provide current and new password', 400));
                return;
            }

            // Find user (can be user or customer)
            const user = await prisma.users.findUnique({ where: { id } });

            if (!user) {
                res.status(404).json(errorResponse('User not found', 404));
                return;
            }

            // Verify current password
            const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
            if (!isPasswordValid) {
                res.status(400).json(errorResponse('Incorrect current password', 400));
                return;
            }

            // Hash new password
            const hashedPassword = await bcrypt.hash(newPassword, 10);

            // Update password
            await prisma.users.update({
                where: { id },
                data: { password: hashedPassword }
            });

            await LoggerService.success('CHANGE_PASSWORD', 'Password changed successfully', { id, userType: req.userType });
            res.json(successResponse(null, 'Password changed successfully'));
        } catch (error: any) {
            await LoggerService.error('CHANGE_PASSWORD_ERROR', 'Password change failed', { error: error.message || String(error) });
            next(error);
        }
    }

    async logout(req: any, res: Response, next: NextFunction): Promise<void> {
        try {
            res.clearCookie('refreshToken', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict'
            });

            res.status(200).json(successResponse(null, 'Logged out successfully'));
        } catch (error) {
            next(error);
        }
    }

    async refreshToken(req: any, res: Response, next: NextFunction): Promise<void> {
        try {
            const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;

            if (!refreshToken) {
                res.status(401).json(errorResponse('No refresh token provided', 401));
                return;
            }

            try {
                const decoded = jwt.verify(refreshToken, config.jwtSecret) as { id: string };
                const tokens = generateTokens(decoded.id);

                res.cookie('refreshToken', tokens.refreshToken, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'strict',
                    maxAge: 7 * 24 * 60 * 60 * 1000
                });

                res.json(successResponse({ accessToken: tokens.accessToken }, 'Token refreshed successfully'));
            } catch (err) {
                res.status(403).json(errorResponse('Invalid refresh token', 403));
            }
        } catch (error) {
            next(error);
        }
    }

    async me(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        this.getProfile(req, res, next);
    }
}

export default new AuthController();
