// Function to populate the dropdown list
function populateName() {
    var nameSuggestions = document.getElementById('nameSuggestions');
    var ddSeasons = document.getElementById('seasons');
    var ddRace = document.getElementById('race');
    var protocol = window.location.protocol;
    var raceOptions = (window.RACE_CONFIG && window.RACE_CONFIG.raceOptions) || [];

    if (protocol === 'file:') {
        console.error(
            'This app must be run from an HTTP server. Opening index.html directly via file:// blocks fetch() in most browsers.'
        );
        return;
    }

    // Fetch the generated player names file.
    fetch('./playerNames.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch playerNames.json');
            }
            return response.json();
        })
        .then(payload => {
            var names = Array.isArray(payload) ? payload : payload.battleTags;
            if (!Array.isArray(names)) {
                throw new Error('Invalid player names payload');
            }

            var fragment = document.createDocumentFragment();
            names.forEach(name => {
                if (!name) {
                    return;
                }

                var option = document.createElement('option');
                option.value = name;
                fragment.appendChild(option);
            });

            nameSuggestions.appendChild(fragment);
        })
        .catch(error => {
            console.error('Error fetching names:', error);
        });

    // Seasons are now sourced directly from the W3Champions API.
    fetch('https://website-backend.w3champions.com/api/ladder/seasons')
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch seasons');
            }
            return response.json();
        })
        .then(seasons => {
            var seasonIds = seasons
                .map(season => parseInt(season.id, 10))
                .filter(seasonId => Number.isFinite(seasonId) && seasonId > 0)
                .sort((a, b) => a - b);

            var allOption = document.createElement('option');
            allOption.text = 'All';
            allOption.value = 'All';
            ddSeasons.add(allOption);

            seasonIds.forEach(seasonId => {
                var option = document.createElement('option');
                option.text = seasonId.toString();
                option.value = seasonId.toString();
                ddSeasons.add(option);
            });
        })
        .catch(error => {
            console.error('Error fetching seasons:', error);
        });

    raceOptions.forEach(function (raceName) {
        var option = document.createElement('option');
        option.text = raceName;
        option.value = raceName;
        ddRace.add(option);
    });

}
