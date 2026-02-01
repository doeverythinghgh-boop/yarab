document.addEventListener("DOMContentLoaded", async () => {
    const topicSelector = document.getElementById("topic-selector");
    const editorContainer = document.getElementById("editor-container");
    const loadButton = document.getElementById("load-topics-btn");
    const exportButton = document.getElementById("export-topics-btn");

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
            const lineText = editor.getLine(pos.line);

            console.log(`%c[نقر مزدوج] السطر: ${pos.line}, العمود: ${pos.ch}`, "color: #007bff;");
            console.log(`[نص السطر]: ${lineText}`);

            // البحث عن كافة التواريخ في السطر (صيغة يوم-شهر-سنة أو يوم/شهر/سنة)
            const dateRegex = /(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/g;
            const matches = [...lineText.matchAll(dateRegex)];
            let foundDate = null;

            for (const match of matches) {
                const start = match.index;
                const end = start + match[0].length;
                // توسيع نطاق النقر قليلاً لسهولة الاستخدام
                if (pos.ch >= start - 1 && pos.ch <= end + 1) {
                    foundDate = match[0];
                    break;
                }
            }

            if (foundDate) {
                console.log(`%c[اكتشاف] تم العثور على تاريخ: ${foundDate}`, "color: #28a745; font-weight: bold;");
                console.log("[بحث] جاري الفحص في سجل الأحداث...");

                const event = await findEventByDate(foundDate);
                if (event) {
                    console.log(`%c[تطابق] تم العثور على الحدث رقم (${event.id}). جاري التحويل...`, "color: #28a745;");
                    window.location.href = `index.html?eventId=${event.id}`;
                } else {
                    console.warn(`[تنبيه] التاريخ ${foundDate} موجود كنص ولكن لا يوجد حدث مسجل به في السجل.`);
                    alert(`لا يوجد حدث مسجل بهذا التاريخ: ${foundDate}`);
                }
            } else {
                console.log("%c[تنبيه] لم يتم التعرف على تاريخ في موضع النقر.", "color: #dc3545;");
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
            const gistId = await getSetting("gist_id");
            if (!gistId) {
                console.error("[الموضوعات] خطأ: المعرف Gist ID غير موجود.");
                alert("يرجى ضبط Gist ID في صفحة الإعدادات أولاً.");
                return;
            }

            console.log(`%c[الموضوعات] بدء جلب المواضيع من الـ Gist: ${gistId}`, "color: #007bff; font-weight: bold;");
            const response = await fetch(`https://api.github.com/gists/${gistId}`);

            if (response.ok) {
                const gistData = await response.json();
                const file = gistData.files["topics_data.json"];
                if (!file) {
                    console.warn("[تنبيه] ملف topics_data.json مفقود من الـ Gist.");
                    throw new Error("الملف topics_data.json غير موجود في هذا الـ Gist.");
                }

                console.log("[خطوة 1] استلام محتوى المواضيع. جاري التحويل للحفظ المحلي...");
                const fileData = JSON.parse(file.content);
                await importData(fileData);

                console.log("[خطوة 2] تم تحديث IndexedDB بكافة نصوص المواضيع الجديدة.");
                alert("تمت المزامنة بنجاح من GitHub Gist (الموضوعات).");

                if (topicSelector.value) {
                    console.log("[خطوة 3] تحديث العرض الحالي للموضوع المختار...");
                    topicSelector.dispatchEvent(new Event("change"));
                } else {
                    location.reload();
                }
            } else {
                console.error(`[خطأ] تفاعل GitHub API غير سليم. الحالة: ${response.status}`);
                alert(`فشل جلب الملف. الحالة: ${response.status}`);
            }
        } catch (err) {
            console.error("[فشل جلب المواضيع]:", err.message);
            alert(`خطأ: ${err.message}`);
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
            console.log("%c🚀 [نظام المزامنة] بدء تصدير الموضوعات سحابياً الآن...", "color: #28a745; font-weight: bold; font-size: 1.2em;");

            const githubToken = await getSetting("github_token");
            const gistId = await getSetting("gist_id");

            console.log("🔍 [فحص الإعدادات] جاري التأكد من التوكن والمعرف للموضوعات...");
            if (!githubToken) console.warn("⚠️ [تنبيه] لم يتم ضبط التوكن. سيتم التحويل للتحميل المحلي.");

            console.log("📂 [قاعدة البيانات] جاري جلب المواضيع من IndexedDB...");
            const db = await openDB();
            const tx = db.transaction(topicsStoreName, "readonly");
            const store = tx.objectStore(topicsStoreName);
            const request = store.getAll();

            request.onsuccess = async () => {
                const allData = request.result;
                console.log(`📦 [تجهيز] تم استخراج (${allData.length}) موضوع. جاري التجهيز...`);
                const jsonContent = JSON.stringify(allData, null, 2);

                if (githubToken && gistId) {
                    console.log("%c📡 [اتصال] جاري تحديث ملف topics_data.json على GitHub... انتظر قليلاً.", "color: #007bff;");

                    const response = await fetch(`https://api.github.com/gists/${gistId}`, {
                        method: "PATCH",
                        headers: {
                            "Authorization": `token ${githubToken}`,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            files: {
                                "topics_data.json": { content: jsonContent }
                            }
                        })
                    });

                    if (response.ok) {
                        console.log("%c✅ [نجاح] تم تحديث الموضوعات سحابياً بنجاح تام!", "color: #28a745; font-weight: bold; padding: 4px; border: 1px solid;");
                        alert("✅ تم تحديث الموضوعات على GitHub Gist بنجاح!");
                        return;
                    } else {
                        console.error(`❌ [فشل الرفع] حدث خطأ في استجابة GitHub. الحالة: ${response.status}`);
                        console.log("💡 [نصيحة] إذا كان الخطأ 401، فهذا يعني أن التوكن انتهت صلاحيته أو غير صحيح.");
                    }
                }

                console.log("💾 [إجراء احتياطي] جاري بدء التحميل المحلي لملف المواضيع...");
                const blob = new Blob([jsonContent], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "topics_data.json";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                console.log("🏁 [نهاية] تم تحميل ملف الموضوعات محلياً.");
                alert("تم تحميل ملف الموضوعات محلياً.");
            };
        } catch (err) {
            console.error("⛔ [خطأ فني] تعطلت عملية تصدير المواضيع:", err);
            alert("حدث خطأ أثناء التصدير.");
        }
    });

    async function initializePage() {
        console.log("[Page] Initializing...");
        await initializeDefaultSettings(); // ضمان وجود المعرفات

        const list = await getSetting("topicsList");
        topicSelector.innerHTML = '<option value="">-- اختر موضوعًا --</option>';
        if (list) {
            list.forEach(t => {
                const opt = document.createElement("option");
                opt.value = t.id;
                opt.textContent = t.name;
                topicSelector.appendChild(opt);
            });
        }

        const saved = sessionStorage.getItem("selectedTopicId");
        if (saved) {
            topicSelector.value = saved;
            topicSelector.dispatchEvent(new Event("change"));
        }

        window.addEventListener("pagehide", () => {
            if (topicSelector.value) sessionStorage.setItem("selectedTopicId", topicSelector.value);
        });
    }

    await initializePage();
});
