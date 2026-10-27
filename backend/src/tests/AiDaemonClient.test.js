const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { EventEmitter } = require('events');
const AiDaemonClient = require('../services/AiDaemonClient');
const { ServiceUnavailableError } = require('../errors/AppError');

jest.mock('../utils/logger');
jest.setTimeout(20000);

/** Python daemon yerine geçen sahte süreç */
class FakeProcess extends EventEmitter {
    constructor() {
        super();
        this.stdout = new EventEmitter();
        this.stderr = new EventEmitter();
        this.killed = false;
    }

    kill() {
        this.killed = true;
        setImmediate(() => this.emit('exit', null, 'SIGTERM'));
    }

    /** Daemon'un beklenmedik şekilde çökmesi */
    crash() {
        this.emit('exit', 1, null);
    }
}

const DAEMON_RESULT = {
    basarili: true,
    katman1_yaprak: { tespit_edildi: true, confidence: 0.9, bbox: [0, 0, 10, 10], toplam_tespit: 1, crop_base64: 'eA==' },
    katman2_bitki: { tur: 'tomato', confidence: 0.95, top3: [{ tur: 'tomato', confidence: 0.95 }] },
    katman3_hastalik: { durum: 'tespit_edildi', hastalik: 'Late Blight', saglikli: false, confidence: 0.97, top3: [] },
};

let server, port, modelDir, processes, client;

/** Sahte daemon HTTP sunucusu; `online` false iken bağlantıları reddeder (çökmüş daemon) */
const daemon = { online: true };

beforeAll(async () => {
    modelDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verdant-models-'));
    for (const name of ['yolo.pt', 'plant.keras', 'pipeline.py']) fs.writeFileSync(path.join(modelDir, name), 'x');
    fs.writeFileSync(path.join(modelDir, 'classes.txt'), 'apple\ntomato\n');

    server = http.createServer((req, res) => {
        if (!daemon.online) return req.socket.destroy();
        res.setHeader('Content-Type', 'application/json');
        if (req.url === '/health') return res.end(JSON.stringify({ status: 'ready' }));
        req.resume().on('end', () => res.end(JSON.stringify(DAEMON_RESULT)));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    port = server.address().port;
});

afterAll(async () => {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(modelDir, { recursive: true, force: true });
});

beforeEach(() => {
    daemon.online = true;
    processes = [];
    client = new AiDaemonClient({
        port,
        paths: {
            YOLO_MODEL_PATH: path.join(modelDir, 'yolo.pt'),
            PLANT_MODEL_PATH: path.join(modelDir, 'plant.keras'),
            CLASS_NAMES_PATH: path.join(modelDir, 'classes.txt'),
            PIPELINE_SCRIPT: path.join(modelDir, 'pipeline.py'),
            DISEASE_MODELS_DIR: path.join(modelDir, 'yok'),
        },
        spawnProcess: () => {
            const proc = new FakeProcess();
            processes.push(proc);
            return proc;
        },
    });
});

afterEach(() => client.stop());

test('starts the daemon, exposes labels and maps predictions to Turkish names and percentages', async () => {
    await expect(client.start()).resolves.toBe(true);
    expect(client.isReady).toBe(true);
    expect(client.getLabels()).toEqual([
        { index: 0, key: 'apple', isim: 'Elma' },
        { index: 1, key: 'tomato', isim: 'Domates' },
    ]);

    const result = await client.predict(Buffer.from('image'));
    expect(result).toMatchObject({
        basarili: true,
        katman2_bitki: { tur: 'tomato', tur_tr: 'Domates', confidence: 95 },
        katman3_hastalik: { hastalik_tr: 'Geç Yanıklık', confidence: 97 },
    });
});

test('restarts a crashed daemon and ignores the late exit event of the old process', async () => {
    await client.start();
    const [first] = processes;

    first.crash();
    expect(client.isReady).toBe(false);

    const result = await client.predict(Buffer.from('image'));
    expect(result.basarili).toBe(true);
    expect(processes).toHaveLength(2);

    // Eski sürecin geç gelen exit olayı yeni süreci "öldürmemeli"
    first.emit('exit', 0, null);
    expect(client.isReady).toBe(true);
});

test('concurrent requests after a crash share a single restart', async () => {
    await client.start();
    processes[0].crash();

    const results = await Promise.all([1, 2, 3].map(() => client.predict(Buffer.from('image'))));

    expect(results.every(r => r.basarili)).toBe(true);
    expect(processes).toHaveLength(2); // ilk başlatma + tek yeniden başlatma
});

test('self-heals when the daemon stops answering mid-flight', async () => {
    await client.start();
    daemon.online = false;
    setTimeout(() => { daemon.online = true; }, 500);

    const result = await client.predict(Buffer.from('image'));

    expect(result.basarili).toBe(true);
    expect(processes).toHaveLength(2);
    expect(processes[0].killed).toBe(true);
});

test('throws ServiceUnavailableError when the daemon cannot be started', async () => {
    fs.renameSync(path.join(modelDir, 'plant.keras'), path.join(modelDir, 'plant.bak'));
    try {
        await expect(client.start()).resolves.toBe(false);
        await expect(client.predict(Buffer.from('image'))).rejects.toBeInstanceOf(ServiceUnavailableError);
        expect(processes).toHaveLength(0);
    } finally {
        fs.renameSync(path.join(modelDir, 'plant.bak'), path.join(modelDir, 'plant.keras'));
    }
});
