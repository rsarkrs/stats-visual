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
        var tag = document.getElementById('nameInput').value; //bnet player tag
        var battleTag = tag.replace("#", "%23"); //w3c player tag
        var selectElement = document.getElementById('seasons');
        var season_check = []; //w3c season
        for (var i = 0; i < selectElement.options.length; i++) {
            if (selectElement.options[i].selected) {
                season_check.push(selectElement.options[i].value);
            }
        }
        var race_check = document.getElementById('race').value; //player race
        var raceConfig = window.RACE_CONFIG || {};
        var raceFullList = raceConfig.raceNameToId || {};
        var raceIdToName = raceConfig.raceIdToName || {};
        var season_variable = []; //array of seasons
        var player_race = []; //array of player races
        var mmrStats = {};

        async function fetchAvailableSeasonIds() {
            const seasonResponse = await fetch('https://website-backend.w3champions.com/api/ladder/seasons');
            if (!seasonResponse.ok) {
                throw new Error('Unable to fetch season list from W3Champions API');
            }

            const seasonPayload = await seasonResponse.json();
            return seasonPayload
                .map(season => parseInt(season.id, 10))
                .filter(seasonId => Number.isFinite(seasonId) && seasonId > 0)
                .sort((a, b) => a - b);
        }


        //--------------------------End assign variables from input fields------------------------------------------------------------------------
        //-------------------------Start array of all player races and seasons to iterate through-------------------------------------------------
        var allSeasons = await fetchAvailableSeasonIds();
        if (season_check.includes('All')) {
            season_variable = allSeasons;
        } else {
            season_variable = season_check
                .map(seasonId => parseInt(seasonId, 10))
                .filter(seasonId => Number.isFinite(seasonId) && seasonId > 0);
        }

        if (season_variable.length === 0) {
            season_variable = allSeasons;
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
                } else if (
                    Object.prototype.hasOwnProperty.call(dictTemp, seasonDup) &&
                    Object.prototype.hasOwnProperty.call(dictTemp[seasonDup], raceDup)
                ) {
                    delete dictTemp[seasonDup][raceDup];
                }
            }

            season_variable.forEach(function (loopSeasonTemp) {
                if (
                    Object.prototype.hasOwnProperty.call(dictTemp, loopSeasonTemp) &&
                    Object.keys(dictTemp[loopSeasonTemp]).length === 0
                ) {
                    delete dictTemp[loopSeasonTemp];
                }
            });

            return dictTemp;
        }
        //-------------------------End Duplicates Check--------------------------------------------------------------------------------------------
        //-------------------------Start check if summary table exists-----------------------------------------------------------------------------
        var table = document.getElementById('outputTable');
        var updatedPullDict = playerRaceRecords;
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
        try {
        for (let loopSeasonTemp in updatedPullDict) {
            var offset = 0;
            for (let loopRace in updatedPullDict[loopSeasonTemp]) {
                mmrStats[loopRace] = {mmr: [], oppoMmr: [], floor: [], roof: [], avg: [], sd: [], lcl: [], ucl: []};
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
                            let raceid = Object.prototype.hasOwnProperty.call(raceFullList, race_record)
                                ? raceFullList[race_record]
                                : -1;
                            //check if record contains a game with players race. If so collect data from record
                            var pulledDataCheck = meetsCondition(record, raceid, tag);
                            // if record contains a game with players race, push record data
                            if (pulledDataCheck[0]) {
                                let oppoRaceId = Object.prototype.hasOwnProperty.call(raceIdToName, pulledDataCheck[4])
                                    ? raceIdToName[pulledDataCheck[4]]
                                    : -1;
                                if (!Object.prototype.hasOwnProperty.call(updatedPullDict[loopSeasonTemp][race_record], oppoRaceId)) {
                                    return;
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
                var seasonMmr = mmrStats[race_record].mmr
                    .map(value => Number(value))
                    .filter(value => Number.isFinite(value));
                if (seasonMmr.length === 0) {
                    continue;
                }

                mmrStats[race_record].mmr = seasonMmr;
                var floorValue = Math.min(...seasonMmr);
                var roofValue = Math.max(...seasonMmr);
                // calculate mean
                const mean = seasonMmr.reduce((a, b) => a + b, 0) / seasonMmr.length;
                // Calculate squared deviations, sum of squared deviations, and standard deviation
                const squaredDeviationsSum = seasonMmr.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0);
                const meanSquaredDeviations = squaredDeviationsSum / seasonMmr.length;
                const standardDeviation = Math.sqrt(meanSquaredDeviations);
                var avgValue = Math.round(mean);
                var sdValue = Math.round(standardDeviation);
                var lclValue = avgValue - sdValue;
                var uclValue = avgValue + sdValue;

                mmrStats[race_record].floor.push(floorValue);
                mmrStats[race_record].roof.push(roofValue);
                mmrStats[race_record].avg.push(avgValue);
                mmrStats[race_record].sd.push(sdValue);
                mmrStats[race_record].lcl.push(lclValue);
                mmrStats[race_record].ucl.push(uclValue);

                var arrTable = [
                    tag, //player name
                    loopSeasonTemp, //season
                    race_record, //race
                    seasonMmr.length, //games played
                    avgValue, //avg mmr in season
                    floorValue, //lowest mmr in season
                    roofValue, //highest mmr in season
                    lclValue, //lower mmr range
                    uclValue //upper mmr range
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
                    var lclCell = newRow.insertCell(7);
                    var uclCell = newRow.insertCell(8);
                    nameCell.textContent = arrTable[0];
                    seasonCell.textContent = arrTable[1];
                    raceCell.textContent = arrTable[2];
                    gameCount.textContent = arrTable[3];
                    avgCell.textContent = arrTable[4];
                    minCell.textContent = arrTable[5];
                    maxCell.textContent = arrTable[6];
                    lclCell.textContent = arrTable[7];
                    uclCell.textContent = arrTable[8];
                }
            }
        }
        } catch (error) {
            console.error('Error while pulling and calculating stats:', error);
        } finally {
            document.getElementById('loadingSpinner').style.display = 'none';
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
                    var minOppoMmr = Infinity;
                    var maxOppoMmr = -Infinity;
                    for (var i = 0; i < intervalStatsDict[raceDict][raceDict2].oppoMmr.length; i++) {
                        var oppoMmrValues = intervalStatsDict[raceDict][raceDict2].oppoMmr[i]
                            .map(value => Number(value))
                            .filter(value => Number.isFinite(value));
                        if (oppoMmrValues.length === 0) {
                            continue;
                        }
                        var mmrFloor = Math.floor(Math.min(...oppoMmrValues) / mmrIntervalStep) * mmrIntervalStep;
                        var mmrRoof = Math.max(...oppoMmrValues);
                        if (mmrFloor < minOppoMmr) {
                            minOppoMmr = mmrFloor;
                        }
                        if (mmrRoof > maxOppoMmr) {
                            maxOppoMmr = mmrRoof;
                        }
                    }
                    if (!Number.isFinite(minOppoMmr) || !Number.isFinite(maxOppoMmr)) {
                        continue;
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
                                        tableIntervalDict[raceDict][raceDict2][mmrInterval]['won'].duration += parseInt(intervalStatsDict[raceDict][raceDict2].duration[i][k], 10);
                                        tableIntervalDict[raceDict][raceDict2][mmrInterval]['won'].oppoMmr += parseInt(intervalStatsDict[raceDict][raceDict2].oppoMmr[i][k], 10);
                                    } else {
                                        tableIntervalDict[raceDict][raceDict2][mmrInterval]['lost'].count += 1;
                                        tableIntervalDict[raceDict][raceDict2][mmrInterval]['lost'].duration += parseInt(intervalStatsDict[raceDict][raceDict2].duration[i][k], 10);
                                        tableIntervalDict[raceDict][raceDict2][mmrInterval]['lost'].oppoMmr += parseInt(intervalStatsDict[raceDict][raceDict2].oppoMmr[i][k], 10);
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
                            if (!intervalTable[racePlayer][raceLoop]) {
                                intervalTable[racePlayer][raceLoop] = {};
                            }
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
        // display the table
        // document.getElementById('outputTable').style.display = 'none';//'table';
        // display the table
        document.getElementById('intervalTableHtml').style.display = 'table';
        document.getElementById('outputTable').style.display = 'table';

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
                var minMMR = parseFloat(row.cells[5].textContent); // Convert to float
                var maxMMR = parseFloat(row.cells[6].textContent); // Convert to float
                var lcl = parseFloat(row.cells[7].textContent); // Convert to float
                var ucl = parseFloat(row.cells[8].textContent); // Convert to float

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
                    data[race][name][season] = {
                        'avg': null,
                        'min': null,
                        'max': null,
                        'lcl': null,
                        'ucl': null
                    };
                }
                data[race][name][season].avg = avgMMR;
                data[race][name][season].min = minMMR;
                data[race][name][season].max = maxMMR;
                data[race][name][season].lcl = lcl;
                data[race][name][season].ucl = ucl;

                // Add season to labels if not already present
                if (!labels.includes(season)) {
                    labels.push(season);
                }
            }
            labels.sort((a, b) => a - b);

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
            var minMarkerColor = 'rgba(0, 102, 204, 1)';
            var maxMarkerColor = 'rgba(204, 0, 0, 1)';
            var errorBarPlugin = {
                id: 'errorBarPlugin',
                afterDatasetsDraw: function (chart, args, pluginOptions) {
                    var chartCtx = chart.ctx;
                    var yScale = chart.scales.y;
                    var capWidth = (pluginOptions && pluginOptions.capWidth) ? pluginOptions.capWidth : 8;

                    chart.data.datasets.forEach(function (dataset, datasetIndex) {
                        if (!Array.isArray(dataset.errorLow) || !Array.isArray(dataset.errorHigh)) {
                            return;
                        }

                        var meta = chart.getDatasetMeta(datasetIndex);
                        if (meta.hidden) {
                            return;
                        }

                        chartCtx.save();
                        chartCtx.strokeStyle = dataset.borderColor;
                        chartCtx.lineWidth = 1.5;

                        meta.data.forEach(function (point, pointIndex) {
                            var lowValue = dataset.errorLow[pointIndex];
                            var highValue = dataset.errorHigh[pointIndex];
                            var avgValue = dataset.data[pointIndex];

                            if (!Number.isFinite(lowValue) || !Number.isFinite(highValue) || !Number.isFinite(avgValue)) {
                                return;
                            }

                            var xPixel = point.x;
                            var lowPixel = yScale.getPixelForValue(lowValue);
                            var highPixel = yScale.getPixelForValue(highValue);

                            chartCtx.beginPath();
                            chartCtx.moveTo(xPixel, lowPixel);
                            chartCtx.lineTo(xPixel, highPixel);
                            chartCtx.moveTo(xPixel - capWidth / 2, lowPixel);
                            chartCtx.lineTo(xPixel + capWidth / 2, lowPixel);
                            chartCtx.moveTo(xPixel - capWidth / 2, highPixel);
                            chartCtx.lineTo(xPixel + capWidth / 2, highPixel);
                            chartCtx.stroke();
                        });

                        chartCtx.restore();
                    });
                }
            };

            for (var race in data) {
                if (data.hasOwnProperty(race)) {
                    for (var name in data[race]) {
                        if (data[race].hasOwnProperty(name)) {
                            var avgTemp = {
                                label: race + ' - ' + name,
                                data: [],
                                borderColor: customColors[race] || 'rgba(75, 192, 192, 1)', // Default color
                                borderWidth: 2,
                                fill: false,
                                pointRadius: 2,
                                pointHoverRadius: 4,
                                errorLow: [],
                                errorHigh: []
                            };

                            var minTemp = {
                                label: race + ' - ' + name + ' Min',
                                data: [],
                                borderColor: minMarkerColor,
                                backgroundColor: minMarkerColor,
                                showLine: false,
                                pointStyle: 'crossRot',
                                pointRadius: 6,
                                pointHoverRadius: 6
                            };

                            var maxTemp = {
                                label: race + ' - ' + name + ' Max',
                                data: [],
                                borderColor: maxMarkerColor,
                                backgroundColor: maxMarkerColor,
                                showLine: false,
                                pointStyle: 'crossRot',
                                pointRadius: 6,
                                pointHoverRadius: 6
                            };
                            for (var i = 0; i < labels.length; i++) {
                                var season = labels[i];
                                if (data[race][name][season]) {
                                    avgTemp.data.push(data[race][name][season].avg);
                                    avgTemp.errorLow.push(data[race][name][season].lcl);
                                    avgTemp.errorHigh.push(data[race][name][season].ucl);
                                    minTemp.data.push(data[race][name][season].min);
                                    maxTemp.data.push(data[race][name][season].max);
                                } else {
                                    avgTemp.data.push(null);
                                    avgTemp.errorLow.push(null);
                                    avgTemp.errorHigh.push(null);
                                    minTemp.data.push(null);
                                    maxTemp.data.push(null);
                                }
                            }
                            datasets.push(avgTemp, minTemp, maxTemp);
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
                plugins: [errorBarPlugin],
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
                        errorBarPlugin: {
                            capWidth: 8
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false
                        },
                        legend: {
                            display: true,
                            position: 'bottom',
                            onClick: function (event, legendItem, legend) {
                                if (typeof legendItem.datasetIndex !== 'number') {
                                    return;
                                }
                                Chart.defaults.plugins.legend.onClick(event, legendItem, legend);
                            },
                            labels: {
                                boxWidth: 20,
                                usePointStyle: true,
                                filter: function (legendItem) {
                                    return !legendItem.text.endsWith(' Min') && !legendItem.text.endsWith(' Max');
                                },
                                generateLabels: function (chart) {
                                    var defaultLabels = Chart.defaults.plugins.legend.labels.generateLabels(chart);
                                    var filteredLabels = defaultLabels.filter(function (legendItem) {
                                        return !legendItem.text.endsWith(' Min') && !legendItem.text.endsWith(' Max');
                                    });

                                    filteredLabels.push({
                                        text: 'X Min MMR',
                                        fillStyle: minMarkerColor,
                                        strokeStyle: minMarkerColor,
                                        lineWidth: 0,
                                        hidden: false,
                                        pointStyle: 'crossRot'
                                    });

                                    filteredLabels.push({
                                        text: 'X Max MMR',
                                        fillStyle: maxMarkerColor,
                                        strokeStyle: maxMarkerColor,
                                        lineWidth: 0,
                                        hidden: false,
                                        pointStyle: 'crossRot'
                                    });

                                    filteredLabels.push({
                                        text: 'LCL/UCL (Lower Confidence Level and Upper Confidence Level)',
                                        fillStyle: 'rgba(80, 80, 80, 1)',
                                        strokeStyle: 'rgba(80, 80, 80, 1)',
                                        lineWidth: 2,
                                        hidden: false,
                                        pointStyle: 'line'
                                    });

                                    return filteredLabels;
                                }
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
            // Extract data from the table
            for (var i = 1; i < table.rows.length; i++) {
                var row = table.rows[i];
                var playerRace = row.cells[0].textContent;
                var oppRace = row.cells[1].textContent;
                var oppMmrRange = parseInt(row.cells[2].textContent, 10);
                var winRate = parseFloat(row.cells[4].textContent); // Convert to float

                if (!Number.isFinite(oppMmrRange) || !Number.isFinite(winRate)) {
                    continue;
                }

                var matchupKey = playerRace + ' vs ' + oppRace;
                // matchup keeps player-race + opp-race + interval context
                if (!data[matchupKey]) {
                    data[matchupKey] = {
                        playerRace: playerRace,
                        oppRace: oppRace,
                        intervals: {}
                    };
                }

                data[matchupKey].intervals[oppMmrRange] = winRate;

                // Add season to labels if not already present
                if (!labels.includes(oppMmrRange)) {
                    labels.push(oppMmrRange);
                }
            }
            labels.sort((a, b) => a - b);

            // Define custom colors for each race
            var customColors = {
                "Orc": 'rgba(255, 99, 132, 1)', // Red
                "Night Elf": 'rgba(54, 162, 235, 1)', // Blue
                "Undead": 'rgba(255, 206, 86, 1)', // Yellow
                "Random": 'rgba(90, 34, 139, 1)', // Purple
                "Human": 'rgba(0, 255, 0, 1)', // Green
                // Add more colors as needed
            };
            var pointStyles = {
                "Orc": 'triangle',
                "Night Elf": 'rectRot',
                "Undead": 'rect',
                "Random": 'star',
                "Human": 'circle'
            };
            var availablePlayerRaces = new Set();

            // Create datasets for each player/opp matchup
            var datasets = [];
            for (var matchupKey in data) {
                if (data.hasOwnProperty(matchupKey)) {
                    var matchup = data[matchupKey];
                    availablePlayerRaces.add(matchup.playerRace);
                    var matchupDataset = {
                        label: matchupKey,
                        data: [],
                        borderColor: customColors[matchup.oppRace] || 'rgba(75, 192, 192, 1)',
                        backgroundColor: customColors[matchup.oppRace] || 'rgba(75, 192, 192, 1)',
                        borderWidth: 2,
                        fill: false,
                        pointStyle: pointStyles[matchup.playerRace] || 'circle',
                        pointRadius: 4,
                        pointHoverRadius: 5,
                        oppRace: matchup.oppRace,
                        playerRace: matchup.playerRace
                    };
                    for (var i = 0; i < labels.length; i++) {
                        var intRange = labels[i];
                        if (Object.prototype.hasOwnProperty.call(matchup.intervals, intRange)) {
                            matchupDataset.data.push(matchup.intervals[intRange]);
                        } else {
                            matchupDataset.data.push(null);
                        }
                    }
                    datasets.push(matchupDataset);
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

            function renderIntervalRaceFilters(chart, playerRaces) {
                var filtersContainer = document.getElementById('lineGraph4Filters');
                if (!filtersContainer) {
                    return;
                }

                filtersContainer.innerHTML = '';

                var label = document.createElement('span');
                label.className = 'chart-filter-label';
                label.textContent = 'Graph 2 Player Race Filter:';
                filtersContainer.appendChild(label);

                var sortedPlayerRaces = Array.from(playerRaces).sort();
                var selectedFilter = 'All';
                var filterButtons = {};

                function updateChartVisibility() {
                    chart.data.datasets.forEach(function (dataset, datasetIndex) {
                        var shouldShow = selectedFilter === 'All' || dataset.playerRace === selectedFilter;
                        chart.setDatasetVisibility(datasetIndex, shouldShow);
                    });
                    chart.update();
                }

                function updateButtonStyles() {
                    sortedPlayerRaces.forEach(function (race) {
                        if (!filterButtons[race]) {
                            return;
                        }
                        filterButtons[race].classList.toggle('active', selectedFilter === race);
                    });
                    allButton.classList.toggle('active', selectedFilter === 'All');
                }

                var allButton = document.createElement('button');
                allButton.type = 'button';
                allButton.className = 'race-filter-btn active';
                allButton.textContent = 'All';
                allButton.addEventListener('click', function () {
                    selectedFilter = 'All';
                    updateButtonStyles();
                    updateChartVisibility();
                });
                filtersContainer.appendChild(allButton);

                sortedPlayerRaces.forEach(function (race) {
                    var raceButton = document.createElement('button');
                    raceButton.type = 'button';
                    raceButton.className = 'race-filter-btn active';
                    raceButton.textContent = race;
                    raceButton.style.borderColor = customColors[race] || '#b6c1ce';
                    raceButton.addEventListener('click', function () {
                        selectedFilter = race;
                        updateButtonStyles();
                        updateChartVisibility();
                    });
                    filterButtons[race] = raceButton;
                    filtersContainer.appendChild(raceButton);
                });

                updateButtonStyles();
                updateChartVisibility();
            }

            renderIntervalRaceFilters(window.lineChart4, availablePlayerRaces);
        }

        // Call the functions sequentially
        visualizeAvg();
        visualizeIntervals();
    }

    // Destroy the existing line chart if it exists
    if (window.lineChart) {
        window.lineChart.destroy();
    }
    if (window.lineChart4) {
        window.lineChart4.destroy();
    }


    function sortTableBodyRows(tableId, mapRowToModel, compareModels) {
        var table = document.getElementById(tableId);
        if (!table || !table.tBodies || table.tBodies.length === 0) {
            return;
        }

        var tbody = table.tBodies[0];
        var modeledRows = Array.from(tbody.rows).map(function (row) {
            return {
                row: row,
                model: mapRowToModel(row)
            };
        });

        modeledRows.sort(function (a, b) {
            return compareModels(a.model, b.model);
        });

        var fragment = document.createDocumentFragment();
        modeledRows.forEach(function (entry) {
            fragment.appendChild(entry.row);
        });
        tbody.appendChild(fragment);
    }

    function sortTableSummary() {
        sortTableBodyRows(
            'outputTable',
            function (row) {
                return {
                    name: row.cells[0].textContent,
                    season: parseInt(row.cells[1].textContent, 10),
                    race: row.cells[2].textContent
                };
            },
            function (left, right) {
                return (
                    (left.season - right.season) ||
                    left.race.localeCompare(right.race) ||
                    left.name.localeCompare(right.name)
                );
            }
        );
    }

    function sortTableInterval() {
        sortTableBodyRows(
            'intervalTableHtml',
            function (row) {
                return {
                    playerRace: row.cells[0].textContent,
                    oppRace: row.cells[1].textContent,
                    oppMmr: parseInt(row.cells[2].textContent, 10)
                };
            },
            function (left, right) {
                return (
                    left.playerRace.localeCompare(right.playerRace) ||
                    left.oppRace.localeCompare(right.oppRace) ||
                    (left.oppMmr - right.oppMmr)
                );
            }
        );
    }
    await stats(); // Wait for stats() to complete
    sortTableSummary();
    sortTableInterval();
    visualizeData(); // Call visualizeData() after stats() is done
}
