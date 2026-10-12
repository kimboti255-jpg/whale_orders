// Cloudflare Worker Script kwa ajili ya Binance Order Walls API

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Ruhusu CORS kwa ajili ya Dashboard yako ya front-end
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Endpoint ya kupata data za JSON (Badala ya Express /json-data)
    if (url.pathname === '/json-data') {
      try {
        // Hapa tunasoma data kutoka kwenye Cloudflare D1 Database (env.DB)
        // Hakikisha umeunda D1 database kwenye Cloudflare Dashboard yako na kuipa jina la DB
        const { results } = await env.DB.prepare(
          "SELECT * FROM order_walls ORDER BY price DESC"
        ).all();

        const now = Date.now();
        let bids = [];
        let asks = [];

        results.forEach(row => {
          let durationMinutes = Number(((now - row.first_seen) / (1000 * 60)).toFixed(1));

          let orderData = {
            id: row.id,
            type: row.type,
            price: row.price,
            amount: row.amount,
            value: row.value,
            value_formatted: formatAmount(row.value),
            duration_minutes: durationMinutes,
            first_seen_iso: new Date(row.first_seen).toISOString()
          };

          if (row.type === 'bid') {
            bids.push(orderData);
          } else {
            asks.push(orderData);
          }
        });

        // Kupanga asks kwa kupanda
        asks.sort((a, b) => a.price - b.price);

        const responseData = {
          status: "success",
          timestamp: new Date().toISOString(),
          bids_count: bids.length,
          asks_count: asks.length,
          bids: bids,
          asks: asks
        };

        return new Response(JSON.stringify(responseData), { headers: corsHeaders });

      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { 
          status: 500, 
          headers: corsHeaders 
        });
      }
    }

    return new Response(JSON.stringify({ message: "Binance Worker Inafanya Kazi Sawa!" }), { headers: corsHeaders });
  }
};

function formatAmount(amount) {
    if (amount >= 1000000) return "$" + (amount / 1000000).toFixed(2).replace(/\.00$/, "").replace(/(\.[1-9])0$/, "$1") + "M";
    if (amount >= 1000) return "$" + Math.round(amount / 1000) + "K";
    return "$" + Math.round(amount);
}
