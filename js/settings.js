document.addEventListener("DOMContentLoaded", async () => {
    const tagsListEl = document.getElementById("tags-list");
    const condemnationsListEl = document.getElementById("condemnations-list");
    const topicsListEl = document.getElementById("topics-list");

    const newTagInput = document.getElementById("new-tag-input");
    const newCondemnInput = document.getElementById("new-condemnation-input");
    const newTopicInput = document.getElementById("new-topic-input");

    const addTagBtn = document.getElementById("add-tag-btn");
    const addCondemnBtn = document.getElementById("add-condemnation-btn");
    const addTopicBtn = document.getElementById("add-topic-btn");

    // Load initial data
    await initializeDefaultSettings();
    await renderAll();

    // --- Rendering Functions ---

    async function renderAll() {
        const tags = await getSetting("tags");
        const condemnations = await getSetting("condemnations");
        const topics = await getSetting("topicsList");

        renderList(tagsListEl, tags, "tags");
        renderList(condemnationsListEl, condemnations, "condemnations");
        renderTopicsList(topicsListEl, topics);
    }

    function renderList(container, items, keyName) {
        container.innerHTML = "";
        if (!items || items.length === 0) {
            container.innerHTML = "<li style='color:#999'>لا توجد عناصر</li>";
            return;
        }

        items.forEach((item, index) => {
            const li = document.createElement("li");
            li.innerHTML = `
                <span>${item}</span>
                <button class="delete-btn" data-index="${index}" title="حذف">&times;</button>
            `;

            li.querySelector(".delete-btn").addEventListener("click", () => {
                deleteItem(keyName, index);
            });
            container.appendChild(li);
        });
    }

    function renderTopicsList(container, items) {
        container.innerHTML = "";
        if (!items || items.length === 0) {
            container.innerHTML = "<li style='color:#999'>لا توجد مواضيع</li>";
            return;
        }

        items.forEach((item, index) => {
            const li = document.createElement("li");
            li.innerHTML = `
                <span>${item.name}</span>
                <button class="delete-btn" data-index="${index}" title="حذف">&times;</button>
            `;

            li.querySelector(".delete-btn").addEventListener("click", () => {
                deleteItem("topicsList", index);
            });
            container.appendChild(li);
        });
    }

    // --- Actions ---

    async function deleteItem(key, index) {
        if (!confirm("هل أنت متأكد من الحذف؟")) return;

        const db = await openDB();
        const tx = db.transaction(settingsStoreName, "readwrite");
        const store = tx.objectStore(settingsStoreName);

        const items = await getSetting(key);
        items.splice(index, 1);

        store.put({ key: key, value: items });

        tx.oncomplete = () => {
            renderAll();
            showSaveStatus();
        };
    }

    async function addItem(key, value) {
        // Fetch current items FIRST before starting a new transaction
        let items = await getSetting(key);
        if (!items) items = [];

        // Check duplicates
        if (key === "topicsList") {
            if (items.some(t => t.name === value.name)) {
                alert("هذا العنصر موجود بالفعل");
                return;
            }
        } else {
            if (items.includes(value)) {
                alert("هذا العنصر موجود بالفعل");
                return;
            }
        }

        items.push(value);

        const db = await openDB();
        const tx = db.transaction(settingsStoreName, "readwrite");
        const store = tx.objectStore(settingsStoreName);

        store.put({ key: key, value: items });

        tx.oncomplete = () => {
            renderAll();
            showSaveStatus();
        };

        tx.onerror = (e) => {
            console.error("Transaction error:", e);
        };
    }

    // --- Event Listeners ---

    addTagBtn.addEventListener("click", () => {
        const val = newTagInput.value.trim();
        if (val) {
            addItem("tags", val);
            newTagInput.value = "";
        }
    });

    addCondemnBtn.addEventListener("click", () => {
        const val = newCondemnInput.value.trim();
        if (val) {
            addItem("condemnations", val);
            newCondemnInput.value = "";
        }
    });

    addTopicBtn.addEventListener("click", () => {
        const val = newTopicInput.value.trim();
        if (val) {
            // For topics, we need an ID. Let's start with a random one or incremental
            const newId = Date.now().toString();
            addItem("topicsList", { id: newId, name: val });
            newTopicInput.value = "";
        }
    });

    // --- GitHub Gist Config Logic ---
    const githubTokenInput = document.getElementById("github-token");
    const gistIdInput = document.getElementById("gist-id");
    const saveGistBtn = document.getElementById("save-gist-config-btn");

    // Load existing config
    async function loadGistConfig() {
        const token = await getSetting("github_token");
        const gistId = await getSetting("gist_id");
        if (token) githubTokenInput.value = token;
        if (gistId) gistIdInput.value = gistId;
    }

    saveGistBtn.addEventListener("click", async () => {
        const token = githubTokenInput.value.trim();
        const gistId = gistIdInput.value.trim();

        await setSetting("github_token", token);
        await setSetting("gist_id", gistId);

        showSaveStatus();
        alert("تم حفظ إعدادات GitHub بنجاح.");
    });

    await loadGistConfig();
});
