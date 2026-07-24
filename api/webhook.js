import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PACKAGES = {
  starter: 100,
  popular: 300,
  best: 650,
  power: 1500
};

function getRawBody(req) {
  return new Promise((resolve, reject) => {

    const chunks = [];

    req.on("data", chunk => chunks.push(chunk));

    req.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    req.on("error", reject);

  });
}

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  let event;

  try {

    const rawBody = await getRawBody(req);

    event = stripe.webhooks.constructEvent(
      rawBody,
      req.headers["stripe-signature"],
      process.env.STRIPE_WEBHOOK_SECRET
    );

  } catch (err) {

    console.error("Signature verification failed");
    console.error(err);

    return res.status(400).send(
      `Webhook Error: ${err.message}`
    );

  }

  console.log(
    "Stripe Event:",
    event.type
  );

  try {

    const { data: existingEvent } =
      await supabase
        .from("stripe_events")
        .select("id")
        .eq("id", event.id)
        .single();

    if (existingEvent) {

      console.log(
        "Duplicate event ignored:",
        event.id
      );

      return res.status(200).json({
        received: true
      });

    }

    if (
      event.type ===
      "checkout.session.completed"
    ) {

      const session =
        event.data.object;

    const {
  userId,
  email,
  packageType
} = session.metadata || {};

if (!userId || !packageType) {
  throw new Error("Missing checkout metadata");
}

      console.log(
        "Checkout:",
        packageType,
        userId
      );

      if (packageType === "pro") {

        const subscription =
          await stripe.subscriptions.retrieve(
            session.subscription
          );

        await supabase
  .from("profiles")
  .update({

    pro: true,

    stripe_customer_id:
      session.customer,

    stripe_subscription_id:
      session.subscription,

    subscription_status:
      subscription.status,

          subscription_end_date:
  subscription.items?.data?.[0]?.current_period_end
    ? new Date(
        subscription.items.data[0].current_period_end * 1000
      ).toISOString()
    : null

          })
          .eq("id", userId);

        console.log(
          "Pro subscription stored."
        );

      }

      else if (
        PACKAGES[packageType]
      ) {

        const credits =
          PACKAGES[packageType];

        const { data: profile } =
          await supabase
            .from("profiles")
            .select("credits")
            .eq("id", userId)
            .single();

        if (!profile) {
  throw new Error("Profile not found");
}
        
        await supabase
          .from("profiles")
          .update({

            credits:
              profile.credits + credits

          })
          .eq("id", userId);

        console.log(
          `Added ${credits} credits`
        );

      }

    }

    if (
      event.type ===
      "invoice.paid"
    ) {

      const invoice =
        event.data.object;
      if (
  invoice.billing_reason !== "subscription_create" &&
  invoice.billing_reason !== "subscription_cycle"
) {
  return res.status(200).json({
    received: true
  });
}

      if (!invoice.subscription) {

        await supabase
          .from("stripe_events")
          .insert({
            id: event.id
          });

        return res.status(200).json({
          received: true
        });

      }

      const subscription =
        await stripe.subscriptions.retrieve(
          invoice.subscription
        );

      const {
        userId
      } = subscription.metadata;

      if (!userId) {

        console.log(
          "No userId on subscription metadata."
        );

        await supabase
          .from("stripe_events")
          .insert({
            id: event.id
          });

        return res.status(200).json({
          received: true
        });

      }

      const { data: profile } =
        await supabase
          .from("profiles")
          .select("credits")
          .eq("id", userId)
          .single();
if (!profile) {
  throw new Error("Profile not found");
}
      await supabase
        .from("profiles")
        .update({

          credits:
            profile.credits + 1000,

          pro: true,

          subscription_status:
            subscription.status,

          subscription_end_date:
  subscription.current_period_end
    ? new Date(
        subscription.current_period_end * 1000
      ).toISOString()
    : null

        })
        .eq("id", userId);

      console.log(
        "Monthly Pro credits added."
      );

        }

    if (
      event.type ===
      "customer.subscription.updated"
    ) {

      const subscription =
        event.data.object;

      const { data: profile } =
        await supabase
          .from("profiles")
          .select("id")
          .eq(
            "stripe_subscription_id",
            subscription.id
          )
          .single();

      if (profile) {

        await supabase
          .from("profiles")
          .update({

            subscription_status:
              subscription.cancel_at_period_end
                ? "cancelling"
                : subscription.status,

            subscription_end_date:
  subscription.current_period_end
    ? new Date(
        subscription.current_period_end * 1000
      ).toISOString()
    : null

          })
          .eq(
            "id",
            profile.id
          );

        console.log(
          "Subscription updated."
        );

      }

    }

    if (
      event.type ===
      "customer.subscription.deleted"
    ) {

      const subscription =
        event.data.object;

      const { data: profile } =
        await supabase
          .from("profiles")
          .select("id")
          .eq(
            "stripe_subscription_id",
            subscription.id
          )
          .single();

      if (profile) {

        await supabase
          .from("profiles")
          .update({

            pro: false,

            subscription_status:
              "cancelled",

            subscription_end_date:
              new Date().toISOString()

          })
          .eq(
            "id",
            profile.id
          );

        console.log(
          "Subscription cancelled."
        );

      }

    }

    await supabase
      .from("stripe_events")
      .insert({
        id: event.id
      });

    return res.status(200).json({
      received: true
    });

  } catch (err) {

    console.error(
      "Webhook processing failed"
    );

    console.error(err);

    return res.status(500).json({
      error: err.message
    });

  }

}
