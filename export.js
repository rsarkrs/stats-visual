function escapeCSVValue(value) {
    const normalized = String(value ?? '').replace(/\r?\n|\r/g, ' ').trim();
    return '"' + normalized.replace(/"/g, '""') + '"';
}

// Function to convert table data to CSV string
function convertTableToCSV(tableId) {
    const table = document.getElementById(tableId);
    const rows = table.querySelectorAll('tr');
    let csv = [];

    // Loop through rows
    rows.forEach(row => {
        const rowData = [];
        const cols = row.querySelectorAll('td, th');

        // Loop through columns
        cols.forEach(col => {
            rowData.push(escapeCSVValue(col.innerText));
        });

        // Combine columns into a CSV row
        csv.push(rowData.join(','));
    });

    // Combine CSV rows into a CSV string
    return csv.join('\n');
}

// Function to download CSV file
function downloadCSV(csvData, filename) {
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function buildExportFilename(prefix) {
    const timestamp = new Date().toISOString().replace(/[:]/g, '-').replace(/\..+/, '');
    return `${prefix}_${timestamp}.csv`;
}

// Event listener for export button
const exportBtn = document.getElementById('exportBtn');
exportBtn.addEventListener('click', () => {
    const csvData = convertTableToCSV('outputTable');
    downloadCSV(csvData, buildExportFilename('table1_summary'));
});

// Event listener for export button
const exportBtn2 = document.getElementById('exportBtn2');
exportBtn2.addEventListener('click', () => {
    const csvData = convertTableToCSV('intervalTableHtml');
    downloadCSV(csvData, buildExportFilename('table2_interval'));
});
