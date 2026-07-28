import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {

  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      error: "Missing auth token"
    });
  }

  const token = authHeader.replace("Bearer ", "");

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return res.status(401).json({
      error: "Invalid user"
    });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return res.status(403).json({
      error: "Access denied"
    });
  }

  const { count: totalUsers } = await supabase
    .from("profiles")
    .select("*", {
      count: "exact",
      head: true
    });

  const { count: proUsers } = await supabase
    .from("profiles")
    .select("*", {
      count: "exact",
      head: true
    })
    .eq("pro", true);

  const { count: listings } = await supabase
    .from("generations")
    .select("*", {
      count: "exact",
      head: true
    });

  const { data: credits } = await supabase
    .from("profiles")
    .select("credits");

 const totalCredits = credits.reduce(
    (sum, user) => sum + (user.credits || 0),
    0
  );

  const { count: affiliateClicks } = await supabase
    .from("affiliate_clicks")
    .select("*", {
      count: "exact",
      head: true
    });

  return res.status(200).json({
    totalUsers,
    proUsers,
    listings,
    totalCredits,
    affiliateClicks
  });

}
