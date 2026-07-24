import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY
);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {

    const {
      userId
    } = req.body;


    const { data: profile } =
      await supabase
        .from("profiles")
        .select("stripe_subscription_id")
        .eq("id", userId)
        .single();


    if (!profile?.stripe_subscription_id) {

      return res.status(400).json({
        error: "No active subscription found"
      });

    }


    const subscription =
      await stripe.subscriptions.update(
        profile.stripe_subscription_id,
        {
          cancel_at_period_end: true
        }
      );


    return res.status(200).json({

      success: true,

      cancelDate:
        new Date(
          subscription.current_period_end * 1000
        ).toISOString()

    });


  } catch (error) {

    console.error(error);

    return res.status(500).json({
      error: error.message
    });

  }

}
