document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("search-input");
    const searchBtn = document.getElementById("search-btn");
    const resultsContainer = document.getElementById("results-container");
    const resultsInfo = document.getElementById("results-info");
    const tagFilter = document.getElementById("tag-filter");
    const condemnationFilter = document.getElementById("condemnation-filter");
    const navBackToMainBtn = document.getElementById("nav-back-to-main-btn");

    // const dbName = "EventsDB"; // Defined in db.js
    // const storeName = "events"; // Defined in db.js

    // openDB is imported from db.js

    function normalizeArabic(text) {
        if (!text) return "";
        return text
            .normalize("NFD")
            .replace(/[\u064B-\u065F\u0670]/g, "") // إزالة التشكيل والتنوين
            .replace(/[أإآ]/g, "ا") // توحيد الهمزات على الألف
            .replace(/ؤ/g, "و") // توحيد الهمزة على الواو
            .replace(/ئ/g, "ي") // توحيد الهمزة على الياء
            .replace(/ة/g, "ه"); // توحيد التاء المربوطة
    }

    async function searchInDB(query, tag, condemnation) {
        const db = await openDB();
        const transaction = db.transaction(storeName, "readonly");
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                const allData = request.result;
                if (!query && !tag && !condemnation) {
                    resolve([]);
                    return;
                }
                const normalizedQuery = normalizeArabic(query.toLowerCase());

                const results = allData.filter((item) => {
                    const textMatch =
                        !query ||
                        normalizeArabic(item.description?.toLowerCase()).includes(
                            normalizedQuery
                        ) ||
                        item.date?.toLowerCase().includes(normalizedQuery) ||
                        normalizeArabic(
                            item.condemnationDescription?.toLowerCase()
                        ).includes(normalizedQuery);

                    const tagMatch = !tag || (item.tag || "") === tag;

                    const condemnationMatch =
                        !condemnation || (item.condemnation || "") === condemnation;

                    return textMatch && tagMatch && condemnationMatch;
                });

                resolve(results);
            };
            request.onerror = (event) => reject(event.target.error);
        });
    }

    function highlightText(text, query) {
        if (!query || !text) {
            return text;
        }
        const normalizedQuery = normalizeArabic(query.toLowerCase());
        const trimmedQuery = normalizedQuery.trim();

        if (trimmedQuery === "") {
            return text;
        }

        const diacritics = "[\\u064B-\\u065F\\u0670]*";
        const regexPattern = trimmedQuery
            .split("")
            .map((char) => {
                switch (char) {
                    case "ا":
                        return "[أإآا]";
                    case "ي":
                        return "[يئ]";
                    case "و":
                        return "[وؤ]";
                    case "ه":
                        return "[هة]";
                    default:
                        return char;
                }
            })
            .join(diacritics);
        const regex = new RegExp(`(${regexPattern})`, "gi");

        return text.replace(regex, "<mark>$&</mark>");
    }

    function displayResults(results) {
        resultsContainer.innerHTML = "";
        resultsInfo.style.display = "none";

        if (results.length === 0) {
            resultsContainer.innerHTML = "<p>لم يتم العثور على نتائج.</p>";
            return;
        }

        resultsInfo.textContent = `تم العثور على ${results.length} نتائج.`;
        resultsInfo.style.display = "block";

        const query = searchInput.value.trim();

        results.sort(
            (a, b) =>
                new Date(b.date.split("-").reverse().join("-")) -
                new Date(a.date.split("-").reverse().join("-"))
        );

        results.forEach((item) => {
            const resultDiv = document.createElement("div");
            resultDiv.className = "result-item";

            const goToEventBtn = document.createElement("button");
            goToEventBtn.textContent = "الانتقال للحدث";
            goToEventBtn.className = "button go-to-event-btn";
            goToEventBtn.onclick = () => {
                sessionStorage.setItem("scrollPosition", window.scrollY);
                window.location.href = `index.html?eventId=${item.id}`;
            };

            const highlightedDescription = highlightText(item.description, query);

            resultDiv.innerHTML = `
            <div class="date">التاريخ: ${item.date || "غير محدد"}</div>
            <div class="description">${highlightedDescription || "لا يوجد وصف."
                }</div>
            <div class="result-meta">
              <div>قوة الملف: <span>${item.tag || "لا اعرف"}</span></div>
              <div>الإدانة: <span>${item.condemnation || "لا يوجد"}</span></div>
            </div>
          `;

            resultDiv.insertBefore(goToEventBtn, resultDiv.firstChild);
            resultsContainer.appendChild(resultDiv);
        });
    }

    async function performSearch() {
        const query = searchInput.value.trim();
        const tag = tagFilter.value;
        const condemnation = condemnationFilter.value;
        const results = await searchInDB(query, tag, condemnation);

        sessionStorage.setItem("searchQuery", query);
        sessionStorage.setItem("searchTag", tag);
        sessionStorage.setItem("searchCondemnation", condemnation);

        displayResults(results);
    }

    searchBtn.addEventListener("click", performSearch);
    searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            performSearch();
        }
    });
    tagFilter.addEventListener("change", performSearch);
    condemnationFilter.addEventListener("change", performSearch);

    navBackToMainBtn.addEventListener("click", (e) => {
        e.preventDefault();
        sessionStorage.removeItem("searchQuery");
        sessionStorage.removeItem("searchTag");
        sessionStorage.removeItem("searchCondemnation");
        sessionStorage.removeItem("scrollPosition");
        window.location.href = "index.html";
    });

    async function restoreStateAndSearch() {
        const savedQuery = sessionStorage.getItem("searchQuery");
        const savedTag = sessionStorage.getItem("searchTag");
        const savedCondemnation = sessionStorage.getItem("searchCondemnation");
        const savedScroll = sessionStorage.getItem("scrollPosition");

        if (savedQuery !== null || savedTag !== "" || savedCondemnation !== "") {
            searchInput.value = savedQuery || "";
            tagFilter.value = savedTag || "";
            condemnationFilter.value = savedCondemnation || "";

            await performSearch();

            if (savedScroll) {
                setTimeout(() => window.scrollTo(0, parseInt(savedScroll, 10)), 100);
            }
        } else {
            searchInput.focus();
        }
    }

    async function populateFilterOptions() {
        const tags = await getSetting("tags");
        tagFilter.innerHTML = '<option value="">الكل</option>';
        if (tags) {
            tags.forEach(tag => {
                const opt = document.createElement("option");
                opt.value = tag;
                opt.textContent = tag;
                tagFilter.appendChild(opt);
            });
        }

        const condemnations = await getSetting("condemnations");
        condemnationFilter.innerHTML = '<option value="">الكل</option>';
        if (condemnations) {
            condemnations.forEach(c => {
                const opt = document.createElement("option");
                opt.value = c;
                opt.textContent = c;
                condemnationFilter.appendChild(opt);
            });
        }
    }

    // Call populate before restoring state
    await populateFilterOptions();
    restoreStateAndSearch();
});
