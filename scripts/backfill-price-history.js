const path = require("path");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");

dotenv.config({
  path: path.join(process.cwd(), ".env.local"),
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function runBackfill() {
  const { data: offers, error: offersError } = await supabase
    .from("offers")
    .select("id, price, shipping_cost, last_checked_at")
    .order("id");

  if (offersError) {
    throw offersError;
  }

  console.log(`Found ${offers.length} offer(s).`);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const offer of offers) {
    try {
      const { data: existingHistory, error: historyCheckError } =
        await supabase
          .from("price_history")
          .select("id")
          .eq("offer_id", offer.id)
          .limit(1);

      if (historyCheckError) {
        throw historyCheckError;
      }

      if (existingHistory && existingHistory.length > 0) {
        skipped += 1;
        continue;
      }

      const price = Number(offer.price || 0);
      const shippingCost = Number(offer.shipping_cost || 0);

      const { error: insertError } = await supabase
        .from("price_history")
        .insert({
          offer_id: offer.id,
          price,
          shipping_cost: shippingCost,
          total_price: price + shippingCost,
          checked_at: offer.last_checked_at || new Date().toISOString(),
        });

      if (insertError) {
        throw insertError;
      }

      created += 1;
      console.log(`Created history for offer ${offer.id}`);
    } catch (error) {
      failed += 1;
      console.error(
        `Offer ${offer.id} failed:`,
        error?.message || error
      );
    }
  }

  console.log("");
  console.log("Backfill finished.");
  console.log(`Created: ${created}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

runBackfill().catch((error) => {
  console.error("Backfill failed:", error?.message || error);
  process.exit(1);
});