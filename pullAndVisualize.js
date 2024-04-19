async function pullAndVisualize() {
    //Function to pull games and calculate player stats
    async function stats() {
        var tag = document.getElementById('nameList').value;
        var battleTag = tag.replace("#", "%23")
        var raceid;
        var table = document.getElementById('outputTable');
        var season_check = document.getElementById('seasons').value
        var race_check = document.getElementById('race').value

        if (season_check == 'All') {
            var season_variable = [
                '1',
                '2',
                '3',
                '4',
                '5',
                '6',
                '7',
                '8',
                '9',
                '10',
                '11',
                '12',
                '13',
                '14',
                '15',
                '16',
                '17',
                '18'
            ];
        } else {
            var season_variable = [season_check];
        }

        if (race_check == 'All') {
            var race = ['Random', 'Human', 'Night Elf', 'Orc', 'Undead'];
        } else {
            var race = [race_check];
        }

        function dupTableCheck(tableTemp, tagTemp, seasonTemp, raceTemp) {   
            // Extract data from the table
            for (var i = tableTemp.rows.length - 1; i > 0; i--) {
                console.log(i);
                console.log(tableTemp.rows.length);
                var row = tableTemp.rows[i];
                var name = row.cells[0].textContent;
                var season = row.cells[1].textContent; 
                var race = row.cells[2].textContent;
                console.log(season);
                console.log(race);
                if (name != tagTemp || (seasonTemp.includes(season) && raceTemp.includes(race))) {
                    tableTemp.deleteRow(i);
                }
            }
            return;
        }

        if (table.rows.length > 0) {
            dupTableCheck(table, tag, season_variable, race);
        }

        // hide the table
        document.getElementById('outputTable').style.display = 'none';
        // Show loading spinner before executing the main logic
        document.getElementById('loadingSpinner').style.display = 'block';

        //loop through all match pages
        for (let season_var of season_variable) {
            var offset = 0;
            var elf_records = [];
            var ud_records = [];
            var hu_records = [];
            var orc_records = [];
            var rd_records = [];
            var elf_mmr = [];
            var ud_mmr = [];
            var hu_mmr = [];
            var orc_mmr = [];
            var rd_mmr = [];
            while (offset != -1) {
            var url = 'https://website-backend.w3champions.com/api/matches/search?playerId=' + 
                battleTag + '&gateway=20&offset=' + offset.toString() + '&pageSize=50&season=' + season_var.toString();
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                const rawdata = await response.json();
                if (rawdata["matches"].length < 50) {
                    offset = -1
                } else {
                    offset += 50;
                }
                
                function meetsCondition(record, raceid, pname) {
                    var player_record = [];
                    var race_record = [];
                    var mmr = [];
                    record.teams.forEach(function(team) {
                        team.players.forEach(function(player) {
                            player_record.push(player.battleTag);
                            race_record.push(player.race);
                            mmr.push(player.oldMmr);
                        })
                    })
                    if (player_record[0].toLowerCase() == pname.toLowerCase() && race_record[0] == raceid) {
                        mmr = mmr[0];
                    } else {
                        mmr = mmr[1];
                    }
                    return [
                        record.gameMode == 1 && 
                        (
                            (player_record[0].toLowerCase() == pname.toLowerCase() && race_record[0] == raceid) || 
                            (player_record[1].toLowerCase() == pname.toLowerCase() && race_record[1] == raceid)
                        ), mmr]
                };
                // Create game_records variable that holds each solo with assigned race
                rawdata["matches"].forEach(function(record) {
                    race.forEach(function(race_record) {
                        switch(race_record) {
                            case 'Random':
                            raceid = 0
                            break;
                            case 'Human':
                            raceid = 1
                            break;
                            case 'Orc':
                            raceid = 2
                            break;
                            case 'Night Elf':
                            raceid = 4
                            break;
                            case 'Undead':
                            raceid = 8
                            break;
                            default:
                            raceid = -1
                            break;
                        }
                        var dummyVar = meetsCondition(record, raceid, tag)
                        if (dummyVar[0]) {
                            if (race_record == 'Random'){
                                rd_records.push(record)
                                rd_mmr.push(dummyVar[1])
                            } else if (race_record == 'Human') {
                                hu_records.push(record)
                                hu_mmr.push(dummyVar[1])
                            } else if (race_record == 'Night Elf') {
                                elf_records.push(record)
                                elf_mmr.push(dummyVar[1])
                            } else if (race_record == 'Orc') {
                                orc_records.push(record)
                                orc_mmr.push(dummyVar[1])
                            } else if (race_record == 'Undead') {
                                ud_records.push(record)
                                ud_mmr.push(dummyVar[1])
                            }
                        }
                    });
                });
                
                
                } catch (error) {
                    console.log(error);
                    offset = -1; // Stop the loop on error
                }
            }
            var rd_mmr_sum = 0;
            var rd_mmr_floor = 5000;
            var rd_mmr_roof = 0;
            var rd_mmr_avg = 0;
        
            var ne_mmr_sum = 0;
            var ne_mmr_floor = 5000;
            var ne_mmr_roof = 0;
            var ne_mmr_avg = 0;
            var hu_mmr_sum = 0;
            var hu_mmr_floor = 5000;
            var hu_mmr_roof = 0;
            var hu_mmr_avg = 0;
            var orc_mmr_sum = 0;
            var orc_mmr_floor = 5000;
            var orc_mmr_roof = 0;
            var orc_mmr_avg = 0;
            var ud_mmr_sum = 0;
            var ud_mmr_floor = 5000;
            var ud_mmr_roof = 0;
            var ud_mmr_avg = 0;
            
            //loop through game_records to calculate avg, floor, max, and standard deviation
            rd_mmr.forEach(function(metrics) {
                rd_mmr_sum += metrics;
                rd_mmr_floor = Math.min(metrics, rd_mmr_floor);
                rd_mmr_roof = Math.max(metrics, rd_mmr_roof);
            })
            hu_mmr.forEach(function(metrics) {
                hu_mmr_sum += metrics;
                hu_mmr_floor = Math.min(metrics, hu_mmr_floor);
                hu_mmr_roof = Math.max(metrics, hu_mmr_roof);
            })
            elf_mmr.forEach(function(metrics) {
                ne_mmr_sum += metrics;
                ne_mmr_floor = Math.min(metrics, ne_mmr_floor);
                ne_mmr_roof = Math.max(metrics, ne_mmr_roof);
            })
            orc_mmr.forEach(function(metrics) {
                orc_mmr_sum += metrics;
                orc_mmr_floor = Math.min(metrics, orc_mmr_floor);
                orc_mmr_roof = Math.max(metrics, orc_mmr_roof);
            })
            ud_mmr.forEach(function(metrics) {
                ud_mmr_sum += metrics;
                ud_mmr_floor = Math.min(metrics, ud_mmr_floor);
                ud_mmr_roof = Math.max(metrics, ud_mmr_roof);
            })
            rd_mmr_avg = Math.round(rd_mmr_sum / rd_records.length);
            hu_mmr_avg = Math.round(hu_mmr_sum / hu_records.length);
            ne_mmr_avg = Math.round(ne_mmr_sum / elf_records.length);
            orc_mmr_avg = Math.round(orc_mmr_sum / orc_records.length);
            ud_mmr_avg = Math.round(ud_mmr_sum / ud_records.length);
            race.forEach(function(race_record) {
                if (race_record == 'Random'){
                    arrTable = [tag, season_var, race_record, rd_records.length, rd_mmr_avg, rd_mmr_floor, rd_mmr_roof];
                } else if (race_record == 'Human') {
                    arrTable = [tag, season_var, race_record, hu_records.length, hu_mmr_avg, hu_mmr_floor, hu_mmr_roof];
                } else if (race_record == 'Night Elf') {
                    arrTable = [tag, season_var, race_record, elf_records.length, ne_mmr_avg, ne_mmr_floor, ne_mmr_roof];
                } else if (race_record == 'Orc') {
                    arrTable = [tag, season_var, race_record, orc_records.length, orc_mmr_avg, orc_mmr_floor, orc_mmr_roof];
                } else if (race_record == 'Undead') {
                    arrTable = [tag, season_var, race_record, ud_records.length, ud_mmr_avg, ud_mmr_floor, ud_mmr_roof];
                }
                    //populate table
                if (arrTable[3] != 0) {
                    var outputTable = document.getElementById('outputTable').getElementsByTagName('tbody')[0];
                    var newRow = outputTable.insertRow();
                    var nameCell = newRow.insertCell(0);
                    var seasonCell = newRow.insertCell(1);
                    var raceCell = newRow.insertCell(2);
                    var gameCount = newRow.insertCell(3);
                    var avgCell = newRow.insertCell(4);
                    var minCell = newRow.insertCell(5);
                    var maxCell = newRow.insertCell(6);
                    nameCell.textContent = arrTable[0];
                    seasonCell.textContent = arrTable[1];
                    raceCell.textContent = arrTable[2];
                    gameCount.textContent = arrTable[3];
                    avgCell.textContent = arrTable[4];
                    minCell.textContent = arrTable[5];
                    maxCell.textContent = arrTable[6];
                }
            })       
        }
        // display the table
        document.getElementById('outputTable').style.display = 'table';
        // Hide the loading spinner once the processing is complete
        document.getElementById('loadingSpinner').style.display = 'none';
    }

    function visualizeData() {

        function visualizeAvg() {
            // Get the canvas element
            var canvas = document.getElementById('lineGraph');
            var ctx = canvas.getContext('2d');
    
            // Get the table data
            var table = document.getElementById('outputTable');
            var data = {};
            var labels = [];
    
            // Extract data from the table
            for (var i = 1; i < table.rows.length; i++) {
                var row = table.rows[i];
                var name = row.cells[0].textContent;
                var season = parseInt(row.cells[1].textContent); // Parse season as integer
                var race = row.cells[2].textContent;
                var avgMMR = parseFloat(row.cells[4].textContent); // Convert to float
    
                // Initialize data object for each race if not exists
                if (!data[race]) {
                    data[race] = {};
                }
    
                // Initialize data object for each player under the race if not exists
                if (!data[race][name]) {
                    data[race][name] = {};
                }
    
                // Add data to arrays
                if (!data[race][name][season]) {
                    data[race][name][season] = [];
                }
                data[race][name][season].push(avgMMR);
    
                // Add season to labels if not already present
                if (!labels.includes(season)) {
                    labels.push(season);
                }
            }
    
            // Define custom colors for each race
            var customColors = {
                "Orc": 'rgba(255, 99, 132, 1)', // Red
                "Night Elf": 'rgba(54, 162, 235, 1)', // Blue
                "Undead": 'rgba(255, 206, 86, 1)', // Yellow
                "Random": 'rgba(90, 34, 139, 1)', // Purple
                "Human": 'rgba(0, 255, 0, 1)', // Green
                // Add more colors as needed
            };
    
    
            // Create datasets for each race and player
            var datasets = [];
            for (var race in data) {
                if (data.hasOwnProperty(race)) {
                    for (var name in data[race]) {
                        if (data[race].hasOwnProperty(name)) {
                            var dataset = {
                                label: race + ' - ' + name,
                                data: [],
                                borderColor: customColors[race] || 'rgba(75, 192, 192, 1)', // Default color
                                borderWidth: 2,
                                fill: false,
                                pointStyle: 'circle', // Default marker style
                            };
                            for (var i = 0; i < labels.length; i++) {
                                var season = labels[i];
                                if (data[race][name][season]) {
                                    var avgMMR = data[race][name][season].reduce((a, b) => a + b, 0) / data[race][name][season].length;
                                    dataset.data.push(avgMMR);
                                } else {
                                    dataset.data.push(null); // Insert null for missing seasons
                                }
                            }
                            datasets.push(dataset);
                        }
                    }
                }
            }
    
            // Create line chart
            window.lineChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: datasets
                },
                options: {
                    scales: {
                        x: {
                            title: {
                                display: true,
                                text: 'Season'
                            }
                        },
                        y: {
                            title: {
                                display: true,
                                text: 'Average MMR'
                            },
                            beginAtZero: false
                        }
                    },
                    plugins: {
                        tooltip: {
                            mode: 'index',
                            intersect: false
                        },
                        legend: {
                            display: true,
                            position: 'bottom',
                            labels: {
                                boxWidth: 20
                            }
                        }
                    }
                }
            });
        }
    
        function visualizeMin() {
            // Get the canvas element
            var canvas = document.getElementById('lineGraph2');
            var ctx = canvas.getContext('2d');
    
            // Get the table data
            var table = document.getElementById('outputTable');
            var data = {};
            var labels = [];
    
            // Extract data from the table
            for (var i = 1; i < table.rows.length; i++) {
                var row = table.rows[i];
                var name = row.cells[0].textContent;
                var season = parseInt(row.cells[1].textContent); // Parse season as integer
                var race = row.cells[2].textContent;
                var minMMR = parseFloat(row.cells[5].textContent); // Convert to float
    
                // Initialize data object for each race if not exists
                if (!data[race]) {
                    data[race] = {};
                }
    
                // Initialize data object for each player under the race if not exists
                if (!data[race][name]) {
                    data[race][name] = {};
                }
    
                // Add data to arrays
                if (!data[race][name][season]) {
                    data[race][name][season] = [];
                }
                data[race][name][season].push(minMMR);
    
                // Add season to labels if not already present
                if (!labels.includes(season)) {
                    labels.push(season);
                }
            }
    
            // Define custom colors for each race
            var customColors = {
                "Orc": 'rgba(255, 99, 132, 1)', // Red
                "Night Elf": 'rgba(54, 162, 235, 1)', // Blue
                "Undead": 'rgba(255, 206, 86, 1)', // Yellow
                "Random": 'rgba(90, 34, 139, 1)', // Purple
                "Human": 'rgba(0, 255, 0, 1)', // Green
                // Add more colors as needed
            };
    
    
            // Create datasets for each race and player
            var datasets = [];
            for (var race in data) {
                if (data.hasOwnProperty(race)) {
                    for (var name in data[race]) {
                        if (data[race].hasOwnProperty(name)) {
                            var dataset = {
                                label: race + ' - ' + name,
                                data: [],
                                borderColor: customColors[race] || 'rgba(75, 192, 192, 1)', // Default color
                                borderWidth: 2,
                                fill: false,
                                pointStyle: 'circle', // Default marker style
                            };
                            for (var i = 0; i < labels.length; i++) {
                                var season = labels[i];
                                if (data[race][name][season]) {
                                    var minMMR = data[race][name][season].reduce((a, b) => a + b, 0) / data[race][name][season].length;
                                    dataset.data.push(minMMR);
                                } else {
                                    dataset.data.push(null); // Insert null for missing seasons
                                }
                            }
                            datasets.push(dataset);
                        }
                    }
                }
            }
    
            // Create line chart
            window.lineChart2 = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: datasets
                },
                options: {
                    scales: {
                        x: {
                            title: {
                                display: true,
                                text: 'Season'
                            }
                        },
                        y: {
                            title: {
                                display: true,
                                text: 'Min MMR'
                            },
                            beginAtZero: false
                        }
                    },
                    plugins: {
                        tooltip: {
                            mode: 'index',
                            intersect: false
                        },
                        legend: {
                            display: true,
                            position: 'bottom',
                            labels: {
                                boxWidth: 20
                            }
                        }
                    }
                }
            });
        }

        function visualizeMax() {
            // Get the canvas element
            var canvas = document.getElementById('lineGraph3');
            var ctx = canvas.getContext('2d');
    
            // Get the table data
            var table = document.getElementById('outputTable');
            var data = {};
            var labels = [];
    
            // Extract data from the table
            for (var i = 1; i < table.rows.length; i++) {
                var row = table.rows[i];
                var name = row.cells[0].textContent;
                var season = parseInt(row.cells[1].textContent); // Parse season as integer
                var race = row.cells[2].textContent;
                var maxMMR = parseFloat(row.cells[6].textContent); // Convert to float
    
                // Initialize data object for each race if not exists
                if (!data[race]) {
                    data[race] = {};
                }
    
                // Initialize data object for each player under the race if not exists
                if (!data[race][name]) {
                    data[race][name] = {};
                }
    
                // Add data to arrays
                if (!data[race][name][season]) {
                    data[race][name][season] = [];
                }
                data[race][name][season].push(maxMMR);
    
                // Add season to labels if not already present
                if (!labels.includes(season)) {
                    labels.push(season);
                }
            }
    
            // Define custom colors for each race
            var customColors = {
                "Orc": 'rgba(255, 99, 132, 1)', // Red
                "Night Elf": 'rgba(54, 162, 235, 1)', // Blue
                "Undead": 'rgba(255, 206, 86, 1)', // Yellow
                "Random": 'rgba(90, 34, 139, 1)', // Purple
                "Human": 'rgba(0, 255, 0, 1)', // Green
                // Add more colors as needed
            };
    
    
            // Create datasets for each race and player
            var datasets = [];
            for (var race in data) {
                if (data.hasOwnProperty(race)) {
                    for (var name in data[race]) {
                        if (data[race].hasOwnProperty(name)) {
                            var dataset = {
                                label: race + ' - ' + name,
                                data: [],
                                borderColor: customColors[race] || 'rgba(75, 192, 192, 1)', // Default color
                                borderWidth: 2,
                                fill: false,
                                pointStyle: 'circle', // Default marker style
                            };
                            for (var i = 0; i < labels.length; i++) {
                                var season = labels[i];
                                if (data[race][name][season]) {
                                    var maxMMR = data[race][name][season].reduce((a, b) => a + b, 0) / data[race][name][season].length;
                                    dataset.data.push(maxMMR);
                                } else {
                                    dataset.data.push(null); // Insert null for missing seasons
                                }
                            }
                            datasets.push(dataset);
                        }
                    }
                }
            }
    
            // Create line chart
            window.lineChart3 = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: datasets
                },
                options: {
                    scales: {
                        x: {
                            title: {
                                display: true,
                                text: 'Season'
                            }
                        },
                        y: {
                            title: {
                                display: true,
                                text: 'Max MMR'
                            },
                            beginAtZero: false
                        }
                    },
                    plugins: {
                        tooltip: {
                            mode: 'index',
                            intersect: false
                        },
                        legend: {
                            display: true,
                            position: 'bottom',
                            labels: {
                                boxWidth: 20
                            }
                        }
                    }
                }
            });
        }

        // Call the functions sequentially
        visualizeAvg();
        visualizeMin();
        visualizeMax();
    }

    // Destroy the existing line chart if it exists
    if (window.lineChart) {
        window.lineChart.destroy();
        window.lineChart2.destroy();
        window.lineChart3.destroy();
    } 
    
    function sortTable() {
        var table = document.getElementById('outputTable');
        var switching = true;
        /* Make a loop that will continue until no switching has been done: */
        while (switching) {
            // Start by saying: no switching is done:
            switching = false;
            var rows = table.rows;
            /* Loop through all table rows (except the first, which contains table headers): */
            for (i = 1; i < (rows.length - 1); i++) {
                // Start by assuming there should be no switching:
                shouldSwitch = false;
                // extract row 1 season
                var seasonX = parseInt(rows[i].getElementsByTagName("TD")[1].innerHTML); // Season
                // extract row 2 season
                var seasonY = parseInt(rows[i + 1].getElementsByTagName("TD")[1].innerHTML); // Season
                // Check if the two rows should switch place based on season:
                if (seasonX > seasonY) {
                    shouldSwitch = true;
                }
                // If a switch should occur, mark as such and break the loop:
                if (shouldSwitch) {
                    rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
                    switching = true;
                    break;
                }
            }
        }
    }
    await stats(); // Wait for stats() to complete
    sortTable();
    visualizeData(); // Call visualizeData() after stats() is done
}