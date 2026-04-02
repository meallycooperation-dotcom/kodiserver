import express from 'express'
import { createSubscription, checkSubscription, handlePaystackWebhook } from '../controllers/subscriptionController.js'

const router = express.Router()

// Create subscription manually or via frontend call
router.post('/create', createSubscription)

// Check active subscription
router.get('/check/:user_id', checkSubscription)

// Paystack webhook
router.post('/webhook/paystack', express.raw({ type: 'application/json' }), handlePaystackWebhook)

export default router
