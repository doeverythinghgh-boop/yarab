document.addEventListener("DOMContentLoaded", async () => {
    const topicSelector = document.getElementById("topic-selector");
    const contentArea = document.getElementById("content-area");
    const loadButton = document.getElementById("load-data-btn");
    const exportButton = document.getElementById("export-data-btn");

    // saveStatus might be needed if common function isn't enough or different ID? 
    // topics.html has <p id="save-status"></p> and uses showSaveStatus locally defined.
    // We can use the global or define local helper. Global showSaveStatus in db.js handles id="save-status".

    // Use global topicsStoreName from db.js
    const currentStoreName = topicsStoreName;
    let autoSaveTimer = null;

    // List is now fetched from DB settings

    // OpenDB imported from db.js

    async function getTopicsList() {
        return await getSetting("topicsList"); // defined in db.js
    }

    async function getTopicContent(topicId) {
        const db = await openDB();
        const transaction = db.transaction(currentStoreName, "readonly");
        const store = transaction.objectStore(currentStoreName);
        const request = store.get(topicId);

        return new Promise((resolve) => {
            request.onsuccess = () => {
                resolve(request.result ? request.result.content : "");
            };
            request.onerror = () => resolve("");
        });
    }

    async function saveTopicContent(topicId, content) {
        const db = await openDB();
        const transaction = db.transaction(currentStoreName, "readwrite");
        const store = transaction.objectStore(currentStoreName);
        store.put({ id: topicId, content: content });

        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => {
                showSaveStatus(); // Utilizes the global function
                resolve();
            };
            transaction.onerror = (event) => reject(event.target.error);
        });
    }

    async function importData(data) {
        const db = await openDB();
        const transaction = db.transaction(currentStoreName, "readwrite");
        const store = transaction.objectStore(currentStoreName);
        store.clear();
        data.forEach((item) => store.add(item));
        return new Promise((resolve, reject) => {
            transaction.oncomplete = resolve;
            transaction.onerror = (e) => reject(e.target.error);
        });
    }

    async function exportData() {
        const db = await openDB();
        const transaction = db.transaction(currentStoreName, "readonly");
        const store = transaction.objectStore(currentStoreName);
        const request = store.getAll();

        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async function findEventByDate(dateString) {
        const db = await openDB();
        const transaction = db.transaction("events", "readonly"); // Accessing events store safely
        const store = transaction.objectStore("events");
        const request = store.getAll();

        const normalizeDate = (ds) => {
            if (!ds) return "";
            // Replace / with - to normalize
            const cleanDs = ds.replace(/\//g, "-");
            const parts = cleanDs.split("-");
            if (parts.length !== 3) return ds;
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10);
            const year = parseInt(parts[2], 10);
            return `${day}-${month}-${year}`;
        };

        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                console.log("[تتبع] تم جلب جميع الأحداث من قاعدة البيانات.");
                const allEvents = request.result;
                const normalizedDateToFind = normalizeDate(dateString);
                console.log(
                    `[تتبع] البحث عن التاريخ بعد التنسيق: "${normalizedDateToFind}"`
                );

                const foundEvent = allEvents.find(
                    (event) => normalizeDate(event.date) === normalizedDateToFind
                );

                console.log("[تتبع] نتيجة البحث:", foundEvent);
                resolve(foundEvent);
            };
            request.onerror = (e) =>
                reject(
                    console.error(
                        "[تتبع] خطأ في قراءة قاعدة البيانات:",
                        e.target.error
                    )
                );
        });
    }

    loadButton.addEventListener("click", async () => {
        try {
            const response = await fetch("./topics_data.json");
            if (response.ok) {
                const fileData = await response.json();
                await importData(fileData);
                alert("تم تحميل وحفظ البيانات بنجاح.");
                if (topicSelector.value) {
                    topicSelector.dispatchEvent(new Event("change"));
                }
            } else if (response.status === 404) {
                await initializeEmptyData();
                alert(
                    "لم يتم العثور على ملف بيانات، تم إنشاء بيانات أولية فارغة."
                );
            } else {
                alert(
                    "ملف 'topics_data.json' غير موجود أو لا يمكن الوصول إليه. يمكنك إنشاء بيانات جديدة وتصديرها لاحقًا."
                );
            }
        } catch (error) {
            console.error("Error loading or saving data:", error);
            alert("فشل تحميل أو حفظ البيانات. قد يكون الملف غير موجود.");
        }
    });

    exportButton.addEventListener("click", async () => {
        try {
            const dataToExport = await exportData();
            if (!dataToExport || dataToExport.length === 0) {
                alert("لا توجد بيانات لتصديرها.");
                return;
            }

            const jsonString = JSON.stringify(dataToExport, null, 2);
            const blob = new Blob([jsonString], { type: "application/json" });

            if (window.showSaveFilePicker) {
                try {
                    const handle = await window.showSaveFilePicker({
                        suggestedName: "topics_data.json",
                        types: [
                            {
                                description: "JSON Files",
                                accept: { "application/json": [".json"] },
                            },
                        ],
                    });
                    const writable = await handle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                    alert("تم حفظ الملف بنجاح.");
                } catch (err) {
                    if (err.name !== "AbortError") {
                        console.error("Error saving file:", err);
                        alert("فشل حفظ الملف.");
                    }
                }
            } else {
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "topics_data.json";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error("Error exporting data:", error);
            alert("فشل تصدير البيانات.");
        }
    });

    topicSelector.addEventListener("change", async (event) => {
        const selectedTopicId = event.target.value;
        contentArea.innerHTML = "";

        if (selectedTopicId) {
            const content = await getTopicContent(selectedTopicId);

            const editorWrapper = document.createElement("div");
            editorWrapper.className = "editor-wrapper";

            const highlighter = document.createElement("div");
            highlighter.id = "highlighter";

            let lastTap = 0;

            const handleDateNavigation = async (dateText) => {
                console.log(
                    `[تتبع] تم اكتشاف نقرة مزدوجة/نقر سريع على التاريخ: "${dateText}"`
                );
                try {
                    const event = await findEventByDate(dateText);
                    if (event) {
                        console.log(
                            `[تتبع] تم العثور على الحدث، جاري الانتقال إلى: index.html?eventId=${event.id}`
                        );
                        window.location.href = `index.html?eventId=${event.id}`;
                    } else {
                        alert(`لم يتم العثور على حدث مرتبط بالتاريخ: ${dateText}`);
                    }
                } catch (error) {
                    console.error("Error navigating to event:", error);
                    alert("حدث خطأ أثناء محاولة الانتقال للحدث.");
                }
            };

            highlighter.addEventListener("dblclick", (e) => {
                if (e.target.classList.contains("date-highlight")) {
                    e.preventDefault();
                    handleDateNavigation(e.target.textContent);
                }
            });

            highlighter.addEventListener("click", (e) => {
                if (e.target.classList.contains("date-highlight")) {
                    const currentTime = new Date().getTime();
                    const tapLength = currentTime - lastTap;
                    if (tapLength < 300 && tapLength > 0) {
                        e.preventDefault();
                        handleDateNavigation(e.target.textContent);
                    }
                    lastTap = currentTime;
                }
            });

            const textarea = document.createElement("textarea");
            textarea.id = `topic-content-${selectedTopicId}`;
            textarea.placeholder = "اكتب المحتوى الخاص بهذا الموضوع هنا...";
            textarea.value = content;

            const updateHighlight = () => {
                const text = textarea.value;
                // Improved Regex: Supports d-m-yyyy or d/m/yyyy, handles boundaries better
                const dateRegex = /(?<!\d)(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})(?!\d)/g;
                const highlightedText = text
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(dateRegex, '<span class="date-highlight">$1</span>');

                highlighter.innerHTML = highlightedText + "\n";
            };

            textarea.addEventListener("input", (e) => {
                updateHighlight();
                clearTimeout(autoSaveTimer);
                autoSaveTimer = setTimeout(() => {
                    saveTopicContent(selectedTopicId, textarea.value);
                }, 500);
            });

            textarea.addEventListener("scroll", () => {
                highlighter.scrollTop = textarea.scrollTop;
                highlighter.scrollLeft = textarea.scrollLeft;
            });

            // Removed manual pointer-events toggle. 
            // Clicks on non-highlighted areas now naturally pass through the highlighter (pointer-events: none) 
            // to the textarea (z-index: 1), while dates catch clicks (pointer-events: auto).

            textarea.addEventListener("blur", () => { });
            editorWrapper.addEventListener("focusout", updateHighlight);

            editorWrapper.appendChild(highlighter);
            editorWrapper.appendChild(textarea);
            contentArea.appendChild(editorWrapper);
            textarea.focus();
            updateHighlight();
        }
    });

    window.addEventListener("pagehide", () => {
        const textarea = document.querySelector(".editor-wrapper textarea");
        if (topicSelector.value) {
            sessionStorage.setItem("selectedTopicId", topicSelector.value);
            if (textarea)
                sessionStorage.setItem("topicScrollTop", textarea.scrollTop);
        }
    });

    async function initializePage() {
        topicSelector.innerHTML =
            '<option value="">-- اختر موضوعًا --</option>';

        const topicsList = await getTopicsList(); // Fetch from DB

        if (topicsList) {
            topicsList.forEach((topic) => {
                const option = document.createElement("option");
                option.value = topic.id;
                option.textContent = topic.name;
                topicSelector.appendChild(option);
            });
        }

        await initializeEmptyData();

        const savedTopicId = sessionStorage.getItem("selectedTopicId");
        if (savedTopicId) {
            topicSelector.value = savedTopicId;
            topicSelector.dispatchEvent(new Event("change"));

            const savedScrollTop = sessionStorage.getItem("topicScrollTop");
            if (savedScrollTop) {
                setTimeout(() => {
                    const textarea = document.querySelector(
                        ".editor-wrapper textarea"
                    );
                    if (textarea) textarea.scrollTop = parseInt(savedScrollTop, 10);
                }, 200);
            }
        }
    }

    async function initializeEmptyData() {
        const db = await openDB();
        const transaction = db.transaction(currentStoreName, "readonly");
        const store = transaction.objectStore(currentStoreName);
        const countRequest = store.count();

        return new Promise((resolve) => {
            countRequest.onsuccess = async () => {
                if (countRequest.result === 0) {
                    const topicsList = await getTopicsList(); // Get list to seed empty content
                    if (topicsList) {
                        const initialData = topicsList.map((topic) => ({
                            id: topic.id,
                            content: "",
                        }));
                        await importData(initialData);
                        console.log("تم تهيئة قاعدة بيانات الموضوعات ببيانات فارغة.");
                    }
                    resolve();
                } else {
                    resolve();
                }
            };
        });
    }

    await initializeDefaultSettings();
    initializePage();
});
