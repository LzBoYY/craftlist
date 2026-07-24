

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const config = {
  api: {
    bodyParser: false,
  },
};

const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY
);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);


const creditPackages = {
  starter: 100,
  popular: 300,
  best: 650,
  power: 1500
};


export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }


  const signature =
    req.headers["stripe-signature"];


  let event;


  try {

   const rawBody = await getRawBody(req);

event = stripe.webhooks.constructEvent(
  rawBody,
  signature,
  process.env.STRIPE_WEBHOOK_SECRET
);

  } catch (error) {

    console.error(
      "Webhook signature verification failed:",
      error.message
    );

    return res.status(400).send(
      `Webhook Error: ${error.message}`
    );

  }


  console.log(
    "Stripe event:",
    event.type
  );


  // Prevent duplicate processing

  const { data: existingEvent } =
    await supabase
      .from("stripe_events")
      .select("id")
      .eq("id", event.id)
      .single();


  if (existingEvent) {

    console.log(
      "Event already processed:",
      event.id
    );

    return res.status(200).json({
      received: true
    });

  }


  try {


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
      } = session.metadata;
if (packageType === "pro") {

  await supabase
    .from("profiles")
    .update({
      pro: true,
      stripe_customer_id: session.customer,
      stripe_subscription_id: session.subscription,
      subscription_status: "active"
    })
    .eq("id", userId);


  console.log(
    "Pro subscription activated"
  );

}

      console.log(
        "Checkout completed:",
        packageType,
        userId
      );


      // Ignore Pro here.
      // Pro credits are handled by invoice.paid

      if (
        packageType !== "pro"
        &&
        creditPackages[packageType]
      ) {


        const credits =
          creditPackages[packageType];


        const { data: profile, error } =
          await supabase
            .from("profiles")
            .select("credits")
            .eq("id", userId)
            .single();


        if (error) {
          throw error;
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


      const subscriptionId =
        invoice.subscription;


      if (!subscriptionId) {

        return res.status(200).json({
          received: true
        });

      }


      const subscription =
        await stripe.subscriptions.retrieve(
          subscriptionId
        );
  console.log("=== invoice.paid ===");
console.log("Subscription ID:", subscription.id);
console.log("Customer ID:", subscription.customer);
console.log("Metadata:", subscription.metadata);
console.log("User ID:", subscription.metadata.userId);

      const userId =
        subscription.metadata.userId;


      if (!userId) {

        console.log(
          "No userId on subscription"
        );

        return res.status(200).json({
          received: true
        });

      }



      const { data: profile, error } =
        await supabase
          .from("profiles")
          .select("credits")
          .eq("id", userId)
          .single();
  console.log("Profile:", profile);
console.log("Profile error:", error);

      if (error) {
        throw error;
      }



      const updateResult =
  await supabase
    .from("profiles")
    .update({
      credits: profile.credits + 1000,
      pro: true
    })
    .eq("id", userId);

console.log("Update result:", updateResult);



      console.log(
        "Added monthly Pro credits"
      );

    }



    await supabase
      .from("stripe_events")
      .insert({
        id: event.id
      });



    return res.status(200).json({
      received: true
    });



  } catch (error) {


    console.error(
      "Webhook processing error:",
      error
    );


    return res.status(500).json({
      error: "Webhook processing failed"
    });

  }
  function getRawBody(req) {

  return new Promise((resolve, reject) => {

    const chunks = [];

    req.on("data", chunk => {
      chunks.push(chunk);
    });

    req.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    req.on("error", reject);

  });

}

}
