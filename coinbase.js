const express = require('express');
const WebSocket = require('ws');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 7860;

// 1. Database ya SQLite ndani ya /tmp ili kuepusha hitilafu za ruhusa
const dbPath = path.join('/tmp', 'walls.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error("Hitilafu ya SQLite DB:", err.message);
    else console.log("SQLite Database imeunganishwa vizuri kwenye /tmp/walls.db.");
});

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS order_walls (
            id TEXT PRIMARY KEY,
            exchange TEXT,
            type TEXT,
            price REAL,
            amount REAL,
            value REAL,
            first_seen INTEGER,
            last_seen INTEGER
        )
    `);
});

// 2. Kuunganisha kupitia WebSocket (wss://)
const endpoint = "wss://coinbase.simotizi255.workers.dev";

function connectWebSocket() {
    console.log("Inajaribu kuunganisha kwenye Cloudflare Worker WebSocket...");
    const ws = new WebSocket(endpoint);

    ws.on('open', () => {
        console.log("🟢 Muunganisho wa WebSocket umefunguliwa kwa mafanikio!");
    });

    ws.on('message', (data) => {
        try {
            let jsonData = JSON.parse(data.toString());
            const now = Date.now();

            // Kuchakata masoko yaliyopo kwenye data za JSON
            for (let exchangeKey in jsonData) {
                if (typeof jsonData[exchangeKey] === 'object' && jsonData[exchangeKey] !== null) {
                    let marketData = jsonData[exchangeKey];
                    let bidsData = marketData.bids || [];
                    let asksData = marketData.asks || [];
                    let exchangeName = marketData.exchange || exchangeKey.toUpperCase();

                    function processOrders(orders, type) {
                        orders.forEach((order) => {
                            let bei = Number(order.price);
                            let kiasi = Number(order.amount);
                            let thamani = Number(order.value);
                            let elementId = order.id || `${exchangeName.toLowerCase()}-${type}-${bei}`;
                            let exName = order.exchange || exchangeName;

                            if (thamani >= 100000) {
                                db.run(`
                                    INSERT INTO order_walls (id, exchange, type, price, amount, value, first_seen, last_seen)
                                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                                    ON CONFLICT(id) DO UPDATE SET
                                        amount = excluded.amount,
                                        value = excluded.value,
                                        last_seen = excluded.last_seen
                                `, [elementId, exName, type, bei, kiasi, thamani, now, now]);
                            } else {
                                db.run(`DELETE FROM order_walls WHERE id = ?`, [elementId]);
                            }
                        });
                    }

                    processOrders(bidsData, "bid");
                    processOrders(asksData, "ask");
                }
            }
        } catch (error) {
            console.error("Hitilafu katika kuchakata ujumbe wa WebSocket:", error.message);
        }
    });

    ws.on('error', (error) => {
        console.error("Hitilafu ya WebSocket:", error.message);
    });

    ws.on('close', (code, reason) => {
        console.log(`🔴 WebSocket imefungwa (Msimbo: ${code}). Kujaribu tena baada ya sekunde 3...`);
        setTimeout(connectWebSocket, 3000); // Unganisha tena ikikatika
    });
}

// Anzisha muunganisho wa WebSocket
connectWebSocket();

function formatAmount(amount) {
    if (amount >= 1000000) return "$" + (amount / 1000000).toFixed(2).replace(/\.00$/, "").replace(/(\.[1-9])0$/, "$1") + "M";
    if (amount >= 1000) return "$" + Math.round(amount / 1000) + "K";
    return "$" + Math.round(amount);
}

// Ujumbe wa ukurasa wa mwanzo
app.get('/', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send('Server inafanya kazi vizuri! Nenda kwenye <a href="/json-data-two">/json-data-two</a> kuona taarifa za oda.');
});

// 3. API Endpoint /json-data-two
app.get('/json-data-two', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    const now = Date.now();

    db.all("SELECT * FROM order_walls ORDER BY price DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        let exchangesResult = {};

        rows.forEach(row => {
            let durationMinutes = Number(((now - row.first_seen) / (1000 * 60)).toFixed(1));
            let exKey = (row.exchange || "unknown").toLowerCase();

            if (!exchangesResult[exKey]) {
                exchangesResult[exKey] = {
                    bids_count: 0,
                    asks_count: 0,
                    bids: [],
                    asks: []
                };
            }

            let orderData = {
                id: row.id,
                exchange: row.exchange,
                type: row.type,
                price: row.price,
                amount: row.amount,
                value: row.value,
                value_formatted: formatAmount(row.value),
                duration_minutes: durationMinutes,
                first_seen_iso: new Date(row.first_seen).toISOString()
            };

            if (row.type === 'bid') {
                exchangesResult[exKey].bids.push(orderData);
                exchangesResult[exKey].bids_count++;
            } else {
                exchangesResult[exKey].asks.push(orderData);
                exchangesResult[exKey].asks_count++;
            }
        });

        for (let exKey in exchangesResult) {
            exchangesResult[exKey].asks.sort((a, b) => a.price - b.price);
            exchangesResult[exKey].bids.sort((a, b) => b.price - a.price);
        }

        res.json({
            status: "success",
            timestamp: new Date().toISOString(),
            ...exchangesResult
        });
    });
});

app.listen(PORT, () => console.log(`Server inakimbia kwenye port ${PORT}`));
