// Utilidades para manejo de moneda colombiana

export const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
};

export const toCents = (amount: number): number => {
    return Math.round(amount * 100);
};

export const fromCents = (cents: number): number => {
    return cents / 100;
};
