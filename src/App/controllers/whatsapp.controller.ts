import { Request, Response } from 'express';
import prisma from '../../config/database';
import { WhatsAppService } from '../services/whatsapp.service';
import { successResponse } from '../../utils/response';

const whatsappService = new WhatsAppService();

/**
 * Webhook Verification - Required by Meta
 * GET /api/whatsapp/webhook
 */
export const verifyWebhook = (req: Request, res: Response) => {
    try {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        console.log('Webhook verification request:', { mode, token, challenge });

        // Check if verify token matches
        if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
            console.log('Webhook verified successfully');
            res.status(200).send(challenge);
        } else {
            console.log('Webhook verification failed');
            res.sendStatus(403);
        }
    } catch (error) {
        console.error('Error in webhook verification:', error);
        res.sendStatus(500);
    }
};

/**
 * Receive Messages from WhatsApp (Webhook)
 * POST /api/whatsapp/webhook
 */
export const receiveWebhook = async (req: Request, res: Response) => {
    try {
        const body = req.body;

        console.log('Webhook received:', JSON.stringify(body, null, 2));

        // Acknowledge receipt immediately (Meta requirement)
        res.sendStatus(200);

        // Process webhook asynchronously
        if (body.object === 'whatsapp_business_account') {
            for (const entry of body.entry) {
                const changes = entry.changes[0];
                const value = changes.value;

                // Handle incoming messages
                if (value.messages) {
                    await whatsappService.handleIncomingMessage(value);
                }

                // Handle message status updates
                if (value.statuses) {
                    await whatsappService.handleMessageStatus(value.statuses);
                }
            }
        }
    } catch (error) {
        console.error('Error processing webhook:', error);
        // Don't return error to Meta - already sent 200
    }
};

/**
 * Send a test message
 * POST /api/whatsapp/test
 */
export const sendTestMessage = async (req: Request, res: Response) => {
    try {
        const { phone, message } = req.body;

        if (!phone || !message) {
            return res.status(400).json({
                message: 'Teléfono y mensaje son requeridos'
            });
        }

        const result = await whatsappService.sendMessage(phone, message);

        res.json(successResponse(result, 'Mensaje de prueba enviado'));
    } catch (error: any) {
        console.error('Error sending test message:', error);
        res.status(500).json({
            message: 'Error al enviar mensaje',
            error: error.response?.data || error.message
        });
    }
};

/**
 * Send order notification
 * POST /api/whatsapp/order/:orderId/notify
 */
export const sendOrderNotification = async (req: Request, res: Response) => {
    try {
        const { orderId } = req.params;

        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                customer: true,
                items: {
                    include: {
                        product: true
                    }
                }
            }
        });

        if (!order) {
            return res.status(404).json({ message: 'Pedido no encontrado' });
        }

        const result = await whatsappService.sendOrderConfirmation(order);

        res.json(successResponse(result, 'Notificación de pedido enviada'));
    } catch (error: any) {
        console.error('Error sending order notification:', error);
        res.status(500).json({
            message: 'Error al enviar notificación',
            error: error.message
        });
    }
};

/**
 * Send order status update
 * POST /api/whatsapp/order/:orderId/status
 */
export const sendStatusUpdate = async (req: Request, res: Response) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;

        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                customer: true,
                items: true
            }
        });

        if (!order) {
            return res.status(404).json({ message: 'Pedido no encontrado' });
        }

        const result = await whatsappService.sendOrderStatusUpdate(order, status);

        res.json(successResponse(result, 'Actualización de estado enviada'));
    } catch (error: any) {
        console.error('Error sending status update:', error);
        res.status(500).json({
            message: 'Error al enviar actualización',
            error: error.message
        });
    }
};

/**
 * Get all active conversations
 * GET /api/whatsapp/conversations
 */
export const getConversations = async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;

        const conversations = await whatsappService.getActiveConversations(limit);

        res.json(successResponse(conversations, 'Conversaciones obtenidas'));
    } catch (error: any) {
        console.error('Error fetching conversations:', error);
        res.status(500).json({
            message: 'Error al obtener conversaciones',
            error: error.message
        });
    }
};

/**
 * Get conversation by ID with message history
 * GET /api/whatsapp/conversations/:id
 */
export const getConversationById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const limit = parseInt(req.query.limit as string) || 100;

        const conversation = await prisma.whatsappConversation.findUnique({
            where: { id },
            include: {
                customer: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true
                    }
                },
                messages: {
                    orderBy: { createdAt: 'asc' },
                    take: limit
                }
            }
        });

        if (!conversation) {
            return res.status(404).json({ message: 'Conversación no encontrada' });
        }

        res.json(successResponse(conversation, 'Conversación obtenida'));
    } catch (error: any) {
        console.error('Error fetching conversation:', error);
        res.status(500).json({
            message: 'Error al obtener conversación',
            error: error.message
        });
    }
};

/**
 * Send message to conversation
 * POST /api/whatsapp/conversations/:id/send
 */
export const sendMessageToConversation = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { message } = req.body;
        const userId = (req as any).user?.id; // From auth middleware

        if (!message) {
            return res.status(400).json({ message: 'Mensaje es requerido' });
        }

        const conversation = await prisma.whatsappConversation.findUnique({
            where: { id }
        });

        if (!conversation) {
            return res.status(404).json({ message: 'Conversación no encontrada' });
        }

        const result = await whatsappService.sendMessage(
            conversation.customerPhone!,
            message,
            conversation.id
        );

        // Update sentBy if user is authenticated
        if (userId && result.messages?.[0]?.id) {
            await prisma.whatsappMessage.updateMany({
                where: { messageId: result.messages[0].id },
                data: { sentBy: userId }
            });
        }

        res.json(successResponse(result, 'Mensaje enviado'));
    } catch (error: any) {
        console.error('Error sending message:', error);
        res.status(500).json({
            message: 'Error al enviar mensaje',
            error: error.message
        });
    }
};

/**
 * Mark conversation as read
 * POST /api/whatsapp/conversations/:id/read
 */
export const markAsRead = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        await whatsappService.markConversationAsRead(id);

        res.json(successResponse(null, 'Conversación marcada como leída'));
    } catch (error: any) {
        console.error('Error marking as read:', error);
        res.status(500).json({
            message: 'Error al marcar como leída',
            error: error.message
        });
    }
};

/**
 * Close conversation
 * POST /api/whatsapp/conversations/:id/close
 */
export const closeConversation = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        await whatsappService.closeConversation(id);

        res.json(successResponse(null, 'Conversación cerrada'));
    } catch (error: any) {
        console.error('Error closing conversation:', error);
        res.status(500).json({
            message: 'Error al cerrar conversación',
            error: error.message
        });
    }
};

/**
 * Get WhatsApp configuration
 * GET /api/whatsapp/config
 */
export const getConfig = async (_req: Request, res: Response) => {
    try {
        const config = await prisma.whatsapp_config.findFirst({
            where: { isActive: true }
        });

        if (!config) {
            return res.status(404).json({
                message: 'Configuración no encontrada',
                configured: false
            });
        }

        // Don't send sensitive data to frontend
        const safeConfig = {
            id: config.id,
            phoneNumberId: config.phoneNumberId,
            businessAccountId: config.businessAccountId,
            webhookUrl: config.webhookUrl,
            apiVersion: config.apiVersion,
            isActive: config.isActive,
            autoRespond: config.autoRespond,
            businessHoursStart: config.businessHoursStart,
            businessHoursEnd: config.businessHoursEnd,
            configured: true
        };

        res.json(successResponse(safeConfig, 'Configuración obtenida'));
    } catch (error: any) {
        console.error('Error fetching config:', error);
        res.status(500).json({
            message: 'Error al obtener configuración',
            error: error.message
        });
    }
};

/**
 * Create or update WhatsApp configuration
 * POST /api/whatsapp/config
 */
export const saveConfig = async (req: Request, res: Response) => {
    try {
        const {
            phoneNumberId,
            businessAccountId,
            accessToken,
            verifyToken,
            webhookUrl,
            apiVersion,
            autoRespond,
            businessHoursStart,
            businessHoursEnd
        } = req.body;

        if (!phoneNumberId || !businessAccountId || !accessToken || !verifyToken) {
            return res.status(400).json({
                message: 'Campos requeridos: phoneNumberId, businessAccountId, accessToken, verifyToken'
            });
        }

        // Disable all other configs
        await prisma.whatsapp_config.updateMany({
            data: { isActive: false }
        });

        // Create or update config
        const config = await prisma.whatsapp_config.create({
            data: {
                phoneNumberId,
                businessAccountId,
                accessToken,
                verifyToken,
                webhookUrl,
                apiVersion: apiVersion || 'v21.0',
                autoRespond: autoRespond !== undefined ? autoRespond : true,
                businessHoursStart,
                businessHoursEnd,
                isActive: true
            }
        });

        // Test connection
        try {
            const connectionOk = await whatsappService.testConnection();
            if (!connectionOk) {
                return res.status(400).json({
                    message: 'Configuración guardada pero no se pudo conectar a WhatsApp API. Verifica tus credenciales.'
                });
            }
        } catch (error) {
            return res.status(400).json({
                message: 'Configuración guardada pero no se pudo verificar la conexión'
            });
        }

        res.json(successResponse(
            { id: config.id, configured: true },
            'Configuración guardada exitosamente'
        ));
    } catch (error: any) {
        console.error('Error saving config:', error);
        res.status(500).json({
            message: 'Error al guardar configuración',
            error: error.message
        });
    }
};

/**
 * Test WhatsApp connection
 * GET /api/whatsapp/test-connection
 */
export const testConnection = async (_req: Request, res: Response) => {
    try {
        const isConnected = await whatsappService.testConnection();

        if (isConnected) {
            res.json(successResponse({ connected: true }, 'Conexión exitosa'));
        } else {
            res.status(400).json({
                message: 'No se pudo conectar a WhatsApp API',
                connected: false
            });
        }
    } catch (error: any) {
        console.error('Error testing connection:', error);
        res.status(500).json({
            message: 'Error al probar conexión',
            error: error.message,
            connected: false
        });
    }
};

/**
 * Get templates
 * GET /api/whatsapp/templates
 */
export const getTemplates = async (_req: Request, res: Response) => {
    try {
        const templates = await prisma.whatsapp_templates.findMany({
            orderBy: { createdAt: 'desc' }
        });

        res.json(successResponse(templates, 'Templates obtenidos'));
    } catch (error: any) {
        console.error('Error fetching templates:', error);
        res.status(500).json({
            message: 'Error al obtener templates',
            error: error.message
        });
    }
};

/**
 * Create template
 * POST /api/whatsapp/templates
 */
export const createTemplate = async (req: Request, res: Response) => {
    try {
        const { name, category, content, variables } = req.body;

        if (!name || !category || !content) {
            return res.status(400).json({
                message: 'Nombre, categoría y contenido son requeridos'
            });
        }

        const template = await prisma.whatsapp_templates.create({
            data: {
                name,
                category,
                content,
                variables,
                status: 'PENDING'
            }
        });

        res.status(201).json(successResponse(template, 'Template creado'));
    } catch (error: any) {
        console.error('Error creating template:', error);
        res.status(500).json({
            message: 'Error al crear template',
            error: error.message
        });
    }
};

/**
 * Get conversation statistics
 * GET /api/whatsapp/stats
 */
export const getStats = async (_req: Request, res: Response) => {
    try {
        const [
            totalConversations,
            activeConversations,
            totalMessages,
            todayMessages,
            unreadCount
        ] = await Promise.all([
            prisma.whatsappConversation.count(),
            prisma.whatsappConversation.count({ where: { status: 'ACTIVE' } }),
            prisma.whatsappMessage.count(),
            prisma.whatsappMessage.count({
                where: {
                    createdAt: {
                        gte: new Date(new Date().setHours(0, 0, 0, 0))
                    }
                }
            }),
            prisma.whatsappMessage.count({
                where: {
                    direction: 'INBOUND',
                    status: { not: 'READ' }
                }
            })
        ]);

        const stats = {
            totalConversations,
            activeConversations,
            totalMessages,
            todayMessages,
            unreadCount
        };

        res.json(successResponse(stats, 'Estadísticas obtenidas'));
    } catch (error: any) {
        console.error('Error fetching stats:', error);
        res.status(500).json({
            message: 'Error al obtener estadísticas',
            error: error.message
        });
    }
};
