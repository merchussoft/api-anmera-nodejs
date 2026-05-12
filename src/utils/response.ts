// Respuestas estandarizadas de la API

export interface ApiResponse<T = any> {
    success: boolean;
    message: string;
    data?: T;
    statusCode?: number;
    errors?: any;
}

export interface PaginatedResponse<T = any> {
    success: boolean;
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasMore: boolean;
    };
}

export const successResponse = <T = any>(data: T, message: string = 'Success'): ApiResponse<T> => {
    return {
        success: true,
        message,
        data
    };
};

export const errorResponse = (message: string = 'Error', statusCode: number = 500, errors: any = null): ApiResponse => {
    return {
        success: false,
        message,
        statusCode,
        errors
    };
};

export const paginatedResponse = <T = any>(
    data: T[],
    page: number,
    limit: number,
    total: number
): PaginatedResponse<T> => {
    const totalPages = Math.ceil(total / limit);

    return {
        success: true,
        data,
        pagination: {
            page,
            limit,
            total,
            totalPages,
            hasMore: page < totalPages
        }
    };
};
