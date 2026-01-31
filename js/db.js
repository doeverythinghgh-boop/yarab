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
    const request = indexedDB.open(dbName, 3); // رفعنا الإصدار إلى 3

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

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
      if (!db.objectStoreNames.contains(settingsStoreName)) {
        const settingsStore = db.createObjectStore(settingsStoreName, { keyPath: "key" });

        // بيانات أولية (Default Data)
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

        settingsStore.transaction.oncomplete = () => {
          const seedTx = db.transaction(settingsStoreName, "readwrite");
          const seedStore = seedTx.objectStore(settingsStoreName);
          seedStore.put({ key: "tags", value: initialTags });
          seedStore.put({ key: "condemnations", value: initialCondemnations });
          seedStore.put({ key: "topicsList", value: initialTopics });
        };
      }
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
    req.onsuccess = () => resolve(req.result ? req.result.value : []);
    req.onerror = () => resolve([]);
  });
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
