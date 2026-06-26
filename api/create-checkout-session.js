import Stripe from "stripe";

const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY
);

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {

    const { packageType } = req.body;

    let priceId;

    switch (packageType) {

      case "starter":
        priceId = process.env.STRIPE_PRICE_STARTER;
        break;

      case "popular":
        priceId = process.env.STRIPE_PRICE_POPULAR;
        break;

      case "best":
        priceId = process.env.STRIPE_PRICE_BEST;
        break;

      case "power":
        priceId = process.env.STRIPE_PRICE_POWER;
        break;

      case "pro":
        priceId = process.env.STRIPE_PRICE_PRO;
        break;

      default:
        return res.status(400).json({
          error: "Invalid package"
        });

    }

    const session = await stripe.checkout.sessions.create({

      mode:
        packageType === "pro"
          ? "subscription"
          : "payment",

      automatic_payment_methods: {
  enabled: true
},

      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],

      success_url:
        `${req.headers.origin}/shop.html?success=true`,

      cancel_url:
        `${req.headers.origin}/shop.html?cancelled=true`

    });

    return res.status(200).json({
      url: session.url
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      error: "Stripe session creation failed"
    });

  }

}
