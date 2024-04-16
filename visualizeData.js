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
                        beginAtZero: true
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
                            text: 'Min MMR'
                        },
                        beginAtZero: true
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
                            text: 'Max MMR'
                        },
                        beginAtZero: true
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


    // Destroy the existing line chart if it exists
    if (window.lineChart) {
        window.lineChart.destroy();
    }

    // Call the functions sequentially
    visualizeAvg();
    visualizeMin();
    visualizeMax();

}