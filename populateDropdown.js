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

    // Populate player names from local cache file.
    fetch('./playerNames.json')
        .then(function (response) {
            if (!response.ok) {
                throw new Error('Failed to fetch playerNames.json');
            }
            return response.json();
        })
        .then(function (payload) {
            var names = Array.isArray(payload) ? payload : payload.battleTags;
            if (!Array.isArray(names)) {
                throw new Error('Invalid player names payload');
            }

            var fragment = document.createDocumentFragment();
            names.forEach(function (name) {
                if (!name) {
                    return;
                }

                var option = document.createElement('option');
                option.value = name;
                fragment.appendChild(option);
            });
            nameSuggestions.appendChild(fragment);
        })
        .catch(function (error) {
            console.error('Error fetching names:', error);
        });

    fetch('https://website-backend.w3champions.com/api/ladder/seasons')
        .then(function (response) {
            if (!response.ok) {
                throw new Error('Failed to fetch seasons');
            }
            return response.json();
        })
        .then(function (seasons) {
            var seasonIds = seasons
                .map(function (season) { return parseInt(season.id, 10); })
                .filter(function (seasonId) { return Number.isFinite(seasonId) && seasonId > 0; })
                .sort(function (a, b) { return a - b; });

            var allOption = document.createElement('option');
            allOption.text = 'All';
            allOption.value = 'All';
            ddSeasons.add(allOption);

            seasonIds.forEach(function (seasonId) {
                var option = document.createElement('option');
                option.text = seasonId.toString();
                option.value = seasonId.toString();
                ddSeasons.add(option);
            });
        })
        .catch(function (error) {
            console.error('Error fetching seasons:', error);
        });

    raceOptions.forEach(function (raceName) {
        var option = document.createElement('option');
        option.text = raceName;
        option.value = raceName;
        ddRace.add(option);
    });
}
