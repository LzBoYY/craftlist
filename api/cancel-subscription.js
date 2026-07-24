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
      error:"Method not allowed"
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

      throw new Error(
        "No subscription found"
      );

    }


    const subscription =
      await stripe.subscriptions.update(
        profile.stripe_subscription_id,
        {
          cancel_at_period_end:true
        }
      );


    await supabase
      .from("profiles")
      .update({

        subscription_status:
          "cancelling"

      })
      .eq("id", userId);



    return res.status(200).json({

      success:true,

      endDate:
        subscription.current_period_end

    });


  } catch(err) {


    console.error(err);


    return res.status(500).json({

      error:err.message

    });


  }

}
