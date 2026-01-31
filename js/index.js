document.addEventListener("DOMContentLoaded", () => {
    const dateSelector = document.getElementById("date-selector");
    const descriptionDisplay = document.getElementById("description-display");
    const loadButton = document.getElementById("load-data-btn");
    const tagSelector = document.getElementById("tag-selector");
    const condemnationSelector = document.getElementById("condemnation-selector");
    const addNewEventBtn = document.getElementById("add-new-event-btn");
    const fileViewer = document.getElementById("file-viewer");
    const exportButton = document.getElementById("export-data-btn");
    const saveButton = document.getElementById("save-changes-btn");
    const fileLinksContainer = document.getElementById("file-links-container");
    const addLinkBtn = document.getElementById("add-link-btn");
    // saveStatus defined in db.js or locally? The HTML has #save-status.
    // We used a helper in db.js but here there is local logic too.
    // The local `showSaveStatus` overrides or works similarly.
    const saveStatus = document.getElementById("save-status");
    let eventsData = [];
    const condemnationDetailsWrapper = document.getElementById("condemnation-details-wrapper");
    const condemnationDescription = document.getElementById("condemnation-description");
    const copyDescriptionBtn = document.getElementById("copy-description-btn");
    const pasteDescriptionBtn = document.getElementById("paste-description-btn");
    const navSearchBtn = document.getElementById("nav-search-btn");
    // const dbName = "EventsDB"; // Defined in db.js
    const dateSelectionArea = document.getElementById("date-selection-area");
    const dateSelectorDiv = dateSelector.parentElement;
    const newDateEntry = document.getElementById("new-date-entry");
    const newDateInput = document.getElementById("new-date-input");
    const copyDateBtn = document.getElementById("copy-date-btn");
    // const storeName = "events"; // Defined in db.js

    // --- التحقق من استمرارية البيانات ---
    async function checkAndRequestPersistence() {
        if (navigator.storage && navigator.storage.persist) {
            let isPersisted = await navigator.storage.persisted();
            if (!isPersisted) {
                isPersisted = await navigator.storage.persist();
            }
            if (isPersisted) {
                console.log("تمكين وضع استمرارية البيانات بنجاح.");
            } else {
                console.warn("لم يتم تمكين وضع استمرارية البيانات.");
            }
        }
    }

    let autoSaveTimer = null;
    let isCreatingNew = false;

    // openDB is imported from db.js

    async function saveDataToDB(data) {
        try {
            const db = await openDB();
            const transaction = db.transaction(storeName, "readwrite");
            const store = transaction.objectStore(storeName);

            store.clear();

            const dataWithTags = data.map((item) => ({
                ...item,
                tag: item.tag || "",
                fileLink: Array.isArray(item.fileLink)
                    ? item.fileLink
                    : item.fileLink
                        ? [item.fileLink]
                        : [],
                condemnation: item.condemnation || "",
                condemnationDescription: item.condemnationDescription || "",
            }));

            dataWithTags.forEach((item) => {
                store.add(item);
            });

            return new Promise((resolve, reject) => {
                transaction.oncomplete = () => {
                    resolve();
                };
                transaction.onerror = (event) => {
                    alert("حدث خطأ أثناء حفظ البيانات.");
                    reject(event.target.error);
                };
            });
        } catch (error) {
            console.error("Failed to open DB:", error);
            alert("لا يمكن فتح قاعدة البيانات.");
        }
    }

    async function addNewRecordToDB(record) {
        try {
            const db = await openDB();
            const transaction = db.transaction(storeName, "readwrite");
            const store = transaction.objectStore(storeName);
            const request = store.add(record);

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    resolve(request.result);
                };
                request.onerror = (event) => {
                    alert("فشل إضافة الحدث الجديد.");
                    reject(event.target.error);
                };
            });
        } catch (error) {
            console.error("Failed to add record to DB:", error);
            alert("لا يمكن فتح قاعدة البيانات للإضافة.");
        }
    }

    async function updateRecordInDB(record) {
        try {
            const db = await openDB();
            const transaction = db.transaction(storeName, "readwrite");
            const store = transaction.objectStore(storeName);
            const request = store.put(record);

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    showSaveStatus();
                    resolve(request.result);
                };
                request.onerror = (event) => {
                    alert("فشل تحديث السجل.");
                    reject(event.target.error);
                };
            });
        } catch (error) {
            console.error("Failed to update record in DB:", error);
            alert("لا يمكن فتح قاعدة البيانات للتحديث.");
        }
    }

    function readDataFromDB(keepId = false) {
        return new Promise(async (resolve, reject) => {
            try {
                const db = await openDB();
                const transaction = db.transaction(storeName, "readonly");
                const store = transaction.objectStore(storeName);
                const request = store.getAll();

                request.onsuccess = () => {
                    if (keepId) {
                        resolve(request.result);
                    } else {
                        const cleanData = request.result.map(({ id, ...rest }) => rest);
                        resolve(cleanData);
                    }
                };
                request.onerror = (event) => reject(event.target.error);
            } catch (error) {
                reject(error);
            }
        });
    }

    // --- Event Listeners ---

    loadButton.addEventListener("click", async () => {
        try {
            const response = await fetch("./111.json");
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const fileData = await response.json();
            await saveDataToDB(fileData);
            await loadAndPopulateData();
            alert("تم التحديث بنجاح من الملف.");
        } catch (error) {
            console.error("Error loading or saving data:", error);
            alert("فشل تحميل أو حفظ البيانات.");
        }
    });

    exportButton.addEventListener("click", async () => {
        try {
            const dataFromDB = await readDataFromDB();
            if (!dataFromDB || dataFromDB.length === 0) {
                alert("لا توجد بيانات في قاعدة البيانات لتصديرها.");
                return;
            }

            const jsonString = JSON.stringify(dataFromDB, null, 2);
            const blob = new Blob([jsonString], { type: "application/json" });

            if (window.showSaveFilePicker) {
                try {
                    const handle = await window.showSaveFilePicker({
                        suggestedName: "111.json",
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
                a.download = "111.json";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error("Error exporting data:", error);
            alert("فشل تصدير البيانات من IndexedDB.");
        }
    });

    addNewEventBtn.addEventListener("click", () => {
        isCreatingNew = true;
        dateSelector.value = "";
        descriptionDisplay.value = "";
        tagSelector.value = "";
        clearAndAddOneLinkInput();
        condemnationSelector.value = "";
        newDateInput.value = "";

        dateSelectorDiv.style.display = "none";
        newDateEntry.style.display = "block";

        descriptionDisplay.readOnly = false;
        tagSelector.disabled = false;
        condemnationSelector.disabled = false;

        saveButton.style.display = "block";
        saveButton.textContent = "حفظ الحدث الجديد";
    });

    saveButton.addEventListener("click", async () => {
        const selectedIndex = dateSelector.value;
        isCreatingNew = false;

        if (newDateEntry.style.display === "block") {
            const newDateValue = newDateInput.value;
            if (!newDateValue || descriptionDisplay.value.trim() === "") {
                alert("يرجى إدخال تاريخ صحيح وملء الوصف.");
                return;
            }
            const [year, month, day] = newDateValue.split("-");
            const formattedDate = `${day}-${month}-${year}`;

            const fileLinks = Array.from(
                fileLinksContainer.querySelectorAll("input")
            )
                .map((input) => input.value.trim())
                .filter((link) => link !== "");
            const newEvent = {
                date: formattedDate,
                description: descriptionDisplay.value,
                tag: tagSelector.value,
                fileLink: fileLinks,
                condemnation: condemnationSelector.value,
                condemnationDescription: condemnationDescription.value,
            };
            await addNewRecordToDB(newEvent);
            await loadAndPopulateData();
            showSaveStatus();
            resetToSelectionMode();
        } else {
            if (selectedIndex === "") {
                alert("يرجى اختيار حدث أولاً لحفظ التعديلات.");
                return;
            }
            const recordToUpdate = eventsData[selectedIndex];
            if (recordToUpdate) {
                const fileLinks = Array.from(
                    fileLinksContainer.querySelectorAll("input")
                )
                    .map((input) => input.value.trim())
                    .filter((link) => link !== "");

                recordToUpdate.description = descriptionDisplay.value;
                recordToUpdate.tag = tagSelector.value;
                recordToUpdate.fileLink = fileLinks;
                recordToUpdate.condemnation = condemnationSelector.value;
                recordToUpdate.condemnationDescription =
                    condemnationDescription.value;
                await updateRecordInDB(recordToUpdate);
            } else {
                alert("لم يتم العثور على السجل لتحديثه. قد تحتاج إلى إعادة تحميل البيانات.");
            }
        }
    });

    copyDateBtn.addEventListener("click", () => {
        const selectedOption =
            dateSelector.options[dateSelector.selectedIndex];
        if (selectedOption && selectedOption.value !== "") {
            const dateToCopy = selectedOption.textContent;
            navigator.clipboard
                .writeText(dateToCopy)
                .then(() => {
                    const originalText = copyDateBtn.textContent;
                    copyDateBtn.textContent = "تم النسخ!";
                    setTimeout(() => {
                        copyDateBtn.textContent = originalText;
                    }, 1500);
                })
                .catch((err) => {
                    console.error("Failed to copy date: ", err);
                    alert("فشل نسخ التاريخ.");
                });
        }
    });

    copyDescriptionBtn.addEventListener("click", () => {
        const textToCopy = descriptionDisplay.value;
        if (textToCopy) {
            navigator.clipboard
                .writeText(textToCopy)
                .then(() => {
                    const originalText = copyDescriptionBtn.textContent;
                    copyDescriptionBtn.textContent = "تم النسخ!";
                    setTimeout(() => {
                        copyDescriptionBtn.textContent = originalText;
                    }, 1500);
                })
                .catch((err) => {
                    console.error("Failed to copy text: ", err);
                });
        }
    });

    pasteDescriptionBtn.addEventListener("click", async () => {
        if (!navigator.clipboard.readText) {
            alert("متصفحك لا يدعم لصق النص من الحافظة تلقائيًا.");
            return;
        }
        try {
            const textToPaste = await navigator.clipboard.readText();
            descriptionDisplay.value = textToPaste;
            triggerAutoSave();
        } catch (err) {
            console.error("Failed to read clipboard contents: ", err);
        }
    });

    navSearchBtn.addEventListener("click", (e) => {
        const urlParams = new URLSearchParams(window.location.search);
        const eventId = urlParams.get("eventId");

        if (!eventId) {
            sessionStorage.removeItem("searchQuery");
            sessionStorage.removeItem("searchTag");
            sessionStorage.removeItem("searchCondemnation");
            sessionStorage.removeItem("scrollPosition");
        }
    });

    addLinkBtn.addEventListener("click", () => {
        addLinkInput("", true);
    });

    function addLinkInput(value = "") {
        const inputGroup = document.createElement("div");
        inputGroup.className = "link-input-group";

        const newInput = document.createElement("input");
        newInput.type = "text";
        newInput.placeholder = "ادخل رابط الملف هنا...";
        newInput.value = value;
        newInput.style.flexGrow = "1";
        newInput.addEventListener("input", () => {
            triggerAutoSave();
        });

        const viewBtn = document.createElement("button");
        const newIndex =
            fileLinksContainer.querySelectorAll(".link-input-group").length + 1;
        viewBtn.textContent = `عرض ${newIndex}`;
        viewBtn.onclick = () => {
            displayFile(newInput.value);
            document
                .querySelectorAll(".link-input-group button")
                .forEach((btn) => btn.classList.remove("active"));
            viewBtn.classList.add("active");
        };

        const removeBtn = document.createElement("button");
        removeBtn.textContent = "إزالة";
        removeBtn.onclick = () => {
            if (confirm("هل أنت متأكد من أنك تريد حذف هذا الرابط؟")) {
                inputGroup.remove();
                triggerAutoSave();
            }
        };

        inputGroup.appendChild(newInput);
        inputGroup.appendChild(viewBtn);
        inputGroup.appendChild(removeBtn);
        fileLinksContainer.appendChild(inputGroup);
    }

    // --- UI Logic ---
    async function loadAndPopulateData() {
        try {
            const dbData = await readDataFromDB(true);
            if (dbData && dbData.length > 0) {
                eventsData = dbData;
            } else {
                const response = await fetch("./111.json");
                if (!response.ok) throw new Error("File not found");
                const fileData = await response.json();
                await saveDataToDB(fileData);
                eventsData = await readDataFromDB(true);
            }

            const urlParams = new URLSearchParams(window.location.search);
            const eventIdToSelect = urlParams.get("eventId");

            if (eventIdToSelect) {
                const originalIndex = eventsData.findIndex(
                    (event) => event.id == eventIdToSelect
                );
                if (originalIndex !== -1) {
                    setTimeout(() => {
                        dateSelector.value = originalIndex;
                        dateSelector.dispatchEvent(new Event("change"));
                    }, 100);
                }
            }
            populateDropdown(eventsData);
        } catch (error) {
            console.error("Could not fetch events data:", error);
            descriptionDisplay.value =
                "فشل في تحميل البيانات. حاول تحميلها من الملف أولاً.";
        }
    }

    function populateDropdown(data) {
        dateSelector.innerHTML =
            '<option value="">-- يرجى اختيار تاريخ لعرض الوصف --</option>';

        const sortedData = data
            .map((item, index) => {
                const [day, month, year] = item.date.split("-");
                const formattedDate = `${year}-${month.padStart(
                    2,
                    "0"
                )}-${day.padStart(2, "0")}`;
                return {
                    ...item,
                    originalIndex: index,
                    sortableDate: formattedDate,
                };
            })
            .sort((a, b) => a.sortableDate.localeCompare(b.sortableDate));

        sortedData.forEach((item) => {
            const option = document.createElement("option");
            option.value = item.originalIndex;
            option.textContent = item.date;
            dateSelector.appendChild(option);
        });
    }

    dateSelector.addEventListener("change", (event) => {
        const selectedIndex = event.target.value;
        resetToSelectionMode();
        saveButton.style.display = "none";
        fileViewer.style.display = "none";
        fileViewer.src = "about:blank";
        fileLinksContainer.innerHTML = "";

        if (selectedIndex !== "") {
            const selectedEvent = eventsData[selectedIndex];
            descriptionDisplay.value = selectedEvent.description;
            tagSelector.value = selectedEvent.tag || "";
            condemnationSelector.value = selectedEvent.condemnation || "";
            condemnationDescription.value =
                selectedEvent.condemnationDescription || "";

            handleCondemnationChange();

            const links = Array.isArray(selectedEvent.fileLink)
                ? selectedEvent.fileLink
                : [];

            if (links.length > 0) {
                links.forEach((link, index) => {
                    addLinkInputWithView(link, index);
                });
            } else {
                addLinkInput();
            }

            descriptionDisplay.readOnly = false;
            tagSelector.disabled = false;
            condemnationSelector.disabled = false;
        } else {
            descriptionDisplay.value = "";
            tagSelector.value = "";
            condemnationSelector.value = "";
            condemnationDescription.value = "";
            handleCondemnationChange();
            descriptionDisplay.readOnly = true;
            tagSelector.disabled = true;
            condemnationSelector.disabled = true;
            clearAndAddOneLinkInput();
        }
    });

    function addLinkInputWithView(link, index) {
        const inputGroup = document.createElement("div");
        inputGroup.className = "link-input-group";

        const newInput = document.createElement("input");
        newInput.type = "text";
        newInput.placeholder = "ادخل رابط الملف هنا...";
        newInput.value = link;
        newInput.style.flexGrow = "1";
        newInput.addEventListener("input", () => {
            triggerAutoSave();
        });

        const viewBtn = document.createElement("button");
        viewBtn.textContent = `عرض ${index + 1}`;
        viewBtn.onclick = () => {
            displayFile(newInput.value);
            document
                .querySelectorAll(".link-input-group button")
                .forEach((btn) => btn.classList.remove("active"));
            viewBtn.classList.add("active");
        };

        const removeBtn = document.createElement("button");
        removeBtn.textContent = "إزالة";
        removeBtn.onclick = () => {
            if (confirm("هل أنت متأكد من أنك تريد حذف هذا الرابط؟")) {
                inputGroup.remove();
                triggerAutoSave();
            }
        };

        const downloadBtn = document.createElement("button");
        downloadBtn.textContent = "تحميل";
        downloadBtn.onclick = () => {
            const link = newInput.value.trim();
            if (!link) {
                alert("الرابط فارغ.");
                return;
            }
            const driveRegex = /\/file\/d\/(.*?)\//;
            const match = link.match(driveRegex);
            if (match && match[1]) {
                const fileId = match[1];
                const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
                window.open(downloadUrl, "_blank");
            } else {
                window.open(link, "_blank");
            }
        };

        inputGroup.appendChild(newInput);
        inputGroup.appendChild(viewBtn);
        inputGroup.appendChild(downloadBtn);
        inputGroup.appendChild(removeBtn);
        fileLinksContainer.appendChild(inputGroup);
    }

    function displayFile(link) {
        const driveRegex = /\/file\/d\/(.*?)\//;
        const match = link.match(driveRegex);
        if (match && match[1]) {
            const fileId = match[1];
            fileViewer.src = `https://drive.google.com/file/d/${fileId}/preview`;
            fileViewer.style.display = "block";
        } else {
            fileViewer.src = "about:blank";
            fileViewer.style.display = "none";
        }
    }

    function clearAndAddOneLinkInput() {
        fileLinksContainer.innerHTML = "";
        addLinkInput();
    }

    function resetToSelectionMode() {
        isCreatingNew = false;
        dateSelectorDiv.style.display = "block";
        newDateEntry.style.display = "none";
        saveButton.style.display = "none";
        saveButton.textContent = "حفظ التعديلات";
    }

    function triggerAutoSave() {
        clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(async () => {
            if (isCreatingNew) {
                const newDateValue = newDateInput.value;
                if (newDateValue && descriptionDisplay.value.trim() !== "") {
                    await saveButton.click();
                }
            } else if (dateSelector.value !== "") {
                const selectedIndex = dateSelector.value;
                const recordToUpdate = eventsData[selectedIndex];
                if (recordToUpdate) {
                    const fileLinks = Array.from(
                        fileLinksContainer.querySelectorAll("input")
                    )
                        .map((input) => input.value.trim())
                        .filter((link) => link !== "");

                    recordToUpdate.description = descriptionDisplay.value;
                    recordToUpdate.tag = tagSelector.value;
                    recordToUpdate.fileLink = fileLinks;
                    recordToUpdate.condemnation = condemnationSelector.value;
                    recordToUpdate.condemnationDescription =
                        condemnationDescription.value;
                    await updateRecordInDB(recordToUpdate);
                }
            }
        }, 500);
    }

    function showSaveStatus() {
        saveStatus.textContent = "تم الحفظ تلقائيًا...";
        saveStatus.style.opacity = 1;
        setTimeout(() => {
            saveStatus.style.opacity = 0;
        }, 1000);
    }

    [
        descriptionDisplay,
        tagSelector,
        condemnationSelector,
        newDateInput,
        condemnationDescription,
    ].forEach((element) => {
        if (element.tagName.toLowerCase() === "select") {
            element.addEventListener("change", triggerAutoSave);
        } else {
            element.addEventListener("input", triggerAutoSave);
        }
    });

    condemnationSelector.addEventListener(
        "change",
        handleCondemnationChange
    );

    function handleCondemnationChange() {
        if (condemnationSelector.value) {
            condemnationDetailsWrapper.style.display = "block";
        } else {
            condemnationDetailsWrapper.style.display = "none";
        }
    }

    loadAndPopulateData();
    checkAndRequestPersistence();

    saveButton.style.display = "none";
});
