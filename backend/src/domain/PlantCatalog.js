/**
 * Desteklenen bitkiler, hastalıklar, Türkçe isimleri ve tedavi önerileri için tek kaynak.
 * Hem veritabanı seed işlemi hem de AI sonuçlarının Türkçeleştirilmesi bu sınıfı kullanır.
 */
class PlantCatalog {
    static PLANTS = Object.freeze([
        { key: 'apple', tr: 'Elma', en: 'Apple' },
        { key: 'cherry', tr: 'Kiraz', en: 'Cherry' },
        { key: 'corn', tr: 'Mısır', en: 'Corn' },
        { key: 'grape', tr: 'Üzüm', en: 'Grape' },
        { key: 'peach', tr: 'Şeftali', en: 'Peach' },
        { key: 'potato', tr: 'Patates', en: 'Potato' },
        { key: 'strawberry', tr: 'Çilek', en: 'Strawberry' },
        { key: 'tomato', tr: 'Domates', en: 'Tomato' },
        { key: 'bell_pepper', tr: 'Biber', en: 'Bell Pepper' },
    ]);

    static DISEASE_NAMES_TR = Object.freeze({
        'Healthy': 'Sağlıklı',
        'Apple Scab': 'Elma Karalekesi',
        'Black Rot': 'Siyah Çürüklük',
        'Cedar Apple Rust': 'Sedir-Elma Pası',
        'Powdery Mildew': 'Külleme',
        'Cercospora Leaf Spot': 'Cercospora Yaprak Lekesi',
        'Common Rust': 'Pas Hastalığı',
        'Northern Leaf Blight': 'Kuzey Yaprak Yanıklığı',
        'Esca (Black Measles)': 'Esca (Siyah Kızamık)',
        'Leaf Blight': 'Yaprak Yanıklığı',
        'Bacterial Spot': 'Bakteriyel Leke',
        'Early Blight': 'Erken Yanıklık',
        'Late Blight': 'Geç Yanıklık',
        'Septoria Leaf Spot': 'Septoria Yaprak Lekesi',
        'Yellow Leaf Curl Virus': 'Sarı Yaprak Kıvırma Virüsü',
        'Leaf Scorch': 'Yaprak Yanıklığı',
    });

    static TREATMENTS = Object.freeze({
        'Healthy': 'Bitkiniz oldukça sağlıklı görünüyor. Mevcut sulama ve bakım düzenini bozmadan devam edin. Düzenli olarak yaprak altlarını kontrol etmeyi unutmayın.',
        'Apple Scab': 'Elma Karalekesi teşhisi konuldu. Tedavi için:\n1. Enfekte olmuş yaprakları ve dalları budayarak bahçeden uzaklaştırın.\n2. İlkbaharda tomurcuklar açılmadan önce bakır içerikli fungusitler (mantar ilacı) uygulayın.\n3. Sulamayı sabah saatlerinde ve doğrudan köke yapın, yaprakları ıslatmaktan kaçının.',
        'Black Rot': 'Siyah Çürüklük teşhisi konuldu. Tedavi için:\n1. Bulaşık yaprak, sürgün ve meyve salkımlarını hemen budayıp yakın.\n2. Kimyasal mücadele için sistemik fungusitler kullanın.\n3. Bitki çevresindeki hava sirkülasyonunu artırmak için budamayı doğru yapın ve nemli ortamı azaltın.',
        'Cedar Apple Rust': 'Sedir-Elma Pası teşhisi konuldu. Tedavi için:\n1. Yakındaki sedir veya ardıç ağaçlarında oluşan pas urlarını temizleyin.\n2. Yapraklar yeni açılırken koruyucu fungusit uygulaması yapın.\n3. Dirençli bitki çeşitlerini tercih etmeye özen gösterin.',
        'Powdery Mildew': 'Külleme hastalığı tespit edildi. Tedavi için:\n1. Enfekte kısımları hemen budayarak temizleyin.\n2. Kükürt bazlı ilaçlar veya sistemik fungusitler kullanın.\n3. Bitkileri aşırı sık dikmeyin, aralarındaki hava akışını artırın. Sulamayı yapraktan değil kökten yapın.',
        'Cercospora Leaf Spot': 'Cercospora Yaprak Lekesi tespit edildi. Tedavi için:\n1. Bitki kalıntılarını temizleyin ve imha edin.\n2. Nem oranını düşürün, yaprak ıslaklık süresini azaltın.\n3. Kimyasal mücadelede bakırlı ilaçlar veya uygun koruyucu fungusitler kullanın.',
        'Common Rust': 'Pas Hastalığı tespit edildi. Tedavi için:\n1. Pas püstülleri olan yaprakları koparıp imha edin.\n2. Bitkiler arasında yeterli mesafe bırakarak havalandırmayı iyileştirin.\n3. Bakır veya kükürt içerikli fungusitler ile ilaçlama yapın.',
        'Northern Leaf Blight': 'Kuzey Yaprak Yanıklığı tespit edildi. Tedavi için:\n1. Hastalıklı bitki artıklarını tarladan uzaklaştırın.\n2. Gelecek sezon için ekim nöbeti (münavebe) uygulayın.\n3. Şiddetli durumlarda triazol veya strobilurin grubu fungusitler kullanın.',
        'Esca (Black Measles)': 'Esca (Siyah Kızamık) tespit edildi. Tedavi için:\n1. Budama aletlerini her kesimden sonra mutlaka dezenfekte edin.\n2. Budama yaralarını aşı macunu ile kapatın.\n3. Şiddetli enfekte olmuş yaşlı asmaları söküp yakın.',
        'Leaf Blight': 'Yaprak Yanıklığı tespit edildi. Tedavi için:\n1. Enfekte yaprakları budayarak bitkiden uzaklaştırın.\n2. Bakır içerikli mantar ilaçları ile koruyucu ilaçlama yapın.\n3. Yaprakları kuru tutmaya özen gösterin, damlama sulama kullanın.',
        'Bacterial Spot': 'Bakteriyel Leke hastalığı tespit edildi. Tedavi için:\n1. Bakteriyel bir hastalık olduğu için normal mantar ilaçları etki etmez, bakır bazlı bakterisitler kullanın.\n2. Tarım aletlerini sık sık sterilize edin.\n3. Hastalıklı bitki kalıntılarını tarlada bırakmayın.',
        'Early Blight': 'Erken Yanıklık tespit edildi. Tedavi için:\n1. Alt yaprakları budayarak toprakla temasını kesin.\n2. Düzenli olarak dengeli gübreleme yaparak bitki direncini artırın.\n3. Bakırlı ilaçlar veya chlorothalonil içerikli koruyucu ilaçlar uygulayın.',
        'Late Blight': 'Geç Yanıklık (Mildiyö) tespit edildi (ÇOK RİSKLİ!). Tedavi için:\n1. Nemli ve serin havalarda hızla yayılır; sulamayı kesinlikle damlama olarak yapın.\n2. Hastalıklı tüm bitki kısımlarını hemen toplayıp yakın (kompost yapmayın).\n3. Metalaxyl, mancozeb veya bakır içerikli sistemik ilaçlar ile acilen ilaçlama yapın.',
        'Septoria Leaf Spot': 'Septoria Yaprak Lekesi tespit edildi. Tedavi için:\n1. Topraktan bulaşmayı önlemek için malçlama yapın.\n2. Alt yapraklarda lekeler başladığı anda budama yapın.\n3. Bakırlı mantar ilaçları veya koruyucu fungusitler kullanın.',
        'Yellow Leaf Curl Virus': 'Sarı Yaprak Kıvırma Virüsü tespit edildi. Tedavi için:\n1. Virüsü yayan Beyaz Sinek (Bemisia tabaci) ile kimyasal veya biyolojik olarak acilen mücadele edin.\n2. Enfekte edilmiş bitkileri derhal söküp plastik torbalara koyarak tarladan uzaklaştırın.\n3. Seralarda sinek tülleri ve yapışkan sarı tuzaklar kullanın.',
        'Leaf Scorch': 'Yaprak Yanıklığı (Yaprak Yanığı) tespit edildi. Tedavi için:\n1. Enfekte olmuş çilek yapraklarını derhal temizleyin ve bahçeden uzaklaştırın.\n2. Damlama sulama tercih ederek yaprakların ıslak kalma süresini en aza indirin.\n3. Hastalık yayılımını önlemek amacıyla ilkbahar döneminde bakırlı koruyucu fungusitler kullanın.',
    });

    static PLANT_DISEASES = Object.freeze({
        apple: ['Healthy', 'Apple Scab', 'Black Rot', 'Cedar Apple Rust'],
        cherry: ['Healthy', 'Powdery Mildew'],
        corn: ['Healthy', 'Cercospora Leaf Spot', 'Common Rust', 'Northern Leaf Blight'],
        grape: ['Healthy', 'Black Rot', 'Powdery Mildew', 'Esca (Black Measles)', 'Leaf Blight'],
        peach: ['Healthy', 'Bacterial Spot'],
        potato: ['Healthy', 'Early Blight', 'Late Blight'],
        strawberry: ['Healthy', 'Leaf Scorch'],
        tomato: ['Healthy', 'Bacterial Spot', 'Early Blight', 'Late Blight', 'Septoria Leaf Spot', 'Yellow Leaf Curl Virus'],
        bell_pepper: ['Healthy', 'Bacterial Spot'],
    });

    static HEALTHY_KEY = 'Healthy';

    /** AI modelinin döndürdüğü anahtarı veritabanı anahtarına çevirir (ör. "bell pepper" → "bell_pepper"). */
    static normalizePlantKey(key) {
        return String(key || '').trim().replace(/\s+/g, '_');
    }

    static plantDisplayName(key) {
        if (!key) return 'Bilinmeyen Bitki';
        const plant = PlantCatalog.PLANTS.find(p => p.key === PlantCatalog.normalizePlantKey(key));
        return plant ? plant.tr : key.charAt(0).toUpperCase() + key.slice(1);
    }

    static diseaseDisplayName(key) {
        if (!key) return PlantCatalog.DISEASE_NAMES_TR[PlantCatalog.HEALTHY_KEY];
        return PlantCatalog.DISEASE_NAMES_TR[key] || key;
    }

    static treatmentFor(diseaseKey) {
        return PlantCatalog.TREATMENTS[diseaseKey] || 'Sağlıklı bakım düzenine devam edin.';
    }
}

module.exports = PlantCatalog;
