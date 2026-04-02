import axios from 'axios'
import supabase from '../supabaseClient.js'

export const initializePayment = async (req, res) => {
  try {
    const { email, amount, user_id, plan } = req.body

    // Generate or reuse a payment reference before calling Paystack
    const reference = req.body?.reference
      ? req.body.reference
      : `txn_${user_id}_${Date.now()}`

    if (!email || !amount || !user_id || !plan)
      return res.status(400).json({ error: 'Missing required fields' })

    // Create a pending transaction record to track this payment attempt (after validation)
    await supabase.from('transactions').insert([
      {
        user_id,
        payment_reference: reference,
        amount,
        plan,
        status: 'pending'
      }
    ])

    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email,
        amount: amount * 100, // Paystack expects amount in kobo
        metadata: {
          user_id,
          plan
        },
        callback_url: 'https://kodi-iota.vercel.app/payment/callback',
        // Attach the reference so Paystack and our DB stay in sync
        reference
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    )

    res.json({ authorization_url: response.data.data.authorization_url })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Payment initialization failed' })
  }
}
