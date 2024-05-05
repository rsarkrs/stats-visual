async function pullAndVisualize() {
    //Function to pull games and calculate player stats
    async function stats() {
        //initialize variables
        //assign variables from input fields - x
        //create dictionary for race mapping - x
        //assign first/last season values - x
        //create array of all player races and seasons to iterate through - x
        //create dictionary of all seasons + races to store data - x

        //-------------------------Start assign variables from input fields---------------------------------------------------------------------
        var tag = document.getElementById('nameList').value; //bnet player tag
        var battleTag = tag.replace("#", "%23"); //w3c player tag
        var selectElement = document.getElementById('seasons');
        var season_check = []; //w3c season
        for (var i = 0; i < selectElement.options.length; i++) {
            if (selectElement.options[i].selected) {
                season_check.push(selectElement.options[i].value);
            }
        }
        var race_check = document.getElementById('race').value; //player race
        var raceFullList = {
            'Random': 0,
            'Human': 1,
            'Orc': 2,
            'Night Elf': 4,
            'Undead': 8,
        }; //full race list and w3c race id
        var last_season = 18; //final w3c season
        var first_season = 1; //first w3c season
        var season_variable = []; //array of seasons
        var player_race = []; //array of player races
        var mmrStats = {};


        //--------------------------End assign variables from input fields------------------------------------------------------------------------
        //-------------------------Start array of all player races and seasons to iterate through-------------------------------------------------
        if (season_check == 'All') {
            for (i = first_season; i <= last_season; i++) {
                season_variable.push(i);
            }
        } else {
            var season_variable = season_check;
        }

        if (race_check == 'All') {
            for (let race_cycle in raceFullList) {
                player_race.push(race_cycle);
            }
        } else {
            player_race = [race_check];
        }
        //-------------------------End array of all player races and seasons to iterate through---------------------------------------------------
        //-------------------------Start dictionary of all seasons + races to store data----------------------------------------------------------
        var playerRaceRecords = {};

        season_variable.forEach(function (loopSeasons) {
            playerRaceRecords[loopSeasons] = {};
            player_race.forEach(function (loopRace) {
                playerRaceRecords[loopSeasons][loopRace] = {};
                for (let race_cycle in raceFullList) {
                    playerRaceRecords[loopSeasons][loopRace][race_cycle] = { records: [], mmr: [], oppoRace: [], oppoMmr: [], playerResult: [], duration: []}; //playerRaceRecords[w3c_season][player_race][opponent_race]
                }
            });
        });
        //-------------------------End dictionary of all seasons + races to store data-------------------------------------------------------------
        //check if summary table exists
        //if table exists, see if current output matches 
        //-------------------------Start Duplicates Check-----------------------------------------------------------------------------------------
        function dupTableCheck(tableTemp, tagTemp, dictTemp) {
            // Extract data from the table
            for (var i = tableTemp.rows.length - 1; i > 0; i--) {
                var rowDup = tableTemp.rows[i];
                var nameDup = rowDup.cells[0].textContent;
                var seasonDup = rowDup.cells[1].textContent;
                var raceDup = rowDup.cells[2].textContent;

                // If table contents don't match new player search, delete table contents
                if (nameDup != tagTemp) {
                    var intTableTemp = document.getElementById('intervalTableHtml');
                    for (var j = tableTemp.rows.length - 1; j > 0; j--) {
                        tableTemp.deleteRow(j);
                    }
                    for (var j = intTableTemp.rows.length - 1; j > 0; j--) {
                        intTableTemp.deleteRow(j);
                    }
                    break;
                } else if (seasonDup in dictTemp) {
                    if (dictTemp[seasonDup].includes(raceDup)) {
                        delete dictTemp[seasonDup][raceDup];
                    }
                }
            }

            season_variable.forEach(function (loopSeasonTemp) {
                if (dictTemp[loopSeasonTemp].length === 0) {
                    delete dictTemp[loopSeasonTemp];
                }
            });

            return dictTemp;
        }
        //-------------------------End Duplicates Check--------------------------------------------------------------------------------------------
        //-------------------------Start check if summary table exists-----------------------------------------------------------------------------
        var table = document.getElementById('outputTable');
        if (table.rows.length > 0) {
            updatedPullDict = dupTableCheck(table, tag, playerRaceRecords);
        }

        //-------------------------End check if summary table exists-------------------------------------------------------------------------------
        //-------------------------Start Hide table and pull data----------------------------------------------------------------------------------
        // hide the table
        document.getElementById('outputTable').style.display = 'none';
        document.getElementById('intervalTableHtml').style.display = 'none';
        // Show loading spinner before executing the main logic
        document.getElementById('loadingSpinner').style.display = 'block';
        //-------------------------End Hide table and pull data------------------------------------------------------------------------------------
        //-------------------------Start loop through all match pages------------------------------------------------------------------------------
        //updatedPullDict[w3c_season][player_race][opponent_race]
        //loop through each season listed in updatedPullDict[w3c_season]
        //pull records and loop through each one
        //if player name & race is in updatedPullDict[w3c_season][player_race], add record to updatedPullDict[w3c_season][player_race][opponent_race] based on opponent's race
        //iterate through all seasons, calculate intervals last
        
        for (let loopSeasonTemp in updatedPullDict) {
            var offset = 0;
            for (let loopRace in updatedPullDict[loopSeasonTemp]) {
                mmrStats[loopRace] = {mmr: [], oppoMmr: [], floor: [], roof: [], avg: []};
            }
            while (offset != -1) {
                var url = 'https://website-backend.w3champions.com/api/matches/search?playerId=' +
                    battleTag + '&gateway=20&offset=' + offset.toString() + '&pageSize=50&season=' + loopSeasonTemp.toString();
                try {
                    const response = await fetch(url);
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    const rawdata = await response.json();
                    if (rawdata["matches"].length < 50) {
                        offset = -1;
                    } else {
                        offset += 50;
                    }

                    function meetsCondition(record, raceid, pname) {
                        var player_record = [];
                        var race_record = [];
                        var playerMmr = [];
                        var result = [];
                        var userMmr;
                        var oppoMmr;
                        var playerResult;
                        var oppoRace;
                        var duration;

                        record.teams.forEach(function (team) {
                            team.players.forEach(function (player) {
                                player_record.push(player.battleTag);
                                race_record.push(player.race);
                                playerMmr.push(player.oldMmr);
                                result.push(player.won);
                            });
                        });
                        if (player_record[0].toLowerCase() == pname.toLowerCase() && race_record[0] == raceid) {
                            userMmr = playerMmr[0];
                            oppoMmr = playerMmr[1];
                            playerResult = result[0];
                            oppoRace = race_record[1];
                        } else if (player_record[1].toLowerCase() == pname.toLowerCase() && race_record[1] == raceid) {
                            userMmr = playerMmr[1];
                            oppoMmr = playerMmr[0];
                            playerResult = result[1];
                            oppoRace = race_record[0];
                        };
                        duration = record.durationInSeconds;

                        return [
                            record.gameMode == 1 &&
                            (
                                (player_record[0].toLowerCase() == pname.toLowerCase() && race_record[0] == raceid) ||
                                (player_record[1].toLowerCase() == pname.toLowerCase() && race_record[1] == raceid)
                            ), userMmr, oppoMmr, playerResult, oppoRace, duration
                        ];
                    };

                    // Create game_records variable that holds each solo with assigned race
                    rawdata["matches"].forEach(function (record) {
                        for (let race_record in updatedPullDict[loopSeasonTemp]) {
                            
                            switch (race_record) {
                                case 'Random':
                                    raceid = 0;
                                    break;
                                case 'Human':
                                    raceid = 1;
                                    break;
                                case 'Orc':
                                    raceid = 2;
                                    break;
                                case 'Night Elf':
                                    raceid = 4;
                                    break;
                                case 'Undead':
                                    raceid = 8;
                                    break;
                                default:
                                    raceid = -1;
                                    break;
                            }
                            //check if record contains a game with players race. If so collect data from record
                            var pulledDataCheck = meetsCondition(record, raceid, tag);
                            // if record contains a game with players race, push record data
                            if (pulledDataCheck[0]) {
                                switch (pulledDataCheck[4]) {
                                    case 0:
                                        oppoRaceId = 'Random';
                                        break;
                                    case 1:
                                        oppoRaceId = 'Human';
                                        break;
                                    case 2:
                                        oppoRaceId = 'Orc';
                                        break;
                                    case 4:
                                        oppoRaceId = 'Night Elf';
                                        break;
                                    case 8:
                                        oppoRaceId = 'Undead';
                                        break;
                                    default:
                                        oppoRaceId = -1;
                                        break;
                                }
                                // records: [], mmr: [], oppoRace: [], oppoMmr: [], playerResult: [], duration: []
                                updatedPullDict[loopSeasonTemp][race_record][oppoRaceId].records.push(record);
                                updatedPullDict[loopSeasonTemp][race_record][oppoRaceId].mmr.push(pulledDataCheck[1]);
                                updatedPullDict[loopSeasonTemp][race_record][oppoRaceId].oppoMmr.push(pulledDataCheck[2]);
                                updatedPullDict[loopSeasonTemp][race_record][oppoRaceId].playerResult.push(pulledDataCheck[3]);
                                updatedPullDict[loopSeasonTemp][race_record][oppoRaceId].oppoRace.push(pulledDataCheck[4]);
                                updatedPullDict[loopSeasonTemp][race_record][oppoRaceId].duration.push(pulledDataCheck[5]);
                                mmrStats[race_record].mmr.push(pulledDataCheck[1]);
                                mmrStats[race_record].oppoMmr.push(pulledDataCheck[2]);
                            }  
                        }
                    });
                }

                 catch (error) {
                    console.log(error);
                    offset = -1; // Stop the loop on error
                }
            }

            for (let race_record in updatedPullDict[loopSeasonTemp]) {
                // calculate values for summary table
                
                mmrStats[race_record].floor.push(Math.min(...mmrStats[race_record].mmr));
                mmrStats[race_record].roof.push(Math.max(...mmrStats[race_record].mmr));
                mmrStats[race_record].avg.push(Math.round(mmrStats[race_record].mmr.reduce((a, b) => a + b, 0) / mmrStats[race_record].mmr.length));
                var arrTable = [
                    tag, //player name
                    loopSeasonTemp, //season
                    race_record, //race
                    mmrStats[race_record].mmr.length, //games played
                    mmrStats[race_record].avg, //avg mmr in season
                    mmrStats[race_record].floor, //lowest mmr in season
                    mmrStats[race_record].roof //highest mmr in season
                ]
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
            }
        }

        //-------------------------End loop through all match pages---------------------------------------------------------------------------------
        
        
        //-------------------------Start calculate season averages----------------------------------------------------------------------------------


            // Define intervalStatsDict
            var intervalStatsDict = {};
            var tableIntervalDict = {};
            for (var raceLoopTemp in raceFullList) {
                intervalStatsDict[raceLoopTemp] = {};
                tableIntervalDict[raceLoopTemp] = {};
                for (var raceLoopTemp2 in raceFullList) {
                    tableIntervalDict[raceLoopTemp][raceLoopTemp2] = {};
                    intervalStatsDict[raceLoopTemp][raceLoopTemp2] = {
                        duration: [],
                        mmr: [],
                        oppoMmr: [],
                        oppoRace: [],
                        playerResult: []     
                    }               
                }
            }

            for (var seasonDict in updatedPullDict) {
                for (var raceDict in updatedPullDict[seasonDict]) {
                    for (var oppRaceDict in updatedPullDict[seasonDict][raceDict]) {
                        intervalStatsDict[raceDict][oppRaceDict].duration.push(updatedPullDict[seasonDict][raceDict][oppRaceDict].duration);
                        intervalStatsDict[raceDict][oppRaceDict].mmr.push(updatedPullDict[seasonDict][raceDict][oppRaceDict].mmr);
                        intervalStatsDict[raceDict][oppRaceDict].oppoMmr.push(updatedPullDict[seasonDict][raceDict][oppRaceDict].oppoMmr);
                        intervalStatsDict[raceDict][oppRaceDict].oppoRace.push(updatedPullDict[seasonDict][raceDict][oppRaceDict].oppoRace);
                        intervalStatsDict[raceDict][oppRaceDict].playerResult.push(updatedPullDict[seasonDict][raceDict][oppRaceDict].playerResult);
                    }
                }
            }

            for (var raceDict in intervalStatsDict) {
                for (var raceDict2 in intervalStatsDict[raceDict]) {
                    var mmrIntervalStep = 100;
                    var minOppoMmr = 3500;
                    var maxOppoMmr = 0;
                    for (var i in intervalStatsDict[raceDict][raceDict2].oppoMmr) {
                        var mmrFloor = Math.floor(Math.min(...intervalStatsDict[raceDict][raceDict2].oppoMmr[i]) / 100) * 100;
                        var mmrRoof = Math.max(...intervalStatsDict[raceDict][raceDict2].oppoMmr[i]);
                        if (mmrFloor < minOppoMmr) {
                            minOppoMmr = mmrFloor;
                        }
                        if (mmrRoof > maxOppoMmr) {
                            maxOppoMmr = mmrRoof;
                        }
                    }
                    var mmrStartInterval = minOppoMmr;

                    // Iterate over each MMR interval
                    for (var j = mmrStartInterval; j <= maxOppoMmr; j += mmrIntervalStep) {
                        tableIntervalDict[raceDict][raceDict2][j] = {
                            'won': { count: 0, duration: 0, oppoMmr: 0 },
                            'lost': { count: 0, duration: 0, oppoMmr: 0 }
                        };
                    }
                    // calculate values for interval table - opponent, mmr range, games played, win rate, won game duration, lost game duration, opponents mmr avg
                    var mmrInterval = mmrStartInterval;

                    while (mmrInterval <= maxOppoMmr) {
                        for (var i = 0; i < intervalStatsDict[raceDict][raceDict2].mmr.length; i++) {
                            for (var k = 0; k < intervalStatsDict[raceDict][raceDict2].mmr[i].length; k++) {
                                if (intervalStatsDict[raceDict][raceDict2].oppoMmr[i][k] >= mmrInterval && intervalStatsDict[raceDict][raceDict2].oppoMmr[i][k] < mmrInterval + mmrIntervalStep) {
                                    if (intervalStatsDict[raceDict][raceDict2].playerResult[i][k]) {
                                        tableIntervalDict[raceDict][raceDict2][mmrInterval]['won'].count += 1;
                                        tableIntervalDict[raceDict][raceDict2][mmrInterval]['won'].duration += parseInt(intervalStatsDict[raceDict][raceDict2].duration[i][k]);
                                        tableIntervalDict[raceDict][raceDict2][mmrInterval]['won'].oppoMmr += parseInt(intervalStatsDict[raceDict][raceDict2].oppoMmr[i][k]);
                                    } else {
                                        tableIntervalDict[raceDict][raceDict2][mmrInterval]['lost'].count += 1;
                                        tableIntervalDict[raceDict][raceDict2][mmrInterval]['lost'].duration += parseInt(intervalStatsDict[raceDict][raceDict2].duration[i][k]);
                                        tableIntervalDict[raceDict][raceDict2][mmrInterval]['lost'].oppoMmr += parseInt(intervalStatsDict[raceDict][raceDict2].oppoMmr[i][k]);
                                    }
                                }
                            }
                        }
                        mmrInterval += mmrIntervalStep;
                    
                    }
                }
            }
            //create table
            var intervalTable = {};
            for (var racePlayer in tableIntervalDict) {
                intervalTable[racePlayer] = {};
                if (intervalStatsDict.hasOwnProperty(racePlayer)) {
                    for (var raceLoop in tableIntervalDict[racePlayer]) {
                        if (intervalStatsDict[racePlayer].hasOwnProperty(raceLoop)) {
                            var raceData = tableIntervalDict[racePlayer][raceLoop];
                            for (var intervalLoop in raceData) {
                                if (raceData.hasOwnProperty(intervalLoop)) {
                                    var intStatsDict = raceData[intervalLoop];
                                    if (intStatsDict['won'].count > 0 || intStatsDict['lost'].count > 0) {
                                        var games_won = intStatsDict['won'].count;
                                        var games_lost = intStatsDict['lost'].count;
                                        var games_played = games_won + games_lost;
                                        var win_rate = ((games_won / games_played) * 100).toFixed(1) + '%';
                                        if (games_won > 0) {
                                            var win_duration = ((intStatsDict['won'].duration / intStatsDict['won'].count) / 60).toFixed(1) + ' mins';
                                        } else {
                                            var win_duration = 'No Games';
                                        }
                                        if (games_lost > 0) {
                                            var loss_duration = ((intStatsDict['lost'].duration / intStatsDict['lost'].count) / 60).toFixed(1) + ' mins';
                                        } else {
                                            var loss_duration = 'No Games';
                                        }
                                        var avg_oppo_mmr = Math.round((intStatsDict['won'].oppoMmr + intStatsDict['lost'].oppoMmr) / games_played);

                                        intervalTable[racePlayer][raceLoop] = {};
                                        intervalTable[racePlayer][raceLoop][intervalLoop] = [
                                            racePlayer, raceLoop, intervalLoop, games_played, win_rate, win_duration, loss_duration, avg_oppo_mmr
                                        ];
                                        //populate table
                                        var htmlTable = document.getElementById('intervalTableHtml').getElementsByTagName('tbody')[0];
                                        var newRow = htmlTable.insertRow();
                                        var playerRaceNameCell = newRow.insertCell(0);
                                        var oppoRaceNameCell = newRow.insertCell(1);
                                        var mmrIntervalCell = newRow.insertCell(2);
                                        var games_playedCell = newRow.insertCell(3);
                                        var win_rateCell = newRow.insertCell(4);
                                        var win_durationCell = newRow.insertCell(5);
                                        var loss_durationCell = newRow.insertCell(6);
                                        var avg_oppo_mmrCell = newRow.insertCell(7);
                                        playerRaceNameCell.textContent = intervalTable[racePlayer][raceLoop][intervalLoop][0];
                                        oppoRaceNameCell.textContent = intervalTable[racePlayer][raceLoop][intervalLoop][1];
                                        mmrIntervalCell.textContent = intervalTable[racePlayer][raceLoop][intervalLoop][2];
                                        games_playedCell.textContent = intervalTable[racePlayer][raceLoop][intervalLoop][3];
                                        win_rateCell.textContent = intervalTable[racePlayer][raceLoop][intervalLoop][4];
                                        win_durationCell.textContent = intervalTable[racePlayer][raceLoop][intervalLoop][5];
                                        loss_durationCell.textContent = intervalTable[racePlayer][raceLoop][intervalLoop][6];
                                        avg_oppo_mmrCell.textContent = intervalTable[racePlayer][raceLoop][intervalLoop][7];
                                    }
                                }
                            }
                        }
                    }
                }
            }
        
    }

    // display the table
    // document.getElementById('outputTable').style.display = 'none';//'table';
    // Hide the loading spinner once the processing is complete
    document.getElementById('loadingSpinner').style.display = 'none';
    // display the table
    document.getElementById('intervalTableHtml').style.display = 'table';
    document.getElementById('outputTable').style.display = 'table';

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

        function visualizeIntervals() {
            // Get the canvas element
            var canvas = document.getElementById('lineGraph4');
            var ctx = canvas.getContext('2d');

            // Get the table data
            var table = document.getElementById('intervalTableHtml');
            var data = {};
            var labels = [];
            var race_labels = [];
            // Extract data from the table
            for (var i = 1; i < table.rows.length; i++) {
                var row = table.rows[i];
                var oppRace = row.cells[1].textContent;
                var oppMmrRange = parseInt(row.cells[2].textContent); // Parse season as integer
                var gamesPlayed = row.cells[3].textContent;
                var winRate = parseFloat(row.cells[4].textContent); // Convert to float


                // Initialize data object for each race if not exists
                if (!data[oppRace]) {
                    data[oppRace] = {};
                }

                // Initialize data object for each player under the race if not exists
                if (!data[oppRace][oppMmrRange]) {
                    data[oppRace][oppMmrRange] = { winRate };
                }

                // Add season to labels if not already present
                if (!labels.includes(oppMmrRange)) {
                    labels.push(oppMmrRange);
                    race_labels.push(oppRace);
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


            /*  // Create datasets for each race and player
              var datasets = [];
              for (var race in data) {
                  if (data.hasOwnProperty(race)) {
                      for (var name in data[race]) {
                          if (data[race].hasOwnProperty(name)) {
                              var dataset = {
                                  label: race,//name,
                                  data: [],
                                  borderColor: customColors[race] || 'rgba(75, 192, 192, 1)', // Default color
                                  borderWidth: 2,
                                  fill: false,
                                  pointStyle: 'circle', // Default marker style
                              };
                              for (var i = 0; i < Object.keys(data[race]).length; i++) {
                                  const [keyDictMmr, valDictMmr] = Object.entries(data[race])[i];
                                  var intRange = keyDictMmr;
                                  if (data[race][intRange]) {
                                      var wRate = valDictMmr.winRate;
                                      dataset.data.push(wRate);
                                  } else {
                                      dataset.data.push(null); // Insert null for missing seasons
                                  }
                              }
                              datasets.push(dataset);
                          }
                      }
                  }
              }*/
            // Create datasets for each race
            var datasets = [];
            for (var race in data) {
                if (data.hasOwnProperty(race)) {
                    var raceDataset = {
                        label: race, // Use race as the label
                        data: [],
                        borderColor: customColors[race] || 'rgba(75, 192, 192, 1)', // Color based on race
                        borderWidth: 2,
                        fill: false,
                        pointStyle: 'circle', // Default marker style
                    };
                    for (var i = 0; i < labels.length; i++) {
                        var intRange = labels[i];
                        if (data[race][intRange]) {
                            var wRate = data[race][intRange].winRate;
                            raceDataset.data.push(wRate);
                        } else {
                            raceDataset.data.push(null); // Insert null for missing seasons
                        }
                    }
                    datasets.push(raceDataset);
                }
            }

            // Create line chart
            window.lineChart4 = new Chart(ctx, {
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
                                text: 'Opp. MMR Range'
                            }
                        },
                        y: {
                            title: {
                                display: true,
                                text: 'Win Rate (%)'
                            },
                            beginAtZero: true,
                            suggestedMax: 100
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
                        },

                        annotation: {
                            annotations: [{
                                type: 'line',
                                mode: 'horizontal',
                                scaleID: 'y',
                                value: 50,
                                borderColor: 'rgba(0, 0, 0, 0.5)',
                                borderWidth: 2,
                                borderDash: [5, 5],
                                label: {
                                    content: 'Reference Line', // Label for the reference line
                                    enabled: true
                                }
                            }]
                        }
                    }
                }
            });
        }

        // Call the functions sequentially
        visualizeAvg();
        visualizeMin();
        visualizeMax();
        visualizeIntervals();
    }

    // Destroy the existing line chart if it exists
    if (window.lineChart) {
        window.lineChart.destroy();
    }
    if (window.lineChart2) {
        window.lineChart2.destroy();
    }
    if (window.lineChart3) {
        window.lineChart3.destroy();
    }
    if (window.lineChart4) {
        window.lineChart4.destroy();
    }


    function sortTableSummary() {
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

    function sortTableInterval() {
        var table = document.getElementById('intervalTableHtml');
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
                // extract row 1 Opponent's mmr
                var oppMmrX = parseInt(rows[i].getElementsByTagName("TD")[2].innerHTML); // Opponent's mmr

                // extract row 2 Opponent's mmr
                var oppMmrY = parseInt(rows[i + 1].getElementsByTagName("TD")[2].innerHTML); // Opponent's mmr

                // Check if the two rows should switch place based on season:
                if (oppMmrX > oppMmrY) {
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
    sortTableSummary();
    sortTableInterval();
    visualizeData(); // Call visualizeData() after stats() is done




    //document.getElementById('lineGraph').style.display = 'none';
    //document.getElementById('lineGraph2').style.display = 'none';
    //document.getElementById('lineGraph3').style.display = 'none';
    //document.getElementById('lineGraph4').style.display = 'none';
}
