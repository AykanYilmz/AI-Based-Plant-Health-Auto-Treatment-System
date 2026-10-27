const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Teşhis görsellerinin diske kaydedilmesi ve silinmesinden sorumludur.
 */
class ImageStorage {
    #directory;

    constructor(directory) {
        this.#directory = directory;
        if (!fs.existsSync(directory)) {
            fs.mkdirSync(directory, { recursive: true });
            logger.info(`📁 '${path.basename(directory)}' klasörü oluşturuldu.`);
        }
    }

    get directory() {
        return this.#directory;
    }

    /**
     * Görseli tahmin edilemez bir dosya adıyla kaydeder.
     * @returns {Promise<string>} Kaydedilen dosya adı
     */
    async save(buffer, label = 'plant') {
        const safeLabel = String(label).replace(/[^a-z0-9_-]/gi, '_') || 'plant';
        const filename = `img_${Date.now()}_${crypto.randomBytes(6).toString('hex')}_${safeLabel}.jpg`;
        await fs.promises.writeFile(this.#resolve(filename), buffer);
        return filename;
    }

    /** Görseli siler; dosya zaten yoksa sessizce geçer. */
    async remove(filename) {
        if (!filename) return;
        try {
            await fs.promises.unlink(this.#resolve(filename));
            logger.success(`🗑️ Teşhis resmi diskten silindi: ${filename}`);
        } catch (err) {
            logger.warn(`⚠️ Dosya silinemedi veya zaten yok: ${filename} | Hata: ${err.message}`);
        }
    }

    async removeAll(filenames) {
        await Promise.all(filenames.map(name => this.remove(name)));
    }

    /**
     * Uygulamanın kaydettiği teşhis görsellerini (img_*.jpg) değiştirilme zamanlarıyla listeler.
     * Elle konmuş veya başka amaçlı dosyalar listelenmez.
     * @returns {Promise<{ filename: string, modifiedAt: Date }[]>}
     */
    async listImages() {
        const names = (await fs.promises.readdir(this.#directory)).filter(n => /^img_.+\.jpg$/.test(n));
        return Promise.all(names.map(async (filename) => ({
            filename,
            modifiedAt: (await fs.promises.stat(this.#resolve(filename))).mtime,
        })));
    }

    /** Görselin diskteki tam yolu; dosya yoksa null. */
    async pathFor(filename) {
        const filePath = this.#resolve(filename);
        try {
            await fs.promises.access(filePath);
            return filePath;
        } catch {
            return null;
        }
    }

    // Dosya adının klasör dışına çıkmasını (path traversal) engeller
    #resolve(filename) {
        return path.join(this.#directory, path.basename(filename));
    }
}

module.exports = ImageStorage;
