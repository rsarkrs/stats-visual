// Function to convert table data to CSV string
function convertTableToCSV() {
    const table = document.getElementById('outputTable');
    const rows = table.querySelectorAll('tr');
    let csv = [];

    // Loop through rows
    rows.forEach(row => {
        const rowData = [];
        const cols = row.querySelectorAll('td, th');

        // Loop through columns
        cols.forEach(col => {
            rowData.push(col.innerText.trim());
        });

        // Combine columns into a CSV row
        csv.push(rowData.join(','));
    });

    // Combine CSV rows into a CSV string
    return csv.join('\n');
}

// Function to download CSV file
function downloadCSV(csvData) {
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'table_data.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Event listener for export button
const exportBtn = document.getElementById('exportBtn');
exportBtn.addEventListener('click', () => {
    const csvData = convertTableToCSV();
    downloadCSV(csvData);
});