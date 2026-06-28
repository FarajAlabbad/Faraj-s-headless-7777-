(async () => {
    const { fork } = await import("child_process");
    const { WebSocketServer } = await import("ws");
    const { pack, unpack } = await import("msgpackr");
    const http = await import("http");
    const fs = await import("fs");
    const path = await import("path");


    const fallbackProxies = []; // Cleared expired white proxy
    const useProxyList = true;  // Enabled loading from your text file

    // Automatically check for both plural and singular filenames
    let proxyPoolPath = path.join(process.cwd(), "proxies.txt");
    if (!fs.existsSync(proxyPoolPath)) {
        proxyPoolPath = path.join(process.cwd(), "proxy.txt");
    }

    function toProxyUrl(line, lineNum) {
        line = line.trim();
        if (!line || line.startsWith("#")) return null;

        // 1. If it already specifies a protocol, use it directly
        if (line.includes("://")) {
            return line;
        }

        // 2. Handle standard user:pass@host:port formats
        if (line.includes("@")) {
            return `http://${line}`;
        }

        const parts = line.split(":");
        
        // 3. Simple host:port
        if (parts.length === 2) {
            const [host, port] = parts;
            return `http://${host}:${port}`;
        }

        // 4. Handle 4-part configurations (host:port:user:pass or user:pass:host:port)
        if (parts.length === 4) {
            const [p0, p1, p2, p3] = parts;
            // Simple check to identify which part is the port
            const isP1Port = /^\d+$/.test(p1) && p1.length <= 5;
            const isP3Port = /^\d+$/.test(p3) && p3.length <= 5;

            if (isP1Port) {
                // host:port:username:password
                return `http://${encodeURIComponent(p2)}:${encodeURIComponent(p3)}@${p0}:${p1}`;
            } else if (isP3Port) {
                // username:password:host:port
                return `http://${encodeURIComponent(p0)}:${encodeURIComponent(p1)}@${p2}:${p3}`;
            }
        }

        // Output formatting warning to help you troubleshoot your file
        console.warn(`[Proxy Warning] Line ${lineNum} skipped due to unrecognized format: "${line.slice(0, 35)}"`);
        return null;
    }

    let proxyPool = [];
    if (useProxyList) {
        try {
            if (fs.existsSync(proxyPoolPath)) {
                let rawPool = fs.readFileSync(proxyPoolPath, "utf8");
                
                // Strip UTF-8 Byte Order Mark (BOM) if present from Windows Notepad
                if (rawPool.charCodeAt(0) === 0xFEFF) {
                    rawPool = rawPool.slice(1);
                }

                const lines = rawPool.split(/\r?\n/);
                proxyPool = lines
                    .map((line, idx) => toProxyUrl(line, idx + 1))
                    .filter(Boolean);
                
                console.log(`Loaded ${proxyPool.length} valid proxies from: ${path.basename(proxyPoolPath)}`);
            } else {
                console.warn("Neither proxies.txt nor proxy.txt exists in the current working directory.");
            }
        } catch (err) {
            console.error("Failed to read proxy file:", err);
        }
    }

    function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    const PROXIES = shuffle([...(useProxyList ? proxyPool : []), ...fallbackProxies]);
    const prod = false;

    // HTTP SERVER
    const server = http.createServer((req, res) => {
        res.writeHead(426, {"Content-Type": "text/plain"});
        res.end("lll elk ez big fat noob");
    });


    // WS SERVER
    function randint(a, b) {
        return Math.floor(Math.random() * (b - a + 1)) + a;
    }

    const wss = new WebSocketServer({ server });

    wss.on("connection", (ws, req) => {
        const addr = req.socket.remoteAddress
        console.log(addr, "connected");

        let workers = [];
        let challenge;
        let verified = false;

        let tank = "Auto-6";
        let tanks = [];
        let tankIdx = 0;

        let proxyIdx = randint(0, Math.max(0, PROXIES.length - 1));


        function packet(...args) {
            if (ws.readyState === 1) { // WebSocket.OPEN
                ws.send(pack(args));
            }
        }

        function close() {
            ws.close();
            for (const worker of workers) {
                worker.send({ type: "destroy" });
            }
        }

        ws.on("message", (msg) => {
            try {
                const data = unpack(msg);
                const type = data.shift();

                switch (type) {
                    case "M":
                        if (challenge || data[0] != 72011) {
                            close();
                        }

                        challenge = randint(0b1000000000, 0b1111111111);
                        packet("M", challenge);
                        break;

                    case "C":
                        if (data[0] == (challenge ^ 845)) {
                            verified = true;
                            console.log(addr, "verified");
                        } else {
                            close();
                            console.log(addr, "true noob")
                        }

                        break;

                    case "Z":
                        tank = data[0];
                        if (tank instanceof Array) {
                            tanks = tank;
                            tankIdx = 0;

                            for (const worker of workers) {
                                tank = tanks[tankIdx];
                                worker.send({ type: "tankselect", tank });

                                tankIdx++;
                                if (tankIdx >= tanks.length) {
                                    tankIdx = 0;
                                }
                            }
                        } else {
                            tanks = [];
                            for (const worker of workers) {
                                worker.send({ type: "tankselect", tank })
                            }
                        }

                        break;

                    case "F":
                        if (verified) {
                            if (!PROXIES.length) {
                                console.error("No proxies configured. Connection request skipped.");
                                break;
                            }

                            if (proxyIdx >= PROXIES.length) {
                                proxyIdx = 0;
                            }
                            console.log("connecting with proxy", PROXIES[proxyIdx])

                            // Fallback path resolution for worker script
                            const workerFile = fs.existsSync(path.join(process.cwd(), "index.js")) ? "index.js" : "input_file_1.js";
                            const worker = fork(workerFile, []);
                            workers.push(worker);

                            // --- IPC LISTENERS FOR UNIVERSAL FUSION ---
                            worker.on("message", (m) => {
                                if (m.type === "bot_coords") {
                                    packet("P", worker.pid, m.x, m.y);
                                } else if (m.type === "bot_kill") {
                                    packet("K", m.text);
                                } else if (m.type === "bot_spawned") {
                                    packet("S", workers.length);
                                } else if (m.type === "bot_died") {
                                    packet("D", workers.length);
                                }
                            });

                            worker.on("exit", () => {
                                workers = workers.filter(w => w !== worker);
                                packet("D", workers.length); // Update count on disconnect
                            });

                            if (tanks.length) {
                                worker.send({ type: "tankselect", tank: tanks[tankIdx] });
                                tankIdx++;
                                if (tankIdx >= tanks.length) {
                                    tankIdx = 0;
                                }
                            } else {
                                worker.send({ type: "tankselect", tank });
                            }

                            const botName = data[1] || "Faraj"; // Accept dynamic name from client
                            const proxyUrl = PROXIES[proxyIdx];
                            const isSocks = proxyUrl && proxyUrl.startsWith("socks");

                            worker.send({ type: "start", config: {
                                id: worker.pid,
                                proxy: {
                                    type: isSocks ? "socks" : "http",
                                    url: proxyUrl
                                },
                                hash: "#" + data[0],
                                name: botName,
                                stats: [2,2,4,9,3,9,9,0,0,0],
                                type: "follow",
                                token: "follow-8fe6ca",
                                autoFire: false,
                                autoRespawn: true,
                                keys: [],
                                keysHold: [],
                                tank: "Auto4",
                                chatSpam: "",
                                squadId: data[0],
                                reconnectAttempts: 3,
                                reconnectDelay: 15000,
                            }});

                            proxyIdx++;
                        }

                        break;

                    case "B":
                        if (verified) {
                            for (const worker of workers) {
                                worker.send({ type: "destroy" });
                            }
                            workers = [];
                            packet("D", 0); // Reset count to 0
                        }

                        break;

                    case "A":
                        if (verified) {
                            let idx = 0;
                            let size = workers.length;
                            for (const worker of workers) {
                                worker.send({
                                    type: "position",
                                    x: data[0],
                                    y: data[1],
                                    mouseX: data[2],
                                    mouseY: data[3],
                                    mouseDown: data[4],
                                    rMouseDown: data[5],
                                    mouse: data[6],
                                    feeding: data[7],
                                    shift: data[8],
                                    movementEnabled: data[9] !== false, // Default to true if undefined
                                    
                                    // Expanded sync parameters
                                    isAimReplication: data[10],
                                    isPreciseAim: data[11],
                                    isMouseFollowMode: data[12],
                                    followDistance: data[13],
                                    formationConfig: data[14],
                                    screenWidth: data[15],
                                    screenHeight: data[16],
                                    fov: data[17],
                                    preciseMovement: data[18],
                                    
                                    swarmIndex: idx,
                                    swarmSize: size
                                });
                                idx++;
                            }
                        }
                        break;

                    // --- GLOBAL CHAT MIRROR ---
                    case "T":
                        if (verified) {
                            for (const worker of workers) {
                                worker.send({ type: "chat", msg: data[0] });
                            }
                        }
                        break;

                    // --- KEY REPLICATION ---
                    case "J":
                        if (verified) {
                            for (const worker of workers) {
                                worker.send({ type: "key_states", keys: data[0] });
                            }
                        }
                        break;

                    default:
                        close();
                        break;
                }
            } catch (e) {
                console.error(e);
            }
        });

        ws.on("close", () => {
            for (const worker of workers) {
                worker.send({ type: "destroy" });
            }
            workers = [];
            console.log(addr, "disconnected");
        });
    });


    const port = prod ? process.env.PORT : 8082;
    server.listen(port, () => {
        console.log("Server listening on port", port);
    });
})();
