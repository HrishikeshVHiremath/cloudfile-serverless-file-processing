
const API_URL = "https://174qqo8xjb.execute-api.ap-south-1.amazonaws.com";
let apiToken = "";

document.getElementById("saveToken").addEventListener("click", () => {
    const enteredToken = document.getElementById("apiToken").value.trim();
    const status = document.getElementById("authStatus");

    if (!enteredToken) {
        status.textContent = "Please enter your access token.";
        return;
    }

    apiToken = enteredToken;
    status.textContent = "Connected — token stored in memory.";
    document.getElementById("apiToken").value = "";
});

const fileInput = document.getElementById("fileInput");
const selectedFile = document.getElementById("selectedFile");
const uploadButton = document.getElementById("uploadButton");
const result = document.getElementById("result");
const dropZone = document.getElementById("dropZone");

// Select a file
fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];

    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".txt")) {
        result.textContent = "Please select a TXT file.";
        fileInput.value = "";
        selectedFile.textContent = "No file selected";
        return;
    }

    if (file.size > 100 * 1024) {
        result.textContent = "File exceeds the 100 KB limit.";
        fileInput.value = "";
        selectedFile.textContent = "No file selected";
        return;
    }

    selectedFile.textContent = `Selected: ${file.name}`;
    result.textContent = "";
});

// Drag and drop
dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropZone.classList.add("drag-over");
});

dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("drag-over");
});

dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropZone.classList.remove("drag-over");

    const file = event.dataTransfer.files[0];

    if (!file) return;

    const transfer = new DataTransfer();
    transfer.items.add(file);
    fileInput.files = transfer.files;
    fileInput.dispatchEvent(new Event("change"));
});

// Upload and process
uploadButton.addEventListener("click", async () => {
    const file = fileInput.files[0];

    if (!file) {
        result.textContent = "Please select a TXT file first.";
        return;
    }

    if (!apiToken) {
        result.textContent = "Please connect using your access token first.";
        return;
    }

    uploadButton.disabled = true;
    uploadButton.textContent = "Processing...";
    result.textContent = "Uploading your file to AWS...";

    try {
        const content = await file.text();

        const response = await fetch(`${API_URL}/process`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": apiToken
            },
            body: JSON.stringify({
                file_name: file.name,
                file_content: content
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `Request failed: ${response.status}`);
        }

        result.innerHTML = `
            <strong style="color:#27e0cf;">File processed successfully!</strong>
            <p>File ID: ${escapeHTML(data.file_id || "Not returned")}</p>
            <p>Words: ${escapeHTML(data.word_count ?? "--")}</p>
            <p>Characters: ${escapeHTML(data.character_count ?? "--")}</p>
            <p>Status: ${escapeHTML(data.status || "Processed")}</p>
        `;

        await loadHistory();

    } catch (error) {
        result.textContent = `Error: ${error.message}`;
    } finally {
        uploadButton.disabled = false;
        uploadButton.textContent = "Process File";
    }
});

// Prevent API-returned text from being interpreted as HTML
function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

function showFileDetails(file) {
    const panel = document.getElementById("fileDetails");
    const content = document.getElementById("fileDetailsContent");

    content.innerHTML = "";

    const details = [
        ["File Name", file.file_name],
        ["File ID", file.file_id],
        ["Status", file.status || "Processed"],
        ["Word Count", file.word_count],
        ["Character Count", file.character_count],
        ["Uploaded At", file.uploaded_at
            ? new Date(file.uploaded_at).toLocaleString("en-IN")
            : "Date unavailable"],
        ["S3 Bucket", file.bucket_name],
        ["S3 Key", file.s3_key]
    ];

    details.forEach(([label, value]) => {
        const row = document.createElement("div");
        row.className = "detail-row";

        const labelElement = document.createElement("span");
        labelElement.className = "detail-label";
        labelElement.textContent = label;

        const valueElement = document.createElement("span");
        valueElement.className = "detail-value";
        valueElement.textContent = value ?? "Not available";

        row.append(labelElement, valueElement);
        content.appendChild(row);
    });

    panel.hidden = false;
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

document.getElementById("closeDetails").addEventListener("click", () => {
    document.getElementById("fileDetails").hidden = true;
});

// Load recent files from DynamoDB through API Gateway

async function loadHistory() {
    const recentFiles = document.getElementById("recentFiles");

    try {
        if (!apiToken) {
            recentFiles.textContent = "Connect using your access token to view recent files.";
            return;
        }

        const response = await fetch(`${API_URL}/metadata`, {
            headers: {
                "Authorization": apiToken
            }
        });

        if (!response.ok) {
            throw new Error(`Request failed: ${response.status}`);
        }

        const files = await response.json();

        if (!Array.isArray(files)) {
            throw new Error("Unexpected metadata response.");
        }

        // Dashboard statistics
        document.getElementById("totalFiles").textContent = files.length;

        const totalWords = files.reduce(
            (sum, file) => sum + (Number(file.word_count) || 0), 0
        );

        document.getElementById("totalWords").textContent =
            totalWords.toLocaleString();

        // Clear previous history
        recentFiles.innerHTML = "";

        if (files.length === 0) {
            recentFiles.textContent = "No files processed yet.";
            return;
        }

        // Display the six newest files
        files.slice(0, 6).forEach(file => {
            const item = document.createElement("div");
            item.className = "file-item";
            
            item.addEventListener("click", () => {
                showFileDetails(file);
            });

            const name = document.createElement("h3");
            name.textContent = file.file_name || "Unnamed file";

            const details = document.createElement("p");
            details.textContent =
                `${file.word_count ?? 0} words · ${file.character_count ?? 0} characters`;

            const status = document.createElement("p");
            status.className = "file-status";
            status.textContent = file.status || "Processed";

            const date = document.createElement("p");
            date.className = "file-date";

            if (file.uploaded_at) {
                date.textContent = new Date(file.uploaded_at).toLocaleString(
                    "en-IN",
                    {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true
                    }
                );
            } else {
                date.textContent = "Date unavailable";
            }

            item.append(name, details, status, date);
            recentFiles.appendChild(item);
        });

    } catch (error) {
        recentFiles.textContent =
            `Could not load history: ${error.message}`;
    }
}

// Load history when the page opens
loadHistory();

