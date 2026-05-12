import { Router } from 'express';
import * as whatsappController from '../controllers/whatsapp.controller';
import { protect, allowRoles } from '../../middlewares/auth.middleware';

const router = Router();

// ========================================
// WEBHOOK ROUTES (Public - No Auth)
// ========================================

// Webhook verification (GET) - Meta requires this for initial setup
router.get('/webhook', whatsappController.verifyWebhook);

// Webhook receiver (POST) - Receives messages and status updates from Meta
router.post('/webhook', whatsappController.receiveWebhook);

// ========================================
// ADMIN ROUTES (Authentication Required)
// ========================================

// Configuration
router.get(
    '/config',
    protect,
    allowRoles(['ADMIN']),
    whatsappController.getConfig
);

router.post(
    '/config',
    protect,
    allowRoles(['ADMIN']),
    whatsappController.saveConfig
);

router.get(
    '/test-connection',
    protect,
    allowRoles(['ADMIN']),
    whatsappController.testConnection
);

// Conversations
router.get(
    '/conversations',
    protect,
    allowRoles(['ADMIN', 'STAFF']),
    whatsappController.getConversations
);

router.get(
    '/conversations/:id',
    protect,
    allowRoles(['ADMIN', 'STAFF']),
    whatsappController.getConversationById
);

router.post(
    '/conversations/:id/send',
    protect,
    allowRoles(['ADMIN', 'STAFF']),
    whatsappController.sendMessageToConversation
);

router.post(
    '/conversations/:id/read',
    protect,
    allowRoles(['ADMIN', 'STAFF']),
    whatsappController.markAsRead
);

router.post(
    '/conversations/:id/close',
    protect,
    allowRoles(['ADMIN', 'STAFF']),
    whatsappController.closeConversation
);

// Order notifications
router.post(
    '/order/:orderId/notify',
    protect,
    allowRoles(['ADMIN', 'STAFF']),
    whatsappController.sendOrderNotification
);

router.post(
    '/order/:orderId/status',
    protect,
    allowRoles(['ADMIN', 'STAFF']),
    whatsappController.sendStatusUpdate
);

// Templates
router.get(
    '/templates',
    protect,
    allowRoles(['ADMIN']),
    whatsappController.getTemplates
);

router.post(
    '/templates',
    protect,
    allowRoles(['ADMIN']),
    whatsappController.createTemplate
);

// Statistics
router.get(
    '/stats',
    protect,
    allowRoles(['ADMIN', 'STAFF']),
    whatsappController.getStats
);

// Test message (for development/testing)
router.post(
    '/test',
    protect,
    allowRoles(['ADMIN']),
    whatsappController.sendTestMessage
);

export default router;
