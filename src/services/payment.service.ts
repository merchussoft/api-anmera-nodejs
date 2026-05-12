import config from '../config/env';
import prisma from '../config/database';
import orderService from './order.service';
import { Order } from '@prisma/client';
import crypto from 'crypto';
import axios from 'axios';

interface PaymentSession {
    sessionId: string;
    paymentUrl: string;
    externalReference?: string;
    rawResponse?: any;
}

interface WidgetConfig {
    publicKey: string;
    currency: string;
    amountInCents: number;
    reference: string;
    signature: string;
    redirectUrl: string;
    customerData: {
        email: string;
        fullName: string;
        phoneNumber: string;
        phoneNumberPrefix: string;
    };
}

class PaymentService {
    private provider: 'wompi' | 'mock';

    constructor() {
        this.provider = config.paymentProvider;
    }

    async createPaymentSession(order: Order & { items: any[] }) {
        try {
            let session: PaymentSession;

            if (this.provider === 'wompi') {
                session = await this.createWompiSession(order);
            } else {
                session = this.createMockSession(order);
            }

            const payment = await prisma.payment.create({
                data: {
                    orderId: order.id,
                    provider: 'WOMPI' as any, // Start with 'WOMPI' as provider
                    amount: order.total || 0,
                    currency: 'COP',
                    paymentSessionId: session.sessionId,
                    paymentUrl: session.paymentUrl,
                    externalReference: session.externalReference || null,
                    status: 'PENDING',
                    rawResponse: session.rawResponse || null
                }
            });

            return {
                paymentId: payment.id,
                sessionId: session.sessionId,
                paymentUrl: session.paymentUrl,
                provider: this.provider
            };
        } catch (err) {
            console.error('Error creating payment session:', err);
            throw err;
        }
    }

    // -------------------------------
    // WOMPI SESSION (Redirect Link)
    // -------------------------------
    private async createWompiSession(order: Order & { items: any[] }): Promise<PaymentSession> {
        if (!config.wompiPubKey || !config.wompiIntegritySecret) {
            throw new Error('Wompi keys not configured');
        }

        const reference = `${order.id}-${Date.now()}`;
        const amountInCents = Math.round((order.total || 0) * 100);
        const currency = 'COP';

        // Generate Integrity Signature
        // Format: reference + amountInCents + currency + integritySecret
        // Use the "Integridad" secret from Wompi dashboard
        const integrityString = `${reference}${amountInCents}${currency}${config.wompiIntegritySecret}`;
        const signature = crypto.createHash('sha256').update(integrityString).digest('hex');

        // Construct Wompi Checkout URL
        // Using the standard checkout URL structure
        const redirectUrl = `${config.frontendUrl}/order-success?orderId=${order.id}`;

        // For Wompi Sandbox, use valid test phone number
        // Wompi requires specific test phone numbers in sandbox mode
        const isTestMode = config.wompiPubKey.includes('test');
        const phoneNumber = isTestMode ? '3999999999' : ((order as any).customer?.phone || '');

        const params = new URLSearchParams({
            'public-key': config.wompiPubKey,
            'currency': currency,
            'amount-in-cents': amountInCents.toString(),
            'reference': reference,
            'signature:integrity': signature,
            'redirect-url': redirectUrl,
            'customer-data:email': (order as any).customer?.email || '',
            'customer-data:full-name': (order as any).customer?.name || '',
            'customer-data:phone-number': phoneNumber,
        });

        // Wompi Checkout URL
        const paymentUrl = `https://checkout.wompi.co/p/?${params.toString()}`;

        return {
            sessionId: reference,
            paymentUrl: paymentUrl,
            externalReference: reference,
            rawResponse: { signature, integrityString } // Store for debugging if needed
        };
    }

    // -------------------------------
    // WOMPI WEBHOOK
    // -------------------------------
    async processWompiWebhook(data: any) {
        try {
            const { event, data: transactionData } = data;

            if (event === 'transaction.updated') {
                const { transaction } = transactionData;
                const { status, reference, id: transactionId } = transaction;

                // IMPORTANT: In production, verify signature to ensure authenticity
                // Wompi sends a signature in the payload verify it matches

                const lastHyphenIndex = reference.lastIndexOf('-');
                const orderId = lastHyphenIndex !== -1 ? reference.slice(0, lastHyphenIndex) : reference;

                if (orderId) {
                    let newStatus: 'APPROVED' | 'REJECTED' | 'PENDING' = 'PENDING';

                    if (status === 'APPROVED') {
                        newStatus = 'APPROVED';
                    } else if (status === 'DECLINED' || status === 'VOIDED' || status === 'ERROR') {
                        newStatus = 'REJECTED';
                    }

                    const paymentDetail = this.getFriendlyPaymentMethod(transaction);
                    const paymentMethodType = transaction.payment_method_type;

                    if (newStatus === 'APPROVED') {
                        await orderService.updatePaymentStatus(orderId, 'APPROVED', transactionId, paymentDetail, paymentMethodType, data);
                    } else if (newStatus === 'REJECTED') {
                        await orderService.updatePaymentStatus(orderId, 'REJECTED', transactionId, paymentDetail, paymentMethodType, data);
                    }

                    // Update Payment record
                    await prisma.payment.updateMany({
                        where: { paymentSessionId: reference },
                        data: {
                            status: newStatus as any,
                            webhookData: data
                        }
                    });

                    // Fallback update
                    await prisma.payment.updateMany({
                        where: { externalReference: reference },
                        data: {
                            status: newStatus as any,
                            webhookData: data
                        }
                    });
                }
            }

            return { success: true };
        } catch (err: any) {
            console.error('Wompi Webhook Error:', err.message);
            throw new Error(`Webhook Error: ${err.message}`);
        }
    }

    // -------------------------------
    // WOMPI STATUS CHECK
    // -------------------------------
    async checkWompiStatus(id: string) {
        try {
            // Determine API URL based on Key or Environment
            const isTest = config.wompiPubKey.includes('test');
            const baseUrl = isTest ? 'https://sandbox.wompi.co/v1' : 'https://production.wompi.co/v1';

            let transaction: any = null;
            let fullData: any = null;

            // 1. Intentar buscar por ID de transacción directamente
            try {
                const response = await axios.get(`${baseUrl}/transactions/${id}`);
                transaction = response.data?.data;
                fullData = response.data;
            } catch (error: any) {
                // 2. Si falla con 404, podría ser una Referencia. Intentar buscar por referencia.
                if (error.response?.status === 404 || id.includes('-')) {
                    try {
                        const searchResponse = await axios.get(`${baseUrl}/transactions?reference=${id}`);
                        const transactions = searchResponse.data?.data;
                        if (transactions && transactions.length > 0) {
                            transaction = transactions[0];
                            fullData = searchResponse.data;
                        }
                    } catch (searchError) {
                        console.error('Error searching by reference:', id);
                    }
                }

                // If still no transaction, throw the original error with its status code
                if (!transaction) {
                    const status = error.response?.status || 500;
                    const message = error.response?.data?.error?.reason || error.message;
                    const customError: any = new Error(message);
                    customError.statusCode = status;
                    throw customError;
                }
            }

            if (!transaction) {
                const error: any = new Error('No se encontró información de la transacción en Wompi');
                error.statusCode = 404;
                throw error;
            }

            const { status, reference, id: transactionId } = transaction;

            // Update Order Logic
            // The reference is built as orderId-timestamp. 
            // If orderId is a UUID, it contains hyphens, so we take everything but the last hyphen part.
            const lastHyphenIndex = reference.lastIndexOf('-');
            const orderId = lastHyphenIndex !== -1 ? reference.slice(0, lastHyphenIndex) : reference;

            if (orderId) {
                let newStatus: 'APPROVED' | 'REJECTED' | 'PENDING' = 'PENDING';

                if (status === 'APPROVED') {
                    newStatus = 'APPROVED';
                } else if (status === 'DECLINED' || status === 'VOIDED' || status === 'ERROR') {
                    newStatus = 'REJECTED';
                }

                // Keep the rest of the logic...
                const paymentDetail = this.getFriendlyPaymentMethod(transaction);
                const paymentMethodType = transaction.payment_method_type;

                if (newStatus === 'APPROVED') {
                    await orderService.updatePaymentStatus(orderId, 'APPROVED', transactionId, paymentDetail, paymentMethodType, fullData);
                } else if (newStatus === 'REJECTED') {
                    await orderService.updatePaymentStatus(orderId, 'REJECTED', transactionId, paymentDetail, paymentMethodType, fullData);
                }

                // Update Payment record
                await prisma.payment.updateMany({
                    where: { paymentSessionId: reference },
                    data: {
                        status: newStatus as any
                    }
                });

                // Fallback update
                await prisma.payment.updateMany({
                    where: { externalReference: reference },
                    data: { status: newStatus as any }
                });

                return {
                    status: newStatus,
                    transactionId,
                    raw: fullData
                };
            }

            return { status: 'UNKNOWN', message: 'Order ID not found in reference' };

        } catch (error: any) {
            console.error('Error checking Wompi status:', error.message);
            if (error.response) {
                console.error('Wompi API Error Data:', error.response.data);
            }

            // Si ya tiene statusCode, lo re-lanzamos tal cual
            if (error.statusCode) throw error;

            // Si no, lanzamos uno con 500
            const customError: any = new Error(`Status Check Error: ${error.message}`);
            customError.statusCode = 500;
            throw customError;
        }
    }

    // -------------------------------
    // VERIFY AND SYNC PAYMENT BY ORDER ID
    // -------------------------------
    async verifyAndSyncPayment(orderId: string) {
        try {
            // Find the payment record for this order
            const payment = await prisma.payment.findUnique({
                where: { orderId }
            });

            if (!payment) {
                throw new Error('Payment record not found for this order');
            }

            // Use the reference (paymentSessionId or externalReference) to check status
            const reference = payment.paymentSessionId || payment.externalReference;

            if (!reference) {
                throw new Error('No reference found for this payment');
            }

            console.log(`🔍 Verifying payment for order ${orderId} with reference ${reference}`);

            // Call checkWompiStatus with the reference
            return await this.checkWompiStatus(reference);

        } catch (error: any) {
            console.error('Error verifying and syncing payment:', error.message);
            throw error;
        }
    }

    private getFriendlyPaymentMethod(transaction: any): string {
        const type = transaction.payment_method_type;
        const details = transaction.payment_method;

        switch (type) {
            case 'CARD':
                const brand = details?.extra?.brand || 'TARJETA';
                const lastFour = details?.extra?.last_four || '';
                return `Tarjeta ${brand} ${lastFour ? `****${lastFour}` : ''}`.trim();
            case 'NEQUI':
                return 'Nequi';
            case 'PSE':
                const bank = details?.extra?.bank_name || '';
                return `PSE - ${bank}`.trim();
            case 'BANCOLOMBIA_TRANSFER':
                return 'Transferencia Bancolombia';
            case 'BANCOLOMBIA_COLLECT':
                return 'Corresponsal Bancolombia';
            case 'DAVIPLATA':
                return 'Daviplata';
            default:
                // Capitalize first letter
                return type ? type.charAt(0).toUpperCase() + type.slice(1).toLowerCase() : 'Wompi';
        }
    }

    async getAllPayments(filters: any = {}) {
        try {
            const { status, provider } = filters;
            const where: any = {};
            if (status) where.status = status;
            if (provider) where.provider = provider;

            return await prisma.payment.findMany({
                where,
                include: {
                    order: { select: { invoiceNumber: true, total: true } }
                },
                orderBy: { created_at: 'desc' }
            });
        } catch (error) {
            throw error;
        }
    }

    async getPaymentById(id: string) {
        try {
            const payment = await prisma.payment.findUnique({
                where: { id },
                include: {
                    order: {
                        include: {
                            items: true,
                            customer: { select: { name: true, email: true } }
                        }
                    }
                }
            });

            if (!payment) {
                const error: any = new Error('Payment not found');
                error.statusCode = 404;
                throw error;
            }

            return payment;
        } catch (error) {
            throw error;
        }
    }

    async getPaymentLogs(orderId?: string) {
        try {
            const where = orderId ? { orderId } : {};
            return await prisma.paymentLog.findMany({
                where,
                include: {
                    order: { select: { invoiceNumber: true } }
                },
                orderBy: { created_at: 'desc' }
            });
        } catch (error) {
            throw error;
        }
    }

    // -------------------------------
    // MOCK PROVIDER
    // -------------------------------
    private createMockSession(order: Order): PaymentSession {
        const mockId = `mock_${Date.now()}`;
        return {
            sessionId: mockId,
            paymentUrl: `${config.frontendUrl}/order-success?orderId=${order.id}&mock=true`,
            externalReference: order.id,
            rawResponse: { mock: true }
        };
    }

    // -------------------------------
    // WIDGET CONFIG (para frontend)
    // -------------------------------
    async createWidgetConfig(orderId: string): Promise<WidgetConfig> {
        // Debug: Log Wompi configuration
        console.log('🔧 Wompi Config Debug:', {
            hasPubKey: !!config.wompiPubKey,
            hasIntegritySecret: !!config.wompiIntegritySecret,
            pubKeyPrefix: config.wompiPubKey?.substring(0, 10) + '...',
        });

        if (!config.wompiPubKey || !config.wompiIntegritySecret) {
            console.error('❌ Wompi keys not configured:', {
                wompiPubKey: config.wompiPubKey ? 'SET' : 'NOT SET',
                wompiIntegritySecret: config.wompiIntegritySecret ? 'SET' : 'NOT SET',
            });
            throw new Error('Wompi keys not configured');
        }

        const order = await orderService.getOrderById(orderId);

        if (!order) {
            throw new Error('Order not found');
        }

        // Verificar si ya existe un pago para esta orden
        const existingPayment = await prisma.payment.findUnique({
            where: { orderId: order.id }
        });

        // Si ya existe y está aprobado, no permitir nuevo pago
        if (existingPayment && existingPayment.status === 'APPROVED') {
            throw new Error('Order already paid');
        }

        const reference = `${order.id}-${Date.now()}`;
        const amountInCents = Math.round((order.total || 0) * 100);
        const currency = 'COP';

        // Generar firma de integridad
        const integrityString = `${reference}${amountInCents}${currency}${config.wompiIntegritySecret}`;
        const signature = crypto.createHash('sha256').update(integrityString).digest('hex');

        const redirectUrl = `${config.frontendUrl}/order-success?orderId=${order.id}`;

        // Determinar teléfono según ambiente
        const isTestMode = config.wompiPubKey.includes('test');
        const phoneNumber = isTestMode ? '3999999999' : ((order as any).customer?.phone || '');

        // Si ya existe un pago pendiente, actualizarlo con nueva referencia
        if (existingPayment) {
            await prisma.payment.update({
                where: { id: existingPayment.id },
                data: {
                    paymentSessionId: reference,
                    externalReference: reference,
                    paymentUrl: redirectUrl,
                    rawResponse: JSON.stringify({ widget: true, retry: true })
                }
            });
        } else {
            // Crear nuevo registro de pago
            await prisma.payment.create({
                data: {
                    orderId: order.id,
                    provider: 'WOMPI' as any,
                    amount: order.total || 0,
                    currency: 'COP',
                    paymentSessionId: reference,
                    paymentUrl: redirectUrl,
                    externalReference: reference,
                    status: 'PENDING',
                    rawResponse: JSON.stringify({ widget: true })
                }
            });
        }

        return {
            publicKey: config.wompiPubKey,
            currency,
            amountInCents,
            reference,
            signature,
            redirectUrl,
            customerData: {
                email: (order as any).customer?.email || '',
                fullName: (order as any).customer?.name || '',
                phoneNumber: phoneNumber,
                phoneNumberPrefix: '+57',
            }
        };
    }
}

export default new PaymentService();
