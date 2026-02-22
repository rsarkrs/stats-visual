(function (global) {
    var raceOptions = ['All', 'Night Elf', 'Orc', 'Human', 'Undead', 'Random'];
    var raceNameToId = {
        'Random': 0,
        'Human': 1,
        'Orc': 2,
        'Night Elf': 4,
        'Undead': 8
    };
    var raceIdToName = {
        0: 'Random',
        1: 'Human',
        2: 'Orc',
        4: 'Night Elf',
        8: 'Undead'
    };

    global.RACE_CONFIG = {
        raceOptions: raceOptions,
        raceNameToId: raceNameToId,
        raceIdToName: raceIdToName
    };
})(window);
