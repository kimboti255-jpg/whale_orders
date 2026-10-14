const express = require('express');
const WebSocket = require('ws');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 7860;

// 1. Database ya SQLite ndani ya /tmp ili kuepusha kabisa hitilafu ya ruhusa za hifadhidata
const dbPath = path.join('/tmp', 'walls.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error("Hitilafu ya SQLite DB:", err.message);
    else console.log("SQLite Database imeunganishwa vizuri kwenye /tmp/walls.db.");
});

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS order_walls (
            id TEXT PRIMARY KEY,
            type TEXT,
            price REAL,
            amount REAL,
            value REAL,
            first_seen INTEGER,
            last_seen INTEGER
        )
    `);
});

// 2. Kuunganisha Binance WebSocket
const endpoint = "wss://fstream.binance.com/ws/dogeusdt@depth@100ms";
let ws;

function connectWebSocket() {
    ws = new WebSocket(endpoint);

    ws.on('open', () => {
        console.log("Muunganisho wa Binance WebSocket umefanikiwa!");
    });

    ws.on('message', (data) => {
        try {
            let jsonData = JSON.parse(data);
            let bidsData = jsonData.b || [];
            let asksData = jsonData.a || [];

            const now = Date.now();

            function processOrders(orders, type) {
                orders.forEach((order) => {
                    let bei = Number(order[0]);
                    let kiasi = Number(order[1]);
                    let thamani = bei * kiasi;
                    let elementId = `${type}-${bei}`;

                    if (thamani >= 300000) {
                        db.run(`
                            INSERT INTO order_walls (id, type, price, amount, value, first_seen, last_seen)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                            ON CONFLICT(id) DO UPDATE SET
                                amount = excluded.amount,
                                value = excluded.value,
                                last_seen = excluded.last_seen
                        `, [elementId, type, bei, kiasi, thamani, now, now]);
                    } else {
                        db.run(`DELETE FROM order_walls WHERE id = ?`, [elementId]);
                    }
                });
            }

            processOrders(bidsData, "bid");
            processOrders(asksData, "ask");

        } catch (error) {
            console.error("Error processing message:", error.message);
        }
    });

    ws.on('error', (err) => console.error("WS Error:", err.message));
    ws.on('close', () => {
        console.log("WS Closed. Reconnecting...");
        setTimeout(connectWebSocket, 3000);
    });
}

connectWebSocket();

function formatAmount(amount) {
    if (amount >= 1000000) return "$" + (amount / 1000000).toFixed(2).replace(/\.00$/, "").replace(/(\.[1-9])0$/, "$1") + "M";
    if (amount >= 1000) return "$" + Math.round(amount / 1000) + "K";
    return "$" + Math.round(amount);
}

// Ujumbe wa ukurasa wa mwanzo ili kuondoa hitilafu ya Cannot GET /
app.get('/', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send('Server inafanya kazi vizuri! Nenda kwenye <a href="/json-data">/json-data</a> kuona taarifa za oda.');
});

// 3. API Endpoint /json-data
app.get('/json-data', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    const now = Date.now();

    db.all("SELECT * FROM order_walls ORDER BY price DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        let bids = [];
        let asks = [];

        rows.forEach(row => {
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

        res.json({
            status: "success",
            timestamp: new Date().toISOString(),
            bids_count: bids.length,
            asks_count: asks.length,
            bids: bids,
            asks: asks
        });
    });
});

app.listen(PORT, () => console.log(`Binance Server inakimbia kwenye port ${PORT}`));