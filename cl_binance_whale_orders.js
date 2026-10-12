export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Endpoint ya kupata data kwenye Frontend
    if (url.pathname === '/json-data') {
      try {
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

          if (row.type === 'bid') bids.push(orderData);
          else asks.push(orderData);
        });

        asks.sort((a, b) => a.price - b.price);

        return new Response(JSON.stringify({
          status: "success",
          timestamp: new Date().toISOString(),
          bids_count: bids.length,
          asks_count: asks.length,
          bids: bids,
          asks: asks
        }), { headers: corsHeaders });

      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    // Amri ya kuamsha au kuangalia hali ya Durable Object
    let id = env.BINANCE_DO.idFromName("binance_singleton");
    let stub = env.BINANCE_DO.get(id);
    let res = await stub.fetch(request);
    let text = await res.text();

    return new Response(JSON.stringify({ message: "Worker inafanya kazi", status: text }), { headers: corsHeaders });
  },

  // Hii inafanya kazi kama Cron Trigger (ikiwa imewekwa kwenye wrangler.toml) kuamsha kazi kila mara
  async scheduled(event, env, ctx) {
    let id = env.BINANCE_DO.idFromName("binance_singleton");
    let stub = env.BINANCE_DO.get(id);
    await stub.fetch("https://internal/ping");
  }
};

// --- DURABLE OBJECT CLASS ---
export class BinanceDurableObject {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    // Hapa ndipo unaweza kuweka mantiki ya kuunganisha au kuomba data za Binance REST API kila ikiamka,
    // au kuendesha mchakato wa kuchuja kuta za fedha na kuzihifadhi kwenye env.DB
    
    return new Response("Durable Object imeamshwa na inafanya kazi!");
  }
}

function formatAmount(amount) {
    if (amount >= 1000000) return "$" + (amount / 1000000).toFixed(2).replace(/\.00$/, "").replace(/(\.[1-9])0$/, "$1") + "M";
    if (amount >= 1000) return "$" + Math.round(amount / 1000) + "K";
    return "$" + Math.round(amount);
}
