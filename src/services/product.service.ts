import prisma from '../config/database';
import { ProductFilters, PaginationParams } from '../types';

class ProductService {
    private mapProduct(p: any) {
        if (!p) return p;
        const { product_colors, ...rest } = p;
        let images = rest.images;
        let sizes = rest.sizes;

        // Ensure images is an array, handling potential double JSON stringification
        if (images && typeof images === 'string') {
            try { 
                images = JSON.parse(images); 
                // Try parsing again if it's still a string (double encoded)
                if (typeof images === 'string') {
                    images = JSON.parse(images);
                }
            } catch {}
        }
        
        // Ensure sizes is an array
        if (sizes && typeof sizes === 'string') {
            try { 
                sizes = JSON.parse(sizes); 
                if (typeof sizes === 'string') {
                    sizes = JSON.parse(sizes);
                }
            } catch {}
        }

        return {
            ...rest,
            price: Number(rest.price),
            originalPrice: rest.originalPrice ? Number(rest.originalPrice) : Number(rest.price),
            // Compatibility aliases for frontend
            original_price: rest.originalPrice ? Number(rest.originalPrice) : Number(rest.price),
            image: (Array.isArray(images) && images.length > 0) ? images[0] : (images && !Array.isArray(images) ? images : ''),
            discount: Number(rest.discount || 0),
            images: Array.isArray(images) ? images : (images ? [images] : []),
            sizes: Array.isArray(sizes) ? sizes : (sizes ? [sizes] : []),
            colors: product_colors || []
        };
    }

    async getAllProducts(filters: ProductFilters = {}, pagination: PaginationParams = {}) {
        try {
            const { category, search, minPrice, maxPrice, featured, isActive, gender } = filters;
            const page = pagination.page || 1;
            const limit = pagination.limit || 20;
            const skip = (page - 1) * limit;

            const where: any = {};

            if (isActive !== undefined) where.isActive = isActive;
            if (featured !== undefined) where.featured = featured;
            if (gender) where.gender = gender;
            
            if (category) {
                where.OR = [
                    { categoryId: category },
                    { category: { slug: category } },
                    { category: { name: { contains: category } } }
                ];
            }

            if (search) {
                where.OR = [
                    ...(where.OR || []),
                    { name: { contains: search } },
                    { description: { contains: search } },
                    { reference: { contains: search } },
                    { barcode: { contains: search } }
                ];
            }

            if (minPrice !== undefined || maxPrice !== undefined) {
                where.price = {};
                if (minPrice !== undefined) where.price.gte = minPrice;
                if (maxPrice !== undefined) where.price.lte = maxPrice;
            }

            let orderBy: any = { created_at: 'desc' };
            if (filters.sort === 'price-asc') orderBy = { price: 'asc' };
            else if (filters.sort === 'price-desc') orderBy = { price: 'desc' };

            const [products, totalCount] = await Promise.all([
                prisma.product.findMany({
                    where,
                    include: {
                        category: true,
                        product_colors: true
                    },
                    orderBy,
                    skip,
                    take: limit
                }),
                prisma.product.count({ where })
            ]);

            return {
                products: products.map(p => this.mapProduct(p)),
                total: totalCount,
                page,
                totalPages: Math.ceil(totalCount / limit)
            };
        } catch (error) {
            throw error;
        }
    }

    async getProductById(productId: string) {
        try {
            const product = await prisma.product.findUnique({
                where: { id: productId },
                include: {
                    category: true,
                    product_colors: true
                }
            });

            if (!product) {
                const error: any = new Error('Product not found');
                error.statusCode = 404;
                throw error;
            }

            return this.mapProduct(product);
        } catch (error) {
            throw error;
        }
    }

    async checkStock(productId: string, quantity: number) {
        try {
            const product = await prisma.product.findUnique({
                where: { id: productId }
            });

            if (!product) {
                const error: any = new Error('Product not found');
                error.statusCode = 404;
                throw error;
            }

            if ((product.stock || 0) < quantity) {
                const error: any = new Error(`Insufficient stock. Available: ${product.stock}`);
                error.statusCode = 400;
                throw error;
            }

            return true;
        } catch (error) {
            throw error;
        }
    }

    async reduceStock(productId: string, quantity: number) {
        try {
            const product = await prisma.product.update({
                where: { id: productId },
                data: {
                    stock: {
                        decrement: quantity
                    }
                }
            });

            return product;
        } catch (error) {
            throw error;
        }
    }
    async createProduct(data: any) {
        try {
            const { colors, product_colors, id, created_at, updated_at, category, ...productData } = data;

            // Normalize empty strings to null
            if (productData.categoryId === '') productData.categoryId = null;
            if (productData.barcode === '') productData.barcode = null;
            if (productData.reference === '') productData.reference = null;

            // Note: We DON'T JSON.stringify images/sizes here because Prisma handles Json types with objects/arrays
            // If they are already strings, we keep them as is. If they are arrays, Prisma will save them as JSON arrays.

            // Ensure numeric fields are numbers
            if (productData.price) productData.price = Number(productData.price);
            if (productData.stock) productData.stock = Number(productData.stock);
            if (productData.discount) productData.discount = Number(productData.discount);

            // Ensure boolean fields are booleans
            if (productData.isActive !== undefined) productData.isActive = productData.isActive === true || productData.isActive === 'true';
            if (productData.featured !== undefined) productData.featured = productData.featured === true || productData.featured === 'true';

            const payloadColors = product_colors?.create || colors || [];

            const product = await prisma.product.create({
                data: {
                    ...productData,
                    product_colors: {
                        create: payloadColors.map((c: any) => ({
                            name: c.name,
                            hex: c.hex || c.code || c.value,
                            stock: Number(c.stock || 0)
                        }))
                    }
                },
                include: {
                    product_colors: true,
                    category: true
                }
            });
            return this.mapProduct(product);
        } catch (error) {
            throw error;
        }
    }

    async updateProduct(id: string, data: any) {
        try {
            const { colors, product_colors, id: _id, created_at, updated_at, category, ...productData } = data;

            // Note: Don't stringify Json fields for Prisma
            const payloadColors = product_colors?.create || colors || [];

            // Normalize empty strings to null
            if (productData.categoryId === '') productData.categoryId = null;
            if (productData.barcode === '') productData.barcode = null;
            if (productData.reference === '') productData.reference = null;

            // Perform update in a transaction to handle colors
            const product = await prisma.$transaction(async (tx) => {
                // 1. Update basic product data
                await tx.product.update({
                    where: { id },
                    data: productData
                });

                // 2. If colors provided, sync them
                if (colors !== undefined || product_colors !== undefined) {
                    const payloadColors = product_colors?.create || colors || [];
                    
                    // Identify IDs to keep
                    const keepIds = payloadColors
                        .filter((c: any) => c.id)
                        .map((c: any) => c.id);
                    
                    // Delete colors that are no longer present
                    await tx.product_colors.deleteMany({
                        where: {
                            productId: id,
                            id: { notIn: keepIds }
                        }
                    });

                    // Update or Create colors
                    for (const c of payloadColors) {
                        const colorData = {
                            name: c.name,
                            hex: c.hex || c.code || c.value,
                            stock: Number(c.stock || 0)
                        };

                        if (c.id) {
                            // Update existing color
                            await tx.product_colors.update({
                                where: { id: c.id },
                                data: colorData
                            });
                        } else {
                            // Create new color
                            await tx.product_colors.create({
                                data: {
                                    ...colorData,
                                    productId: id
                                }
                            });
                        }
                    }
                }

                return tx.product.findUnique({
                    where: { id },
                    include: {
                        product_colors: true,
                        category: true
                    }
                });
            });

            return this.mapProduct(product);
        } catch (error) {
            throw error;
        }
    }

    async deleteProduct(id: string) {
        try {
            // Borrado lógico: cambiamos isActive a false
            const product = await prisma.product.update({
                where: { id },
                data: { isActive: false }
            });
            return product;
        } catch (error: any) {
            throw error;
        }
    }

    async restoreProduct(id: string) {
        try {
            const product = await prisma.product.update({
                where: { id },
                data: { isActive: true }
            });
            return product;
        } catch (error: any) {
            throw error;
        }
    }

    async updateStock(id: string, stock: number) {
        try {
            const product = await prisma.product.update({
                where: { id },
                data: { stock }
            });
            return product;
        } catch (error) {
            throw error;
        }
    }

    async addProductImage(id: string, imageUrl: string) {
        try {
            const product = await prisma.product.findUnique({ where: { id } });
            if (!product) throw new Error('Product not found');

            const currentImages = product.images ? JSON.parse(product.images) : [];
            const parsedImages = Array.isArray(currentImages) ? currentImages : [currentImages];
            const images = [...parsedImages, imageUrl];

            return await prisma.product.update({
                where: { id },
                data: { images: JSON.stringify(images) }
            });
        } catch (error) {
            throw error;
        }
    }

    async removeProductImage(id: string, indexStr: string) {
        try {
            const index = parseInt(indexStr);
            if (isNaN(index)) throw new Error('Invalid image index');

            const product = await prisma.product.findUnique({ where: { id } });
            if (!product) throw new Error('Product not found');

            const currentImages = product.images ? JSON.parse(product.images) : [];
            const images = Array.isArray(currentImages) ? currentImages : [currentImages];

            if (index < 0 || index >= images.length) {
                throw new Error('Image index out of bounds');
            }

            const [removedUrl] = images.splice(index, 1);

            // Removing from storage is handled by service or controller? 
            // Better here to keep logic encapsulated, but I need StorageService.
            // I'll assume controller handles storage deletion OR I import StorageService here.
            // Circular dep check? Service -> Service is fine usually.
            // Let's import StorageService.

            /* 
               We need to delete from Supabase too.
               Importing storageService at top level might cause circular if storageService imports something else.
               StorageService is standalone. Safe.
            */

            return {
                product: await prisma.product.update({
                    where: { id },
                    data: { images: JSON.stringify(images) }
                }), removedUrl
            };

        } catch (error) {
            throw error;
        }
    }
}

export default new ProductService();
