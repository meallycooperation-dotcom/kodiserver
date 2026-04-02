import supabase from '../supabaseClient.js'
import { SUBSCRIPTION_PLANS } from './plans.js'
import crypto from 'crypto'

/**
 * ✅ Create / Activate Subscription (Manual / Testing / MPESA fallback)
 */
export const createSubscription = async (req, res) => {
  try {
    const { user_id, payment_reference, plan } = req.body

    if (!user_id || !payment_reference || !plan) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Get plan details
    const selectedPlan = SUBSCRIPTION_PLANS[plan.toLowerCase()]
    if (!selectedPlan) return res.status(400).json({ error: 'Invalid plan' })

    const { name, price, max_apartments, max_airbnbs, max_rentals } = selectedPlan

    // Prevent duplicate processing
    const { data: existing } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('payment_reference', payment_reference)
      .single()

    if (existing) return res.json({ success: true, message: 'Already processed' })

    // Check for active subscription
    const { data: activeSub } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user_id)
      .eq('status', 'active')
      .gt('ends_at', new Date().toISOString())
      .single()

    let endsAt = new Date()
    if (activeSub) endsAt = new Date(activeSub.ends_at)

    endsAt.setMonth(endsAt.getMonth() + 1)

    // Insert subscription
    const { data, error } = await supabase
      .from('subscriptions')
      .insert([
        {
          user_id,
          plan_name: name,
          max_apartments,
          max_airbnbs,
          max_rentals,
          amount_paid: price,
          payment_reference,
          payment_method: 'paystack',
          status: 'active',
          ends_at: endsAt.toISOString(),
          last_payment_at: new Date().toISOString()
        }
      ])
      .select()

    if (error) throw error

    res.json({ success: true, data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

/**
 * ✅ Check if user has active subscription
 */
export const checkSubscription = async (req, res) => {
  try {
    const { user_id } = req.params

    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user_id)
      .eq('status', 'active')
      .gt('ends_at', new Date().toISOString())
      .maybeSingle()

    if (error) throw error

    res.json({ active: !!data, subscription: data || null })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

/**
 * 🔥 Paystack Webhook Handler (MAIN LOGIC)
 */
export const handlePaystackWebhook = async (req, res) => {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY

    // ⚠️ raw body required
    const hash = crypto
      .createHmac('sha512', secret)
      .update(req.body) // raw buffer
      .digest('hex')

    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(401).send('Invalid signature')
    }

    const event = JSON.parse(req.body.toString())

    // ✅ Only handle successful payments
    if (event.event === 'charge.success') {
      const data = event.data
      const user_id = data.metadata?.user_id
      const reference = data.reference
      const amount = data.amount / 100
      const plan = data.metadata?.plan

      if (!user_id || !plan) {
        console.error('Missing user_id or plan in metadata')
        return res.sendStatus(200)
      }

      const selectedPlan = SUBSCRIPTION_PLANS[plan.toLowerCase()]
      const { name, max_apartments, max_airbnbs, max_rentals } = selectedPlan

      // ✅ Update the associated transaction to reflect success
      await supabase
        .from('transactions')
        .update({
          status: 'success',
          paid_at: new Date().toISOString()
        })
        .eq('payment_reference', reference)

      // 🚫 Prevent duplicate processing
      const { data: existing } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('payment_reference', reference)
        .single()

      if (existing) return res.sendStatus(200)

      // 🧠 Check active subscription
      const { data: activeSub } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user_id)
        .eq('status', 'active')
        .gt('ends_at', new Date().toISOString())
        .single()

      let endsAt = new Date()
      if (activeSub) endsAt = new Date(activeSub.ends_at)
      endsAt.setMonth(endsAt.getMonth() + 1)

      // 💾 Save subscription
      const { error } = await supabase
        .from('subscriptions')
        .insert([
          {
            user_id,
            plan_name: name,
            max_apartments,
            max_airbnbs,
            max_rentals,
            payment_reference: reference,
            payment_method: 'paystack',
            amount_paid: amount,
            status: 'active',
            ends_at: endsAt.toISOString(),
            last_payment_at: new Date().toISOString()
          }
        ])

      if (error) throw error
    }

    res.sendStatus(200)
  } catch (err) {
    console.error(err.message)
    res.sendStatus(500)
  }
}
