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

    async function renderTimeline() {
        try {
            let events = await getAllEvents();

            if (events.length === 0) {
                timelineContainer.innerHTML = "<p style='text-align:center'>لا توجد أحداث مسجلة بعد.</p>";
                return;
            }

            // Sort by date descending (newest first)
            events.sort((a, b) => {
                return formatDate(b.date) - formatDate(a.date);
            });

            timelineContainer.innerHTML = "";

            events.forEach((event, index) => {
                const itemDiv = document.createElement("div");
                // Alternate left/right, starting with Right (since RTL, right is first "visual" slot? No, let's just alternate classes)
                // In RTL CSS provided:
                // .right { right: 50% } -> occupies right half? 
                // Let's rely on standard logic: even=left, odd=right
                const sideClass = index % 2 === 0 ? "left" : "right";
                itemDiv.className = `timeline-item ${sideClass}`;

                itemDiv.innerHTML = `
                    <div class="content" onclick="window.location.href='index.html?eventId=${event.id}'">
                        <span class="timeline-date">${event.date}</span>
                        <div class="timeline-desc">${event.description || "لا يوجد وصف"}</div>
                        <div class="timeline-meta">
                            ${event.tag ? `<span class="tag-badge">${event.tag}</span>` : ""}
                            ${event.condemnation ? `<span class="tag-badge" style="background:#ffebee;color:#b71c1c">${event.condemnation}</span>` : ""}
                        </div>
                    </div>
                `;

                timelineContainer.appendChild(itemDiv);
            });

        } catch (error) {
            console.error("Timeline error:", error);
            timelineContainer.innerHTML = "<p>حدث خطأ أثناء تحميل البيانات.</p>";
        }
    }

    renderTimeline();
});
