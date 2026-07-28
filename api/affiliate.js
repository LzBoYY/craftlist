import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {

  const { url, platform, title } = req.query;

  if (!url || !platform) {
    return res.status(400).send("Missing parameters");
  }

  const authHeader =
  req.headers.authorization ||
  (req.query.token
    ? `Bearer ${req.query.token}`
    : null);

  if (authHeader) {

    const token = authHeader.replace("Bearer ", "");

    const {
      data: { user }
    } = await supabase.auth.getUser(token);

    if (user) {

      await supabase
        .from("affiliate_clicks")
        .insert({
          user_id: user.id,
          platform,
          product_title: title || null
        });

    }

  }

  return res.redirect(url);

}
