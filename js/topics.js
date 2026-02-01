document.addEventListener("DOMContentLoaded", async () => {
    const topicSelector = document.getElementById("topic-selector");
    const editorContainer = document.getElementById("editor-container");
    const loadButton = document.getElementById("load-data-btn");
    const exportButton = document.getElementById("export-data-btn");

    let editor = null;
    let autoSaveTimer = null;
    const currentStoreName = topicsStoreName;

    // --- قاعدة البيانات ---
    async function getTopicsList() { return await getSetting("topicsList"); }

    async function getTopicContent(topicId) {
        try {
            const db = await openDB();
            const transaction = db.transaction(currentStoreName, "readonly");
            const store = transaction.objectStore(currentStoreName);
            const request = store.get(topicId);
            return new Promise((resolve) => {
                request.onsuccess = () => {
                    const res = request.result;
                    console.log(`[Database] Loaded content for ${topicId}:`, res ? "Exists" : "Empty");
                    resolve(res ? res.content : "");
                };
                request.onerror = () => resolve("");
            });
        } catch (e) {
            console.error("[Database] Error loading content:", e);
            return "";
        }
    }

    async function saveTopicContent(topicId, content) {
        const db = await openDB();
        const transaction = db.transaction(currentStoreName, "readwrite");
        const store = transaction.objectStore(currentStoreName);
        store.put({ id: topicId, content: content });
        return new Promise((resolve) => {
            transaction.oncomplete = () => { showSaveStatus(); resolve(); };
        });
    }

    async function findEventByDate(dateString) {
        const db = await openDB();
        const transaction = db.transaction("events", "readonly");
        const store = transaction.objectStore("events");
        const request = store.getAll();
        const normalizeDate = (ds) => {
            if (!ds) return "";
            const cleanDs = ds.replace(/\//g, "-");
            const parts = cleanDs.split("-");
            return parts.length === 3 ? `${parseInt(parts[0], 10)}-${parseInt(parts[1], 10)}-${parseInt(parts[2], 10)}` : ds;
        };
        return new Promise((resolve) => {
            request.onsuccess = () => {
                const normalizedDateToFind = normalizeDate(dateString);
                resolve(request.result.find(e => normalizeDate(e.date) === normalizedDateToFind));
            };
            request.onerror = () => resolve(null);
        });
    }

    // --- منطق المحرر ---
    function initEditor(topicId, content) {
        console.log(`[خطوة 1] بدء تهيئة المحرر للموضوع رقم: ${topicId}`);
        console.log(`[البيانات] النص المستلم من قاعدة البيانات طوله: ${content ? content.length : 0} حرفاً.`);

        // فحص وجود المكتبة الأساسية
        if (!window.CodeMirror) {
            console.error("[خطأ] مكتبة CodeMirror غير معرفة.");
            alert("خطأ في تحميل المكتبة.");
            return;
        }

        // فحص وجود الإضافات الضرورية
        if (typeof window.CodeMirror.prototype.addOverlay !== "function") {
            console.error("[خطأ في الملحقات] إضافة (overlay.js) لم يتم تحميلها بشكل صحيح.");
            console.warn("[نصيحة] ربما تم تحميل مكتبة CodeMirror ولكن فشل تحميل الملحق addon/mode/overlay.js.");
            alert("خطأ: ملحقات المحرر ناقصة. يرجى تحديث الصفحة.");
            return;
        }

        // مسح أي محتوى سابق لضمان نظافة الحاوية
        console.log("[خطوة 2] تنظيف الحاوية وإنشاء كائن CodeMirror جديد.");
        editorContainer.innerHTML = "";
        editor = null;

        // إنشاء المحرر
        try {
            editor = CodeMirror(editorContainer, {
                value: content || "",
                lineNumbers: true,
                lineWrapping: true,
                direction: "rtl",
                rtlMoveVisually: true,
                styleActiveLine: true,
                theme: "default"
            });
            console.log("[خطوة 3] تم إنشاء كائن المحرر بنجاح.");
        } catch (err) {
            console.error("[خطأ] فشل إنشاء كائن CodeMirror:", err);
            return;
        }

        // إضافة تظليل التواريخ
        console.log("[خطوة 4] إضافة طبقة تظليل التواريخ (Overlay).");
        const dateRegex = /(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/;
        editor.addOverlay({
            token: function (stream) {
                if (stream.match(dateRegex)) return "date-link";
                stream.next();
                return null;
            }
        });

        // النقر المزدوج للانتقال
        editor.getWrapperElement().addEventListener("dblclick", async (e) => {
            const pos = editor.coordsChar({ left: e.clientX, top: e.clientY });
            const token = editor.getTokenAt(pos);
            if (token && token.type === "date-link") {
                const event = await findEventByDate(token.string);
                if (event) window.location.href = `index.html?eventId=${event.id}`;
                else alert(`لا يوجد حدث مسجل بهذا التاريخ: ${token.string}`);
            }
        });

        // فحص نهائي للظهور
        const wrapper = editor.getWrapperElement();
        console.log("[فحص فيزيائي] أبعاد المحرر الحالية:", {
            width: wrapper.offsetWidth,
            height: wrapper.offsetHeight,
            visible: wrapper.style.display !== 'none'
        });

        if (wrapper.offsetHeight === 0) {
            console.warn("[تحذير] طول المحرر صفر! قد يكون هناك تداخل في تنسيقات CSS يمنع ظهوره.");
        }

        // تحديث التغييرات والحفظ
        editor.on("change", () => {
            clearTimeout(autoSaveTimer);
            autoSaveTimer = setTimeout(() => {
                const currentText = editor.getValue();
                console.log(`[حفظ] جاري حفظ تغييرات الموضوع ${topicId}. طول النص الجديد: ${currentText.length}`);
                saveTopicContent(topicId, currentText);
            }, 800);
        });

        // إجبار التحديث والتركيز لضمان ظهور النص
        setTimeout(() => {
            console.log("[خطوة 5] تنفيذ أمر Refresh و Focus.");
            editor.refresh();
            editor.focus();
            if (editor.getValue() !== content) {
                console.error("[خطأ] النص الموجود في المحرر لا يطابق النص المستلم من قاعدة البيانات!");
            } else {
                console.log("[نجاح] النص مثبت داخل المحرر وجاهز للعرض.");
            }
        }, 150);
    }

    // --- تفاعلات الواجهة ---
    topicSelector.addEventListener("change", async (e) => {
        const tid = e.target.value;
        if (tid) {
            const content = await getTopicContent(tid);
            initEditor(tid, content);
        } else {
            editorContainer.innerHTML = "";
            editor = null;
        }
    });

    loadButton.addEventListener("click", async () => {
        try {
            const response = await fetch("./topics_data.json");
            if (response.ok) {
                const fileData = await response.json();
                await importData(fileData);
                alert("تم تحميل البيانات بنجاح من الملف.");
                if (topicSelector.value) topicSelector.dispatchEvent(new Event("change"));
                else location.reload(); // إعادة تحميل لرؤية المواضيع الجديدة
            } else {
                alert("لم يتم العثور على ملف topics_data.json");
            }
        } catch (err) {
            console.error("Load error:", err);
            alert("حدث خطأ أثناء تحميل البيانات.");
        }
    });

    async function importData(data) {
        const db = await openDB();
        const transaction = db.transaction(currentStoreName, "readwrite");
        const store = transaction.objectStore(currentStoreName);
        store.clear();
        for (const item of data) {
            store.add(item);
        }
    }

    exportButton.addEventListener("click", async () => {
        try {
            const db = await openDB();
            const transaction = db.transaction(currentStoreName, "readonly");
            const store = transaction.objectStore(currentStoreName);
            const request = store.getAll();
            request.onsuccess = () => {
                const blob = new Blob([JSON.stringify(request.result, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "topics_data.json";
                a.click();
                alert("تم تصدير البيانات بنجاح.");
            };
        } catch (e) { alert("فشل تصدير البيانات."); }
    });

    async function initializePage() {
        console.log("[Page] Initializing...");
        await initializeDefaultSettings();

        const list = await getTopicsList();
        topicSelector.innerHTML = '<option value="">-- اختر موضوعًا --</option>';
        if (list) {
            list.forEach(t => {
                const opt = document.createElement("option");
                opt.value = t.id; opt.textContent = t.name;
                topicSelector.appendChild(opt);
            });
        }

        const saved = sessionStorage.getItem("selectedTopicId");
        if (saved) {
            topicSelector.value = saved;
            topicSelector.dispatchEvent(new Event("change"));
        }
    }

    window.addEventListener("pagehide", () => {
        if (topicSelector.value) sessionStorage.setItem("selectedTopicId", topicSelector.value);
    });

    initializePage();
});
