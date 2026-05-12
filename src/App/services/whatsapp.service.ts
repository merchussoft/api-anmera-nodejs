import axios, { AxiosInstance } from 'axios';
import prisma from '../../config/database';
import { LoggerService } from './logger.service';
import productService from '../../services/product.service';
import categoryService from '../../services/category.service';
import orderService from '../../services/order.service';

interface whatsappMessagePayload {
    messaging_product: string;
    recipient_type?: string;
    to: string;
    type: string;
    text?: { body: string };
    template?: {
        name: string;
        language: { code: string };
        components?: any[];
    };
    image?: {
        link?: string;
        id?: string;
        caption?: string;
    };
}

interface IncomingMessage {
    messages?: any[];
    statuses?: any[];
    contacts?: any[];
    metadata?: any;
}

export class WhatsAppService {
    private apiClient: AxiosInstance;
    private logger: LoggerService;
    private config: any = null;

    constructor() {
        this.logger = new LoggerService();

        // Initialize axios client
        this.apiClient = axios.create({
            baseURL: 'https://graph.facebook.com',
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    /**
     * Load WhatsApp config from database
     */
    private async loadConfig() {
        // Force refresh from DB to avoid caching issues during debugging
        const config = await prisma.whatsapp_config.findFirst({
            where: { isActive: true }
        });

        if (!config) {
            // Try to auto-initialize from environment variables if they exist
            const envPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
            const envAccessToken = process.env.WHATSAPP_ACCESS_TOKEN;
            const envAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
            const envVerifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

            if (envPhoneId && envAccessToken && envAccountId && envVerifyToken) {
                await LoggerService.log('INFO', 'WHATSAPP_AUTO_INIT', 'Initializing WhatsApp config from environment variables');
                const newConfig = await prisma.whatsapp_config.create({
                    data: {
                        phoneNumberId: envPhoneId,
                        accessToken: envAccessToken,
                        businessAccountId: envAccountId,
                        verifyToken: envVerifyToken,
                        apiVersion: process.env.WHATSAPP_API_VERSION || 'v21.0',
                        webhookUrl: process.env.WHATSAPP_WEBHOOK_URL || null,
                        isActive: true,
                        autoRespond: true
                    }
                });
                return newConfig;
            } else {
                throw new Error('WhatsApp configuration not found. Please configure WhatsApp in the dashboard or set environment variables.');
            }
        }

        // ALWAYS Sync .env to Database if they differ - This makes .env the source of truth
        const envToken = process.env.WHATSAPP_ACCESS_TOKEN;
        if (envToken && envToken !== config.accessToken) {
            console.log(`[DEBUG] Token mismatch! .env token differs from DB. Syncing...`);
            const updatedConfig = await prisma.whatsapp_config.update({
                where: { id: config.id },
                data: {
                    accessToken: envToken,
                    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || config.phoneNumberId,
                    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || config.businessAccountId,
                    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || config.verifyToken
                }
            });
            console.log(`[DEBUG] Sync Complete. Using token from .env (ends with ...${envToken.substring(envToken.length - 4)})`);
            return updatedConfig;
        }

        // Debug log to verify token (last 4 chars)
        const tokenMask = config.accessToken ? config.accessToken.substring(config.accessToken.length - 4) : 'null';
        console.log(`[DEBUG] Using WhatsApp token from DB (ends with ...${tokenMask})`);

        return config;
    }

    /**
     * Get API URL with version
     */
    private async getApiUrl(): Promise<string> {
        const config = await this.loadConfig();
        return `/${config.apiVersion}/${config.phoneNumberId}`;
    }

    /**
     * Get authorization headers
     */
    private async getHeaders(): Promise<any> {
        const config = await this.loadConfig();
        return {
            'Authorization': `Bearer ${config.accessToken}`,
            'Content-Type': 'application/json'
        };
    }

    /**
     * Send a text message
     */
    async sendMessage(to: string, message: string, conversationId?: string): Promise<any> {
        try {
            const apiUrl = await this.getApiUrl();
            const headers = await this.getHeaders();

            // Normalize phone number (remove non-digits, ensure country code)
            const normalizedPhone = this.normalizePhoneNumber(to);

            const payload: whatsappMessagePayload = {
                messaging_product: 'whatsapp',
                to: normalizedPhone,
                type: 'text',
                text: { body: message }
            };

            const response = await this.apiClient.post(
                `${apiUrl}/messages`,
                payload,
                { headers }
            );

            // Save message to database
            if (conversationId) {
                await this.saveOutboundMessage(
                    conversationId,
                    response.data.messages[0].id,
                    'TEXT',
                    message
                );
            }

            await LoggerService.log('INFO', 'WHATSAPP_SEND', `Message sent to ${normalizedPhone}`, {
                messageId: response.data.messages[0].id,
                to: normalizedPhone
            });

            return response.data;
        } catch (error: any) {
            await LoggerService.log('ERROR', 'WHATSAPP_SEND_FAILED',
                `Failed to send message to ${to}: ${error.message}`,
                { error: error.response?.data || error.message }
            );
            throw error;
        }
    }

    /**
     * Send a template message
     */
    async sendTemplate(
        to: string,
        templateName: string,
        variables: string[] = [],
        conversationId?: string
    ): Promise<any> {
        try {
            const apiUrl = await this.getApiUrl();
            const headers = await this.getHeaders();
            const normalizedPhone = this.normalizePhoneNumber(to);

            const components = variables.length > 0 ? [{
                type: 'body',
                parameters: variables.map(v => ({
                    type: 'text',
                    text: v
                }))
            }] : [];

            const payload: whatsappMessagePayload = {
                messaging_product: 'whatsapp',
                to: normalizedPhone,
                type: 'template',
                template: {
                    name: templateName,
                    language: { code: 'es' },
                    components
                }
            };

            const response = await this.apiClient.post(
                `${apiUrl}/messages`,
                payload,
                { headers }
            );

            // Save message to database
            if (conversationId) {
                await this.saveOutboundMessage(
                    conversationId,
                    response.data.messages[0].id,
                    'TEMPLATE',
                    `Template: ${templateName}`
                );
            }

            await LoggerService.log('INFO', 'WHATSAPP_TEMPLATE_SENT',
                `Template ${templateName} sent to ${normalizedPhone}`,
                { messageId: response.data.messages[0].id }
            );

            return response.data;
        } catch (error: any) {
            await LoggerService.log('ERROR', 'WHATSAPP_TEMPLATE_FAILED',
                `Failed to send template to ${to}: ${error.message}`,
                { error: error.response?.data || error.message }
            );
            throw error;
        }
    }

    /**
     * Send order confirmation
     */
    async sendOrderConfirmation(order: any): Promise<any> {
        try {
            const phone = order.shippingPhone;
            const itemsText = order.items
                .map((item: any) => `• ${item.productName} x${item.quantity}`)
                .join('\n');

            const message = `
🎉 *¡Pedido Confirmado!*

Hola ${order.shippingName},

Tu pedido *#${order.invoiceNumber}* ha sido confirmado exitosamente.

📦 *Productos:*
${itemsText}

💰 *Total:* $${order.total.toLocaleString('es-CO')} COP

📍 *Dirección de envío:*
${order.shippingStreet}
${order.shippingNeighborhood}, ${order.shippingCity}
${order.shippingDepartment}

Pronto recibirás actualizaciones sobre tu envío.

¡Gracias por confiar en AnmeraStore! 👶💕
            `.trim();

            // Find or create conversation
            let conversation = await this.findOrCreateConversation(
                phone,
                order.shippingName,
                order.customerId
            );

            return await this.sendMessage(phone, message, conversation.id);
        } catch (error) {
            console.error('Error sending order confirmation:', error);
            throw error;
        }
    }

    /**
     * Send order status update
     */
    async sendOrderStatusUpdate(order: any, newStatus: string): Promise<any> {
        try {
            const phone = order.shippingPhone;
            let message = '';

            switch (newStatus) {
                case 'PAID':
                    message = `
✅ *Pago Confirmado*

Hola ${order.shippingName},

Hemos confirmado tu pago para el pedido *#${order.invoiceNumber}*.

Tu pedido está siendo procesado.

AnmeraStore 👶💕
                    `.trim();
                    break;

                case 'PROCESSING':
                    message = `
📦 *Procesando Pedido*

Hola ${order.shippingName},

Tu pedido *#${order.invoiceNumber}* está siendo preparado.

Pronto estará listo para envío.

AnmeraStore 👶💕
                    `.trim();
                    break;

                case 'READY_FOR_DELIVERY':
                    message = `
🚚 *Listo para Envío*

Hola ${order.shippingName},

Tu pedido *#${order.invoiceNumber}* está listo y será enviado pronto.

AnmeraStore 👶💕
                    `.trim();
                    break;

                case 'SHIPPED':
                    message = `
🚚 *Pedido en Camino*

Hola ${order.shippingName},

Tu pedido *#${order.invoiceNumber}* ha sido enviado y está en camino.

Pronto llegará a tu dirección.

AnmeraStore 👶💕
                    `.trim();
                    break;

                case 'DELIVERED':
                    message = `
🎉 *Pedido Entregado*

Hola ${order.shippingName},

Tu pedido *#${order.invoiceNumber}* ha sido entregado exitosamente.

¡Gracias por tu compra!

¿Qué tal tu experiencia? Nos encantaría saber tu opinión.

AnmeraStore 👶💕
                    `.trim();
                    break;

                case 'CANCELLED':
                    message = `
❌ *Pedido Cancelado*

Hola ${order.shippingName},

Tu pedido *#${order.invoiceNumber}* ha sido cancelado.

Si tienes alguna pregunta, no dudes en contactarnos.

AnmeraStore 👶💕
                    `.trim();
                    break;

                default:
                    return null;
            }

            if (!message) return null;

            let conversation = await this.findOrCreateConversation(
                phone,
                order.shippingName,
                order.customerId
            );

            return await this.sendMessage(phone, message, conversation.id);
        } catch (error) {
            console.error('Error sending status update:', error);
            throw error;
        }
    }

    /**
     * Handle incoming message from webhook
     */
    async handleIncomingMessage(value: IncomingMessage): Promise<void> {
        try {
            if (!value.messages || value.messages.length === 0) return;

            for (const message of value.messages) {
                const from = message.from;
                const contactName = value.contacts?.find((c: any) => c.wa_id === from)?.profile?.name || 'Cliente';

                // Check if message already exists to avoid P2002
                const existingMessage = await prisma.whatsappMessage.findUnique({
                    where: { messageId: message.id }
                });

                if (existingMessage) {
                    console.log(`[WhatsApp] Skipping existing message: ${message.id}`);
                    continue;
                }

                // Find or create conversation
                const conversation = await this.findOrCreateConversation(from, contactName);

                // Determine message type and content
                let content = '';
                let mediaUrl = null;
                let messageType = 'TEXT';

                if (message.text) {
                    content = message.text.body;
                    messageType = 'TEXT';
                } else if (message.image) {
                    content = message.image.caption || '[Imagen]';
                    mediaUrl = message.image.id;
                    messageType = 'IMAGE';
                } else if (message.document) {
                    content = message.document.filename || '[Documento]';
                    mediaUrl = message.document.id;
                    messageType = 'DOCUMENT';
                } else if (message.audio) {
                    content = '[Audio]';
                    mediaUrl = message.audio.id;
                    messageType = 'AUDIO';
                } else if (message.video) {
                    content = '[Video]';
                    mediaUrl = message.video.id;
                    messageType = 'VIDEO';
                }

                // Save message to database
                await prisma.whatsappMessage.create({
                    data: {
                        conversationId: conversation.id,
                        messageId: message.id,
                        direction: 'INBOUND',
                        type: messageType as any,
                        content,
                        mediaUrl,
                        metadata: message
                    }
                });

                // Update conversation last message time
                await prisma.whatsappConversation.update({
                    where: { id: conversation.id },
                    data: { lastMessageAt: new Date() }
                });

                await LoggerService.log('INFO', 'WHATSAPP_MESSAGE_RECEIVED',
                    `Message received from ${from}`,
                    { messageId: message.id, type: messageType }
                );

                // Handle auto-response
                const config = await this.loadConfig();
                if (config.autoRespond && messageType === 'TEXT') {
                    await this.handleAutoResponse(from, content, conversation.id);
                }
            }
        } catch (error: any) {
            await LoggerService.log('ERROR', 'WHATSAPP_INCOMING_FAILED',
                `Error handling incoming message: ${error.message}`,
                { error }
            );
            throw error;
        }
    }

    /**
     * Handle message status updates
     */
    async handleMessageStatus(statuses: any[]): Promise<void> {
        try {
            for (const status of statuses) {
                await prisma.whatsappMessage.updateMany({
                    where: { messageId: status.id },
                    data: {
                        status: status.status.toUpperCase() as any,
                        metadata: status
                    }
                });

                await LoggerService.log('INFO', 'WHATSAPP_STATUS_UPDATE',
                    `Message ${status.id} status: ${status.status}`,
                    { status }
                );
            }
        } catch (error: any) {
            await LoggerService.log('ERROR', 'WHATSAPP_STATUS_FAILED',
                `Error updating message status: ${error.message}`,
                { error }
            );
        }
    }

    /**
     * Auto-response handler - Numbered Menu System (Strict Store Logic)
     */
    private async handleAutoResponse(to: string, message: string, conversationId: string): Promise<void> {
        try {
            const lowerMessage = message.toLowerCase().trim();
            const config = await this.loadConfig();

            // Load conversation state
            const conversation = await prisma.whatsappConversation.findUnique({
                where: { id: conversationId }
            });

            const rawMetadata = conversation?.metadata;
            let metadata: any = { stage: 'HOME' };
            if (rawMetadata) {
                try {
                    metadata = typeof rawMetadata === 'string' ? JSON.parse(rawMetadata) : rawMetadata;
                } catch(e) {}
            }
            let currentStage = metadata.stage;

            // Check business hours
            if (!this.isBusinessHour(config.businessHoursStart || undefined, config.businessHoursEnd || undefined)) {
                await this.sendMessage(to, `🕐 Hola. Nuestro horario de atención es de ${config.businessHoursStart || '9:00'} a ${config.businessHoursEnd || '18:00'}. Te responderemos pronto.`, conversationId);
                return;
            }

            // Global commands (Back to Home)
            if (lowerMessage === '0' || lowerMessage === 'menu' || lowerMessage === 'inicio' || lowerMessage.match(/^(hola|hi)/)) {
                await prisma.whatsappConversation.update({
                    where: { id: conversationId },
                    data: { metadata: JSON.stringify({ stage: 'HOME' }) }
                });
                await this.sendMessage(
                    to,
                    '¡Hola! 👋 Bienvenido a *AnmeraStore*.\n\n' +
                    'Selecciona una opción:\n' +
                    '1️⃣ Ver catálogo de productos\n' +
                    '2️⃣ Consultar estado de mi pedido\n' +
                    '3️⃣ Hablar con soporte\n\n' +
                    'Responde solo con el número de la opción.',
                    conversationId
                );
                return;
            }

            // --- STATE-BASED LOGIC ---

            // 1. HOME STAGE
            if (currentStage === 'HOME') {
                if (lowerMessage === '1') {
                    await prisma.whatsappConversation.update({
                        where: { id: conversationId },
                        data: { metadata: JSON.stringify({ stage: 'CATEGORY_SELECTION' }) }
                    });
                    await this.sendMessage(
                        to,
                        '🛍️ *Categorías*\n\n' +
                        '1️⃣ 👶 Bebés\n' +
                        '2️⃣ 👧 Niñas\n' +
                        '3️⃣ 👦 Niños\n' +
                        '4️⃣ ⬅️ Volver al menú principal\n\n' +
                        'Responde solo con el número.',
                        conversationId
                    );
                } else if (lowerMessage === '2') {
                    await prisma.whatsappConversation.update({
                        where: { id: conversationId },
                        data: { metadata: JSON.stringify({ stage: 'ORDER_QUERY' }) }
                    });
                    await this.sendMessage(
                        to,
                        'Por favor envía tu número de factura (ejemplo: INV-12345).\n\n' +
                        '0️⃣ Volver al menú principal',
                        conversationId
                    );
                } else if (lowerMessage === '3') {
                    await this.sendMessage(
                        to,
                        '💬 Un asesor atenderá tu solicitud muy pronto.\n\n' +
                        '0️⃣ Volver al menú principal',
                        conversationId
                    );
                } else {
                    await this.sendMessage(to, 'Opción no válida. 😕\nEscribe *0* para ver el menú principal.', conversationId);
                }
                return;
            }

            // 2. CATEGORY SELECTION
            if (currentStage === 'CATEGORY_SELECTION') {
                const catMap: any = { '1': 'Bebés', '2': 'Niñas', '3': 'Niños' };
                if (lowerMessage === '4') {
                    await prisma.whatsappConversation.update({
                        where: { id: conversationId },
                        // @ts-ignore
                        data: { metadata: { stage: 'HOME' } }
                    });
                    await this.handleAutoResponse(to, '0', conversationId);
                } else if (catMap[lowerMessage]) {
                    await prisma.whatsappConversation.update({
                        where: { id: conversationId },
                        // @ts-ignore
                        data: {
                            metadata: JSON.stringify({
                                stage: 'PRODUCT_LIST',
                                category: catMap[lowerMessage],
                                page: 1
                            })
                        }
                    });
                    await this.handleProductsInquiry(to, catMap[lowerMessage], conversationId, 1);
                } else {
                    await this.sendMessage(to, 'Por favor elige una categoría (1-4) o escribe *0* para el menú principal.', conversationId);
                }
                return;
            }

            // 3. PRODUCT LIST
            if (currentStage === 'PRODUCT_LIST') {
                if (lowerMessage === '4') { // Ver más
                    const nextPage = (metadata.page || 1) + 1;
                    await prisma.whatsappConversation.update({
                        where: { id: conversationId },
                        data: { metadata: JSON.stringify({ ...metadata, page: nextPage }) }
                    });
                    await this.handleProductsInquiry(to, metadata.category, conversationId, nextPage);
                } else if (lowerMessage === '5') { // Cambiar categoría
                    await prisma.whatsappConversation.update({
                        where: { id: conversationId },
                        data: { metadata: JSON.stringify({ stage: 'CATEGORY_SELECTION' }) }
                    });
                    await this.handleAutoResponse(to, '1', conversationId);
                } else if (lowerMessage === '6' || lowerMessage === '0') {
                    await prisma.whatsappConversation.update({
                        where: { id: conversationId },
                        data: { metadata: JSON.stringify({ stage: 'HOME' }) }
                    });
                    await this.handleAutoResponse(to, '0', conversationId);
                } else {
                    await this.sendMessage(to, 'Elija una opción (4-6) o *0* para el inicio.', conversationId);
                }
                return;
            }

            // 4. ORDER QUERY
            if (currentStage === 'ORDER_QUERY') {
                const invoiceMatch = lowerMessage.match(/(#inv-|inv-|\d{5,})/i);
                if (invoiceMatch) {
                    const order = await orderService.getOrderByInvoiceNumber(invoiceMatch[0]);
                    if (order) {
                        const statusMap: any = {
                            'PENDING': 'Pendiente', 'PAID': 'Pagado', 'PROCESSING': 'En preparación',
                            'READY_FOR_DELIVERY': 'Listo para entrega', 'SHIPPED': 'Enviado',
                            'DELIVERED': 'Entregado', 'CANCELLED': 'Cancelado'
                        };
                        await this.sendMessage(to, `📦 Pedido *${order.invoiceNumber}*\nEstado: *${statusMap[order.status!] || order.status}*\n\n0️⃣ Menú principal`, conversationId);
                    } else {
                        await this.sendMessage(to, `No se encontró el pedido *${lowerMessage}*.\n\n0️⃣ Reintentar o volver al menú.`, conversationId);
                    }
                } else {
                    await this.sendMessage(to, 'Por favor envía un número de factura válido o escribe *0* para el menú.', conversationId);
                }
                return;
            }

            // Catch-all
            await this.handleAutoResponse(to, '0', conversationId);

        } catch (error) {
            console.error('Error in auto-response:', error);
        }
    }

    /**
     * Handle detailed products inquiry - Store Navigation Style
     */
    private async handleProductsInquiry(to: string, categoryName: string, conversationId: string, page: number = 1): Promise<void> {
        try {
            const { categories } = await categoryService.getAllCategories({ isActive: true });
            const selectedCategory = categories.find(c => c.name?.toLowerCase() === categoryName.toLowerCase());

            if (selectedCategory) {
                const limit = 3;

                const { products } = await productService.getAllProducts(
                    { category: selectedCategory.id, isActive: true },
                    { limit, page }
                );

                if (products && products.length > 0) {
                    const emojis = ['1️⃣', '2️⃣', '3️⃣'];
                    const productsList = products.map((p: any, i: number) =>
                        `${emojis[i]} ${p.name} – $${p.price.toLocaleString('es-CO')}`
                    ).join('\n');

                    const responseMessage =
                        `🛍️ *${selectedCategory.name}*\n\n` +
                        `${productsList}\n\n` +
                        `4️⃣ Ver más productos\n` +
                        `5️⃣ Cambiar categoría\n` +
                        `6️⃣ Menú principal`;

                    await this.sendMessage(to, responseMessage, conversationId);
                    return;
                } else {
                    const msg = page > 1
                        ? 'No hay más productos en esta categoría.'
                        : `Sin productos en *${selectedCategory.name}*.`;

                    await this.sendMessage(
                        to,
                        msg + '\n\n5️⃣ Cambiar categoría\n6️⃣ Menú principal',
                        conversationId
                    );
                    return;
                }
            }
            await this.handleAutoResponse(to, '0', conversationId);
        } catch (error) {
            console.error('Error handling products inquiry:', error);
        }
    }

    /**
     * Find or create conversation
     */
    private async findOrCreateConversation(
        phone: string,
        name?: string,
        customerId?: string
    ): Promise<any> {
        const normalizedPhone = this.normalizePhoneNumber(phone);

        let conversation = await prisma.whatsappConversation.findFirst({
            where: { customerPhone: normalizedPhone }
        });

        if (!conversation) {
            conversation = await prisma.whatsappConversation.create({
                data: {
                    customerPhone: normalizedPhone,
                    customerName: name,
                    customerId
                }
            });
        } else if (customerId && !conversation.customerId) {
            // Link conversation to customer if not already linked
            conversation = await prisma.whatsappConversation.update({
                where: { id: conversation.id },
                data: { customerId }
            });
        }

        return conversation;
    }

    /**
     * Save outbound message to database
     */
    private async saveOutboundMessage(
        conversationId: string,
        messageId: string,
        type: string,
        content: string,
        sentBy?: string
    ): Promise<void> {
        await prisma.whatsappMessage.create({
            data: {
                conversationId,
                messageId,
                direction: 'OUTBOUND',
                type: type as any,
                content,
                sentBy,
                status: 'SENT'
            }
        });

        // Update conversation last message time
        await prisma.whatsappConversation.update({
            where: { id: conversationId },
            data: { lastMessageAt: new Date() }
        });
    }

    /**
     * Normalize phone number (add country code if missing)
     */
    private normalizePhoneNumber(phone: string): string {
        // Remove all non-digits
        let normalized = phone.replace(/\D/g, '');

        // If it starts with 0, remove it (common in Colombia)
        if (normalized.startsWith('0')) {
            normalized = normalized.substring(1);
        }

        // If it doesn't have country code (57 for Colombia), add it
        if (!normalized.startsWith('57') && normalized.length === 10) {
            normalized = '57' + normalized;
        }

        return normalized;
    }

    /**
     * Check if current time is within business hours
     */
    private isBusinessHour(startTime?: string, endTime?: string): boolean {
        if (!startTime || !endTime) return true;

        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTime = currentHour * 60 + currentMinute;

        const [startHour, startMinute] = startTime.split(':').map(Number);
        const [endHour, endMinute] = endTime.split(':').map(Number);

        const startMinutes = startHour * 60 + startMinute;
        const endMinutes = endHour * 60 + endMinute;

        return currentTime >= startMinutes && currentTime <= endMinutes;
    }

    /**
     * Get conversation history
     */
    async getConversationHistory(conversationId: string, limit: number = 50): Promise<any> {
        return await prisma.whatsappMessage.findMany({
            where: { conversationId },
            orderBy: { createdAt: 'desc' },
            take: limit
        });
    }

    /**
     * Get all active conversations
     */
    async getActiveConversations(limit: number = 50): Promise<any> {
        return await prisma.whatsappConversation.findMany({
            where: { status: 'ACTIVE' },
            include: {
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1
                },
                customer: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            },
            orderBy: { lastMessageAt: 'desc' },
            take: limit
        });
    }

    /**
     * Mark conversation as read
     */
    async markConversationAsRead(conversationId: string): Promise<void> {
        await prisma.whatsappMessage.updateMany({
            where: {
                conversationId,
                direction: 'INBOUND',
                status: { not: 'READ' }
            },
            data: { status: 'READ' }
        });
    }

    /**
     * Close conversation
     */
    async closeConversation(conversationId: string): Promise<void> {
        await prisma.whatsappConversation.update({
            where: { id: conversationId },
            data: { status: 'CLOSED' }
        });
    }

    /**
     * Test WhatsApp connection
     */
    async testConnection(): Promise<boolean> {
        try {
            const config = await this.loadConfig();
            const response = await this.apiClient.get(
                `/${config.apiVersion}/${config.phoneNumberId}`,
                { headers: await this.getHeaders() }
            );
            return response.status === 200;
        } catch (error) {
            return false;
        }
    }
}
