import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabaseAdmin = createClient(
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

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: "Missing token"
      });
    }

    const token = authHeader.replace("Bearer ", "");

    const {
      data: { user },
      error
    } = await supabaseAdmin.auth.getUser(token);


    if (error || !user) {
      return res.status(401).json({
        error: "Invalid user"
      });
    }


    const userId = user.id;


    // Get Stripe subscription
    const { data: profile } =
      await supabaseAdmin
        .from("profiles")
        .select(
          "stripe_subscription_id, stripe_customer_id"
        )
        .eq("id", userId)
        .single();


    if (profile?.stripe_subscription_id) {

      await stripe.subscriptions.cancel(
        profile.stripe_subscription_id
      );

      console.log(
        "Stripe subscription cancelled"
      );

    }


    // Delete user data
    await supabaseAdmin
      .from("generations")
      .delete()
      .eq("user_id", userId);


    await supabaseAdmin
      .from("payments")
      .delete()
      .eq("user_id", userId);


    await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", userId);


    // Delete auth account
    await supabaseAdmin.auth.admin.deleteUser(
      userId
    );


    return res.status(200).json({
      success: true
    });


  } catch (err) {

    console.error(
      "Delete account error:",
      err
    );

    return res.status(500).json({
      error: err.message
    });

  }

}
