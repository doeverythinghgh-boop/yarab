const dbName = "EventsDB";
const storeName = "events";
const topicsStoreName = "topicsContent";

/**
 * فتح قاعدة البيانات وإنشاء الجداول إذا لزم الأمر
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 2); // رقم الإصدار

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      console.log("Upgrading DB...");
      
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
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
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
