/**
 * İstemciye güvenle gösterilebilecek, HTTP durum kodu taşıyan uygulama hataları.
 * Global hata yakalayıcı bu sınıftan türeyen hataları `{ basarili: false, hata }` biçiminde döndürür;
 * diğer tüm hatalar iç detay sızdırmadan genel bir 500 mesajına dönüştürülür.
 */
class AppError extends Error {
    constructor(message, statusCode = 500, details = {}) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.details = details; // Yanıta eklenecek ek alanlar (ör. talep_edilen_id)
    }
}

class ValidationError extends AppError {
    constructor(message, details) { super(message, 400, details); }
}

class UnauthorizedError extends AppError {
    constructor(message, details) { super(message, 401, details); }
}

class ForbiddenError extends AppError {
    constructor(message, details) { super(message, 403, details); }
}

class NotFoundError extends AppError {
    constructor(message, details) { super(message, 404, details); }
}

class ServiceUnavailableError extends AppError {
    constructor(message, details) { super(message, 503, details); }
}

module.exports = {
    AppError,
    ValidationError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    ServiceUnavailableError,
};
