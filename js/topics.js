import { EditorView, basicSetup } from "https://cdn.skypack.dev/codemirror@6.0.1";
import { EditorState } from "https://cdn.skypack.dev/@codemirror/state@6.0.1";
import { Decoration, ViewPlugin, MatchDecorator } from "https://cdn.skypack.dev/@codemirror/view@6.0.1";

document.addEventListener("DOMContentLoaded", async () => {
    const topicSelector = document.getElementById("topic-selector");
    const editorContainer = document.getElementById("editor-container");
    const loadButton = document.getElementById("load-data-btn");
    const exportButton = document.getElementById("export-data-btn");

    let editorView = null;
    let autoSaveTimer = null;
    const currentStoreName = topicsStoreName;

    // --- Database Functions (Preserved from original) ---
    async function getTopicsList() {
        return await getSetting("topicsList");
    }

    async function getTopicContent(topicId) {
        const db = await openDB();
        const transaction = db.transaction(currentStoreName, "readonly");
        const store = transaction.objectStore(currentStoreName);
        const request = store.get(topicId);
        return new Promise((resolve) => {
            request.onsuccess = () => resolve(request.result ? request.result.content : "");
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
                showSaveStatus();
                resolve();
            };
            transaction.onerror = (event) => reject(event.target.error);
        });
    }

    // --- Search Event Logic ---
    async function findEventByDate(dateString) {
        const db = await openDB();
        const transaction = db.transaction("events", "readonly");
        const store = transaction.objectStore("events");
        const request = store.getAll();

        const normalizeDate = (ds) => {
            if (!ds) return "";
            const cleanDs = ds.replace(/\//g, "-");
            const parts = cleanDs.split("-");
            if (parts.length !== 3) return ds;
            return `${parseInt(parts[0], 10)}-${parseInt(parts[1], 10)}-${parseInt(parts[2], 10)}`;
        };

        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                const allEvents = request.result;
                const normalizedDateToFind = normalizeDate(dateString);
                const foundEvent = allEvents.find(e => normalizeDate(e.date) === normalizedDateToFind);
                resolve(foundEvent);
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    // --- CodeMirror Extension: Date Highlighting & Interaction ---
    const dateDecorator = new MatchDecorator({
        regexp: /(?<!\d)(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})(?!\d)/g,
        decoration: m => Decoration.mark({
            class: "cm-date-link",
            attributes: { title: "انقر مرتين للانتقال للحدث" }
        })
    });

    const datePlugin = ViewPlugin.fromClass(class {
        constructor(view) { this.decorations = dateDecorator.createDeco(view); }
        update(update) { this.decorations = dateDecorator.updateDeco(update, this.decorations); }
    }, {
        decorations: v => v.decorations,
        eventHandlers: {
            dblclick: (event, view) => {
                const target = event.target;
                if (target.classList.contains("cm-date-link")) {
                    const dateText = target.textContent;
                    handleDateNavigation(dateText);
                }
            }
        }
    });

    const handleDateNavigation = async (dateText) => {
        try {
            const event = await findEventByDate(dateText);
            if (event) {
                window.location.href = `index.html?eventId=${event.id}`;
            } else {
                alert(`لم يتم العثور على حدث مرتبط بالتاريخ: ${dateText}`);
            }
        } catch (error) {
            console.error("Navigation error:", error);
        }
    };

    // --- Editor Initialization ---
    async function initEditor(topicId, initialContent) {
        if (editorView) editorView.destroy();

        const state = EditorState.create({
            doc: initialContent,
            extensions: [
                basicSetup,
                datePlugin,
                EditorView.lineWrapping,
                EditorView.theme({
                    "&": { height: "70vh", fontSize: "16px", direction: "rtl", textAlign: "right" },
                    ".cm-content": { fontFamily: "Tahoma, Segoe UI, sans-serif", padding: "10px" },
                    ".cm-date-link": {
                        color: "#0056b3",
                        backgroundColor: "#fffbdd",
                        borderBottom: "2px solid #ffc107",
                        borderRadius: "2px",
                        cursor: "pointer",
                        fontWeight: "bold"
                    },
                    "&.cm-focused": { outline: "none" }
                }),
                EditorView.updateListener.of((update) => {
                    if (update.docChanged) {
                        clearTimeout(autoSaveTimer);
                        autoSaveTimer = setTimeout(() => {
                            saveTopicContent(topicId, update.state.doc.toString());
                        }, 800);
                    }
                })
            ]
        });

        editorView = new EditorView({
            state,
            parent: editorContainer
        });

        // Ensure RTL Support for the content editable div
        editorView.contentDOM.setAttribute("dir", "rtl");
    }

    // --- UI Interactions ---
    topicSelector.addEventListener("change", async (e) => {
        const topicId = e.target.value;
        if (topicId) {
            const content = await getTopicContent(topicId);
            await initEditor(topicId, content);
        } else {
            if (editorView) editorView.destroy();
            editorContainer.innerHTML = "";
        }
    });

    loadButton.addEventListener("click", async () => {
        try {
            const response = await fetch("./topics_data.json");
            if (response.ok) {
                const fileData = await response.json();
                await importData(fileData);
                alert("تم تحميل البيانات بنجاح.");
                if (topicSelector.value) topicSelector.dispatchEvent(new Event("change"));
            }
        } catch (err) { alert("حدث خطأ أثناء تحميل الملف."); }
    });

    async function importData(data) {
        const db = await openDB();
        const transaction = db.transaction(currentStoreName, "readwrite");
        const store = transaction.objectStore(currentStoreName);
        store.clear();
        data.forEach(item => store.add(item));
    }

    exportButton.addEventListener("click", async () => {
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
        };
    });

    // --- Page Bootstrapping ---
    async function initializePage() {
        const topicsList = await getTopicsList();
        topicSelector.innerHTML = '<option value="">-- اختر موضوعًا --</option>';
        if (topicsList) {
            topicsList.forEach(topic => {
                const option = document.createElement("option");
                option.value = topic.id;
                option.textContent = topic.name;
                topicSelector.appendChild(option);
            });
        }
        await initializeDefaultSettings();

        const savedTopicId = sessionStorage.getItem("selectedTopicId");
        if (savedTopicId) {
            topicSelector.value = savedTopicId;
            topicSelector.dispatchEvent(new Event("change"));
        }
    }

    window.addEventListener("pagehide", () => {
        if (topicSelector.value) sessionStorage.setItem("selectedTopicId", topicSelector.value);
    });

    initializePage();
});
