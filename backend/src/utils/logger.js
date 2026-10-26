const fs = require('fs');
const path = require('path');
const { LOGS_DIR } = require('../config/paths');

// Konsol için ANSI renk kodları
const COLORS = {
    reset: '\x1b[0m',
    info: '\x1b[36m',    // Cyan
    success: '\x1b[32m', // Green
    warn: '\x1b[33m',    // Yellow
    error: '\x1b[31m',   // Red
    magenta: '\x1b[35m'  // Magenta (Python Daemon için özel)
};

/**
 * Konsola renkli, log dosyasına zaman damgalı satırlar yazan logger.
 */
class Logger {
    #logFile;

    constructor(logsDir) {
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }
        this.#logFile = path.join(logsDir, 'app.log');
    }

    info(msg, ...args) {
        this.#log('INFO', 'BILGI', COLORS.info, Logger.#format(msg, args), console.log);
    }

    success(msg, ...args) {
        this.#log('SUCCESS', 'BASARI', COLORS.success, Logger.#format(msg, args), console.log);
    }

    warn(msg, ...args) {
        this.#log('WARN', 'UYARI', COLORS.warn, Logger.#format(msg, args), console.warn);
    }

    error(msg, errorObj = null) {
        let message = msg;
        if (errorObj) {
            message += ` | Hata: ${errorObj.message || errorObj}`;
            if (errorObj.stack) {
                // Stack trace'i sadece log dosyasına detaylı yaz, konsola kısa yaz
                this.#writeToFile('ERROR_STACK', errorObj.stack);
            }
        }
        this.#log('ERROR', 'HATA', COLORS.error, message, console.error);
    }

    python(msg) {
        // Python Daemon çıktısı için özel format
        this.#log('PYTHON', 'PYTHON', COLORS.magenta, msg, console.log);
    }

    #log(fileLevel, consoleLabel, color, message, sink) {
        const timestamp = new Date().toLocaleString('tr-TR', { hour12: false });
        sink(`${color}[${consoleLabel}] [${timestamp}]${COLORS.reset} ${message}`);
        this.#writeToFile(fileLevel, message);
    }

    #writeToFile(level, message) {
        const logLine = `[${new Date().toISOString()}] [${level}] ${message}\n`;
        // Hataları engellemek için sessizce append et (arka planda)
        fs.appendFile(this.#logFile, logLine, { encoding: 'utf8' }, (err) => {
            if (err) {
                process.stderr.write(`❌ Log dosyasına yazılamadı: ${err.message}\n`);
            }
        });
    }

    static #format(msg, args) {
        if (!args.length) return msg;
        return `${msg} ${args.map(a => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' ')}`;
    }
}

module.exports = new Logger(LOGS_DIR);
