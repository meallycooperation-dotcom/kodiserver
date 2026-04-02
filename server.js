import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import subscriptionRoutes from './routes/subscriptionRoutes.js'
import paymentRoutes from './routes/paymentRoutes.js' // ✅ ADD THIS
import { handlePaystackWebhook } from './controllers/subscriptionController.js'

dotenv.config()

const app = express()

// ✅ Enable CORS
app.use(
  cors({
    origin: [
      'http://localhost:3000', // React dev
      'http://localhost:5173', // Vite dev
      'https://kodi-iota.vercel.app' // production
    ],
    credentials: true
  })
)

// ⚠️ IMPORTANT: Paystack webhook (RAW body, must come BEFORE express.json)
app.post(
  '/api/subscriptions/webhook/paystack',
  express.raw({ type: 'application/json' }),
  handlePaystackWebhook
)

// ✅ Normal JSON middleware (for all other routes)
app.use(express.json())

// ✅ Routes
app.use('/api/subscriptions', subscriptionRoutes)
app.use('/api/payments', paymentRoutes) // ✅ THIS FIXES YOUR 404

// ✅ Health check
app.get('/', (req, res) => {
  res.send('Kodi Subscription Server Running 🚀')
})

// ✅ Start server
const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})