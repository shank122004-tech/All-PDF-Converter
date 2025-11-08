const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const stripe = require('stripe')('sk_test_your_stripe_secret_key');
const Razorpay = require('https://rzp.io/rzp/ggY8XrZ');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: 'rzp_test_your_razorpay_key_id',
  key_secret: 'rzp_test_your_razorpay_key_secret'
});

// Stripe Checkout Session
app.post('/create-checkout-session', async (req, res) => {
  try {
    const { userId, email } = req.body;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'DocConvert Pro Premium',
              description: 'Monthly subscription for unlimited document conversions'
            },
            unit_amount: 500, // $5.00
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${req.headers.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/cancel`,
      customer_email: email,
      metadata: {
        userId: userId
      }
    });

    res.json({ id: session.id });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Stripe Webhook for payment confirmation
app.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, 'whsec_your_webhook_secret');
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata.userId;

    // Activate premium for user
    await activatePremium(userId);
  }

  res.json({received: true});
});

// Razorpay Payment Verification
app.post('/verify-razorpay-payment', async (req, res) => {
  try {
    const { paymentId, orderId, signature, userId } = req.body;

    // Verify payment signature
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', 'rzp_test_your_razorpay_key_secret')
      .update(orderId + '|' + paymentId)
      .digest('hex');

    if (expectedSignature === signature) {
      // Payment verified, activate premium
      await activatePremium(userId);
      res.json({ success: true });
    } else {
      res.status(400).json({ success: false, error: 'Invalid signature' });
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Activate Premium Function
async function activatePremium(userId) {
  try {
    const subscriptionEnd = new Date();
    subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1);

    await db.collection('users').doc(userId).update({
      isPremium: true,
      subscriptionEnd: subscriptionEnd.toISOString(),
      conversionsLimit: 9999
    });

    console.log(`Premium activated for user: ${userId}`);
  } catch (error) {
    console.error('Error activating premium:', error);
    throw error;
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});