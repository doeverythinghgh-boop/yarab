document.addEventListener("DOMContentLoaded", async () => {
    const timelineContainer = document.getElementById("timeline-container");

    // OpenDB imported from db.js

    async function getAllEvents() {
        const db = await openDB();
        const transaction = db.transaction("events", "readonly");
        const store = transaction.objectStore("events");
        const request = store.getAll();

        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject([]);
        });
    }

    function formatDate(dateStr) {
        // Expecting DD-MM-YYYY
        // To Sort properly, we convert to Date object
        const [day, month, year] = dateStr.split("-").map(Number);
        return new Date(year, month - 1, day);
    }

    async function fetchFromGist() {
        try {
            const gistId = "03224b07410b79be95dca509dff3c472";
            console.log("جاري محاولة جلب البيانات من السحابة...");
            const response = await fetch(`https://api.github.com/gists/${gistId}`);
            if (!response.ok) return false;

            const gistData = await response.json();
            const file = gistData.files["111.json"];
            if (!file) return false;

            const fileData = JSON.parse(file.content);

            // تخزين البيانات في IndexedDB بنفس تنسيق index.js
            const db = await openDB();
            const transaction = db.transaction("events", "readwrite");
            const store = transaction.objectStore("events");

            store.clear();
            fileData.forEach(item => {
                const mappedItem = {
                    ...item,
                    tag: item.tag || "",
                    fileLink: Array.isArray(item.fileLink)
                        ? item.fileLink
                        : item.fileLink
                            ? [item.fileLink]
                            : [],
                    condemnation: item.condemnation || "",
                    condemnationDescription: item.condemnationDescription || "",
                };
                store.add(mappedItem);
            });

            return new Promise((resolve) => {
                transaction.oncomplete = () => resolve(true);
                transaction.onerror = (e) => {
                    console.error("Transaction error:", e);
                    resolve(false);
                };
            });
        } catch (e) {
            console.error("Fetch error:", e);
            return false;
        }
    }

    async function renderTimeline() {
        try {
            let events = await getAllEvents();

            if (events.length === 0) {
                timelineContainer.innerHTML = "<p class='loading-text'>جاري محاولة جلب البيانات من السحابة...</p>";
                const success = await fetchFromGist();
                if (success) {
                    events = await getAllEvents();
                }
            }

            if (events.length === 0) {
                timelineContainer.innerHTML = "<p style='text-align:center; padding: 50px;'>لا توجد أحداث مسجلة بعد. يمكنك إضافة أحداث من الصفحة الرئيسية.</p>";
                return;
            }

            // Sort by date ascending (oldest first)
            events.sort((a, b) => {
                return formatDate(a.date) - formatDate(b.date);
            });

            timelineContainer.innerHTML = "";

            events.forEach((event, index) => {
                const itemDiv = document.createElement("div");
                const sideClass = index % 2 === 0 ? "left" : "right";
                itemDiv.className = `timeline-item ${sideClass}`;

                itemDiv.innerHTML = `
                    <div class="content" onclick="window.location.href='index.html?eventId=${event.id}'">
                        <span class="timeline-date">${event.date}</span>
                        <div class="timeline-desc">${event.description || "لا يوجد وصف"}</div>
                        <div class="timeline-meta">
                            ${event.tag ? `<span class="tag-badge">قوة الملف: ${event.tag}</span>` : ""}
                            ${event.condemnation ? `<span class="condemnation-badge">إدانة: ${event.condemnation}</span>` : ""}
                        </div>
                    </div>
                `;

                timelineContainer.appendChild(itemDiv);

                // إضافة فئة show بتأخير متدرج لإحداث حركة ظهور احترافية
                setTimeout(() => {
                    itemDiv.classList.add("show");
                }, index * 100);
            });

        } catch (error) {
            console.error("Timeline error:", error);
            timelineContainer.innerHTML = "<p class='loading-text'>حدث خطأ أثناء تحميل البيانات. يرجى المحاولة مرة أخرى.</p>";
        }
    }

    await initializeDefaultSettings();
    renderTimeline();
});
