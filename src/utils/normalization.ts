import { Prisma } from '@prisma/client';

export type NormalizedNumber = number;
export type NormalizedString = string;
export type NormalizedBoolean = boolean;

export const normalizeNumber = (value: any, defaultValue: number = 0): NormalizedNumber => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  }
  return defaultValue;
};

export const normalizeString = (value: any, defaultValue: string = ''): NormalizedString => {
  if (value === null || value === undefined) {
    return defaultValue;
  }
  return String(value);
};

export const normalizeBoolean = (value: any, defaultValue: boolean = false): NormalizedBoolean => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    return lower === 'true' || lower === '1' || lower === 'yes';
  }
  if (typeof value === 'number') {
    return value === 1;
  }
  return defaultValue;
};

export const normalizeDate = (value: any): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const normalizeArray = <T>(value: any): T[] => {
  if (Array.isArray(value)) {
    return value;
  }
  return [];
};

export const normalizeObject = <T extends Record<string, any>>(
  value: any,
  schema?: { [K in keyof T]?: (v: any) => T[K] }
): T => {
  if (typeof value !== 'object' || value === null) {
    return {} as T;
  }
  
  const result: any = {};
  
  if (schema) {
    for (const key in schema) {
      if (key in value && schema[key]) {
        result[key] = schema[key]!(value[key]);
      }
    }
  } else {
    return value as T;
  }
  
  return result;
};

export const normalizeStats = (stats: any): any => {
  return {
    ...stats,
    totalSales: normalizeNumber(stats.totalSales),
    totalOrders: normalizeNumber(stats.totalOrders),
    averageOrderValue: normalizeNumber(stats.averageOrderValue),
    ordersByStatus: normalizeArray(stats.ordersByStatus).map((item: any) => ({
      status: normalizeString(item.status),
      count: normalizeNumber(item.count)
    })),
    topProducts: normalizeArray(stats.topProducts).map((item: any) => ({
      id: normalizeString(item.id),
      name: normalizeString(item.name),
      totalSold: normalizeNumber(item.totalSold),
      revenue: normalizeNumber(item.revenue)
    })),
    lowStockProducts: normalizeArray(stats.lowStockProducts).map((item: any) => ({
      id: normalizeString(item.id),
      name: normalizeString(item.name),
      stock: normalizeNumber(item.stock),
      categoryName: normalizeString(item.categoryName)
    })),
    recentOrders: normalizeArray(stats.recentOrders).map((item: any) => ({
      id: normalizeString(item.id),
      invoiceNumber: normalizeString(item.invoiceNumber),
      customerName: normalizeString(item.customerName),
      total: normalizeNumber(item.total),
      status: normalizeString(item.status),
      createdAt: normalizeDate(item.createdAt)
    }))
  };
};
