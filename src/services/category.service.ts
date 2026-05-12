import { PrismaClient, Category } from '@prisma/client';
import prisma from '../config/database';

class CategoryService {
    async getAllCategories(filters: { isActive?: boolean } = {}, pagination: { page?: number; limit?: number } = {}) {
        try {
            const { isActive } = filters;
            const page = pagination.page || 1;
            const limit = pagination.limit || 20;
            const skip = (page - 1) * limit;

            const where = isActive !== undefined ? { isActive } : {};

            const [categories, total] = await Promise.all([
                prisma.category.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: {
                        name: 'asc'
                    }
                }),
                prisma.category.count({ where })
            ]);

            return {
                categories,
                total,
                page,
                totalPages: Math.ceil(total / limit)
            };
        } catch (error) {
            throw error;
        }
    }

    async getCategoryById(id: string): Promise<Category> {
        const category = await prisma.category.findUnique({
            where: { id }
        });

        if (!category) {
            throw new Error('Category not found');
        }

        return category;
    }

    async createCategory(data: { name: string; slug: string; description?: string }): Promise<Category> {
        // Verificar si ya existe una categoría con el mismo slug
        const existing = await prisma.category.findUnique({
            where: { slug: data.slug }
        });

        if (existing) {
            throw new Error('A category with this slug already exists');
        }

        return await prisma.category.create({
            data
        });
    }

    async updateCategory(id: string, data: { name?: string; slug?: string; description?: string }): Promise<Category> {
        // Verificar que la categoría existe
        await this.getCategoryById(id);

        // Si se está actualizando el slug, verificar que no exista
        if (data.slug) {
            const existing = await prisma.category.findFirst({
                where: {
                    slug: data.slug,
                    NOT: { id }
                }
            });

            if (existing) {
                throw new Error('A category with this slug already exists');
            }
        }

        return await prisma.category.update({
            where: { id },
            data
        });
    }

    async deleteCategory(id: string): Promise<Category> {
        // Verificar que la categoría existe
        await this.getCategoryById(id);

        // Verificar si hay productos asociados
        const productsCount = await prisma.product.count({
            where: { categoryId: id }
        });

        if (productsCount > 0) {
            throw new Error(`Cannot delete category with ${productsCount} associated products`);
        }

        return await prisma.category.delete({
            where: { id }
        });
    }
}

export default new CategoryService();
