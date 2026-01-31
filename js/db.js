const dbName = "EventsDB";
const storeName = "events";
const topicsStoreName = "topicsContent";
const settingsStoreName = "settings";

/**
 * فتح قاعدة البيانات وإنشاء الجداول إذا لزم الأمر
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
  return new Promise((resolve, reject) => {
    // رفعنا الإصدار إلى 4 لإصلاح مشكلة تهيئة البيانات
    const request = indexedDB.open(dbName, 4);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const transaction = event.target.transaction; // استخدام المعاملة الحالية

      // إنشاء مخزن الأحداث
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, {
          keyPath: "id",
          autoIncrement: true,
        });
      }

      // إنشاء مخزن الموضوعات
      if (!db.objectStoreNames.contains(topicsStoreName)) {
        db.createObjectStore(topicsStoreName, { keyPath: "id" });
      }

      // إنشاء مخزن الإعدادات (للقوائم الديناميكية)
      let settingsStore;
      if (!db.objectStoreNames.contains(settingsStoreName)) {
        settingsStore = db.createObjectStore(settingsStoreName, { keyPath: "key" });
      } else {
        settingsStore = transaction.objectStore(settingsStoreName);
      }

      // بيانات أولية (Default Data) - نضعها دائماً عند التحديث لضمان وجودها
      const initialTags = [
        "لا اعرف", "اصلي", "خطر", "لا يمكن تجاهله", "تم تقديمة"
      ];

      const initialCondemnations = [
        "مدير عام مساعد الصيانة",
        "مدير عام",
        "مدير عام و مساعد",
        "مدير عام مساعد+مقاول",
        "مدير عام+مساعد+مقاول",
        "مقاول",
        "لي",
        "لصالحي"
      ];

      const initialTopics = [
        { id: "1", name: "مسؤوليه المهندس المشرف" },
        { id: "2", name: "الحيادية والعدل" },
        { id: "3", name: "محضر تسليم موقع" },
        { id: "4", name: "الكيد لي لالحاق الضرر" },
        { id: "5", name: "اخفاء مستندات" },
        { id: "6", name: "موضوع عام" },
      ];

      // التأكد من عدم مسح بيانات المستخدم إذا كانت موجودة مسبقاً (في حال التحديثات المستقبلية)
      // لكن للإصلاح الحالي سنقوم بإعادة الكتابة إذا كانت فارغة أو لضمان البدء

      // استخدام count للتحقق هل البيانات موجودة أم لا، لكن بما أننا داخل onupgradeneeded
      // والعملية متزامنة (async requests need care), سنقوم بالحفظ المباشر
      // سنستخدم put التي تقوم بالإضافة أو التحديث

      settingsStore.put({ key: "tags", value: initialTags });
      settingsStore.put({ key: "condemnations", value: initialCondemnations });
      settingsStore.put({ key: "topicsList", value: initialTopics });

      console.log("Database upgraded and settings seeded.");
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * دالة مساعدة لجلد الإعدادات
 */
async function getSetting(key) {
  const db = await openDB();
  const transaction = db.transaction(settingsStoreName, "readonly");
  const store = transaction.objectStore(settingsStoreName);
  return new Promise((resolve) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ? req.result.value : null); // Return null if not found
    req.onerror = () => resolve(null);
  });
}

/**
 * دالة لضمان وجود البيانات الافتراضية
 * يتم استدعاؤها عند بدء التطبيق
 */
async function initializeDefaultSettings() {
  const db = await openDB();

  // Check if we need to seed
  const tags = await getSetting("tags");
  const condemnations = await getSetting("condemnations");
  const topics = await getSetting("topicsList");

  // If any is missing, re-seed all default data
  if (!tags || !condemnations || !topics) {
    console.log("Seeding default settings...");
    const tx = db.transaction(settingsStoreName, "readwrite");
    const store = tx.objectStore(settingsStoreName);

    const initialTags = [
      "لا اعرف", "اصلي", "خطر", "لا يمكن تجاهله", "تم تقديمة"
    ];

    const initialCondemnations = [
      "مدير عام مساعد الصيانة",
      "مدير عام",
      "مدير عام و مساعد",
      "مدير عام مساعد+مقاول",
      "مدير عام+مساعد+مقاول",
      "مقاول",
      "لي",
      "لصالحي"
    ];

    const initialTopics = [
      { id: "1", name: "مسؤوليه المهندس المشرف" },
      { id: "2", name: "الحيادية والعدل" },
      { id: "3", name: "محضر تسليم موقع" },
      { id: "4", name: "الكيد لي لالحاق الضرر" },
      { id: "5", name: "اخفاء مستندات" },
      { id: "6", name: "موضوع عام" },
    ];

    if (!tags) store.put({ key: "tags", value: initialTags });
    if (!condemnations) store.put({ key: "condemnations", value: initialCondemnations });
    if (!topics) store.put({ key: "topicsList", value: initialTopics });

    return new Promise((resolve) => {
      tx.oncomplete = () => {
        console.log("Default settings seeded.");
        resolve();
      }
      tx.onerror = () => resolve();
    });
  }
}


/**
 * دالة مساعدة لإظهار حالة الحفظ
 * تتوقع وجود عنصر بالمعرف 'save-status'
 */
function showSaveStatus() {
  const saveStatus = document.getElementById("save-status");
  if (saveStatus) {
    saveStatus.textContent = "تم الحفظ بنجاح"; // أو أي نص آخر
    saveStatus.style.opacity = 1;
    setTimeout(() => {
      saveStatus.style.opacity = 0;
    }, 2000);
  }
}
