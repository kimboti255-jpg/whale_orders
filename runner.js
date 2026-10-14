const https = require('https');

// Weka URL halisi ya Cloudflare Worker yako hapa chini
const WORKER_URL = 'https://coinbase.simotizi255.workers.dev'; 

function executeCloudflareWorker() {
    https.get(WORKER_URL, (res) => {
        let body = '';

        res.on('data', (chunk) => {
            body += chunk;
        });

        res.on('end', () => {
            const timestamp = new Date().toLocaleTimeString();
            if (res.statusCode === 200) {
                console.log(`[${timestamp}] Cloudflare Worker imekimbizwa kwa mafanikio.`);
            } else {
                console.error(`[${timestamp}] Hitilafu: HTTP Status ${res.statusCode}`);
            }
        });
    }).on('error', (error) => {
        console.error(`[${new Date().toLocaleTimeString()}] Ombi limeshindwa:`, error.message);
    });
}

console.log("Kuanzisha Cloudflare Worker Runner kwenye HostKB Cloud (Kila sekunde 1)...");

// 1. Kimbiza mara moja wakati wa kuanza
executeCloudflareWorker();

// 2. Kimbiza kila baada ya sekunde 1 (1000ms)
setInterval(executeCloudflareWorker, 1000);
