import { PrismaClient, Users, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import prisma from '../config/database';
import { PaginationParams } from '../types';

class UserService {
    async getAllUsers(filters: { role?: string; search?: string; isActive?: boolean } = {}, pagination: PaginationParams = {}): Promise<{ data: Users[], total: number }> {
        const { role, search, isActive } = filters;
        const page = pagination.page || 1;
        const limit = pagination.limit || 10;
        const skip = (page - 1) * limit;

        const where: Prisma.UsersWhereInput = {};

        if (role) {
            where.role = role;
        }

        if (isActive !== undefined) {
            where.isActive = isActive;
        }

        if (search) {
            where.OR = [
                { name: { contains: search } },
                { email: { contains: search } }
            ];
        }

        const [users, total] = await Promise.all([
            prisma.users.findMany({
                where,
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    isActive: true,
                    created_at: true,
                    updated_at: true
                },
                skip,
                take: limit,
                orderBy: {
                    created_at: 'desc'
                }
            }),
            prisma.users.count({ where })
        ]);

        return { data: users as Users[], total };
    }

    async getUserById(id: string): Promise<Users> {
        const user = await prisma.users.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
                created_at: true,
                updated_at: true
            }
        });

        if (!user) {
            throw new Error('Users not found');
        }

        return user as Users;
    }

    async getDeliveryPersonnel(): Promise<Users[]> {
        const result = await this.getAllUsers({ role: 'DELIVERY' });
        return result.data;
    }

    async updateUser(id: string, data: { name?: string; email?: string; password?: string; role?: string; isActive?: boolean }): Promise<Users> {
        // Verificar que el usuario existe
        await this.getUserById(id);

        const updateData: any = { ...data };

        // Si se proporciona una contraseña, hashearla
        if (data.password) {
            updateData.password = await bcrypt.hash(data.password, 10);
        }

        // Si se está actualizando el email, verificar que no exista
        if (data.email) {
            const existing = await prisma.users.findFirst({
                where: {
                    email: data.email,
                    NOT: { id }
                }
            });

            if (existing) {
                throw new Error('A user with this email already exists');
            }
        }

        return await prisma.users.update({
            where: { id },
            data: updateData,
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
                created_at: true,
                updated_at: true
            }
        }) as Users;
    }

    async deleteUser(id: string): Promise<Users> {
        // Verificar que el usuario existe
        await this.getUserById(id);

        // Verificar si tiene órdenes asignadas
        const ordersCount = await prisma.order.count({
            where: { deliveryPersonId: id }
        });

        if (ordersCount > 0) {
            throw new Error(`Cannot delete user with ${ordersCount} assigned orders. Deactivate instead.`);
        }

        return await prisma.users.delete({
            where: { id },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
                created_at: true,
                updated_at: true
            }
        }) as Users;
    }

    async createUser(data: { name: string; email: string; password: string; role: string }): Promise<Users> {
        const existing = await prisma.users.findUnique({
            where: { email: data.email }
        });

        if (existing) {
            throw new Error('Users with this email already exists');
        }

        const hashedPassword = await bcrypt.hash(data.password, 10);

        return await prisma.users.create({
            data: {
                ...data,
                password: hashedPassword
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
                created_at: true,
                updated_at: true
            }
        }) as Users;
    }
}

export default new UserService();
