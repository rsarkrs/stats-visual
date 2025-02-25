// Function to populate the dropdown list
function populateName() {
    var nameInput = document.getElementById('nameInput');
    var nameSuggestions = document.getElementById('nameSuggestions');
    var ddSeasons = document.getElementById('seasons');
    var ddRace = document.getElementById('race');

    // Fetch the CSV file containing the names
    fetch('gnl.csv')
        .then(response => response.text())
        .then(csvText => {
            // Parse the CSV text using Papaparse.js
            var csvData = Papa.parse(csvText, { header: false, skipEmptyLines: true });
            var names = csvData.data;

            // Skip the first row (header row)
            names.shift();

            // Populate the datalist with the names
            names.forEach(name => {
                var option = document.createElement('option');
                option.value = name[0];
                nameSuggestions.appendChild(option);
            });
        })
        .catch(error => {
            console.error('Error fetching names:', error);
        });

    fetch('seasons.csv')
        .then(response => response.text())
        .then(csvText => {
            // Parse the CSV text using Papaparse.js
            var csvData = Papa.parse(csvText, {header: false, skipEmptyLines: true});
            var names = csvData.data;
            // Skip the first row (header row)
            names.shift();
            // Populate the dropdown list with the names
            names.forEach(name => {
                var option = document.createElement('option');
                option.text = name[0];                     
                ddSeasons.add(option);
            });
        })

    fetch('races.csv')
        .then(response => response.text())
        .then(csvText => {
            // Parse the CSV text using Papaparse.js
            var csvData = Papa.parse(csvText, {header: false, skipEmptyLines: true});
            var names = csvData.data;

            // Skip the first row (header row)
            names.shift();

            // Populate the dropdown list with the names
            names.forEach(name => {
                var option = document.createElement('option');
                option.text = name[0]; 
                ddRace.add(option);
            });
        })
    .catch(error => {
        console.error('Error fetching names:', error);
    });

}