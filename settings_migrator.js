"use strict"

const DefaultSettings = {
    "enabled": true,
    "auto": false,
	"interval": 100,
	"throttleMax": 800,
	"scanInterval": 400,
    "radius": 250,
    "blacklist": [98260, 98513, 98590]
}

module.exports = function MigrateSettings(from_ver, to_ver, settings) {
    if (from_ver === undefined) {
        // Migrate legacy config file
        return DefaultSettings;
    } else if (from_ver === null) {
        // No config file exists, use default settings
        return DefaultSettings;
    } else {
        if(from + 1 < to) {
            settings = MigrateSettings(from_ver, from_ver + 1, settings);
            return MigrateSettings(from_ver + 1, to_ver, settings);
        }

        switch (to) {
            default:
                settings = Object.assign(DefaultSettings, settings);
                break;
        }

        return settings;
    }
}
