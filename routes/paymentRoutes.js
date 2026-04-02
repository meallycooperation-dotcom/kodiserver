import express from 'express'
import { initializePayment } from '../controllers/paymentController.js'

const router = express.Router()

// POST /api/payments/initialize
router.post('/initialize', initializePayment)

export default router