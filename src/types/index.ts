import { Users } from '@prisma/client';
import { Request } from 'express';

// Extender Request de Express para incluir usuario autenticado
export interface AuthRequest extends Request {
    user?: Omit<Users, 'password'>;
    userType?: string;
}

// Tipos para DTOs de autenticación
export interface RegisterDTO {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
    phone: string;
    street?: string;
    neighborhood?: string;
    city?: string;
    department?: string;
}

export interface LoginDTO {
    email: string;
    password: string;
}

export interface UpdateProfileDTO {
    name?: string;
    phone?: string;
    street?: string;
    neighborhood?: string;
    city?: string;
    department?: string;
}

// Tipos para DTOs de productos
export interface CreateProductDTO {
    name: string;
    description?: string;
    reference: string;
    barcode?: string;
    price: number;
    images: string[];
    stock: number;
    sizes: string[];
    gender: 'BOY' | 'GIRL' | 'BABY' | 'UNISEX';
    categoryId: string;
    featured?: boolean;
    colors: {
        name: string;
        hex: string;
        stock: number;
    }[];
}

export interface UpdateProductDTO {
    name?: string;
    description?: string;
    reference?: string;
    barcode?: string;
    price?: number;
    images?: string[];
    stock?: number;
    sizes?: string[];
    gender?: 'BOY' | 'GIRL' | 'BABY' | 'UNISEX';
    categoryId?: string;
    featured?: boolean;
    isActive?: boolean;
}

// Tipos para DTOs de órdenes
export interface CreateOrderDTO {
    items: {
        productId: string;
        quantity: number;
        color?: string;
        size?: string;
    }[];
    shippingAddress: {
        name: string;
        phone: string;
        street: string;
        neighborhood: string;
        city: string;
        department: string;
    };
    shippingCost?: number;
    paymentMethod?: string;
}

// Tipos para filtros
export interface ProductFilters {
    category?: string;
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    featured?: boolean;
    isActive?: boolean;
    gender?: 'BOY' | 'GIRL' | 'BABY' | 'UNISEX';
    sort?: string;
}

export interface PaginationParams {
    page?: number;
    limit?: number;
}

export interface DashboardStats {
    totalSales: number;
    totalOrders: number;
    averageOrderValue: number;
    ordersByStatus: {
        status: string;
        count: number;
    }[];
    topProducts: {
        id: string;
        name: string;
        totalSold: number;
        revenue: number;
    }[];
    lowStockProducts: {
        id: string;
        name: string;
        stock: number;
        categoryName?: string;
    }[];
    recentOrders: {
        id: string;
        invoiceNumber?: string;
        customerName: string;
        total: number;
        status: string;
        createdAt: Date;
    }[];
}
