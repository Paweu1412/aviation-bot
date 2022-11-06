import { Client } from 'eris';
import fetch from 'node-fetch-commonjs';

import * as dotenv from 'dotenv';
dotenv.config();

const client = new Client(process.env.DISCORD_BOT_TOKEN);

import { getRunwaysWeather } from './hooks/activeRunways.js';

const airportDbToken = process.env.AIRPORT_DB_TOKEN;
const checkWxApiToken = process.env.CHECK_WX_API_TOKEN;

client.on('ready', async () => {
    try {
        await client.createCommand({
            name: 'info',
            type: 1,
            description: 'Check airport information',
            options: [{
                name: 'icao',
                type: 3,
                description: 'Airport ICAO code (e.g. EPKK)',
                required: true
            }]
        });

        console.log('Bot is ready!');
    } catch (err) {
        console.error(err);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction) { return; }
    
    if (interaction.data.name === 'info') {
        const icaoCode = interaction.data.options[0].value.toUpperCase();
        let weatherData;
        
        await fetch(`https://api.checkwx.com/metar/${icaoCode}/decoded?x-api-key=${checkWxApiToken}`)
            .then(res => res.json())
            .then(res => {
                weatherData = res.data[0];
            });

        await fetch(`https://airportdb.io/api/v1/airport/${icaoCode}?apiToken=${airportDbToken}`)
            .then(res => res.json())
            .then(airportData => {
                sendAirportInformation(interaction, weatherData, airportData);
            });
    }
});

function sendAirportInformation(interaction, weatherData, airportData) {
    if (!airportData.name || !weatherData) {
        return interaction.createMessage({
            "embed": {
                "color": 16777215,
                "description": "Not in database"
            }
        });
    }

    const runwaysInfo = getRunwaysWeather(weatherData, airportData);
    if (!runwaysInfo) { return; }

    const date = new Date();

    let day = date.getDate();
    let month = date.getMonth()+1;
    let year = date.getFullYear();
    let hour = date.getHours();
    let minute = date.getMinutes();

    let currentDate = `${hour}:${minute} ${day}/${month}/${year}`;

    console.log(weatherData.clouds);

    const informationEmbedTemplate = {
        "embed": {
            "title": airportData.name,
            "thumbnail": {
                "url": "https://media.discordapp.net/attachments/1038217845085061153/1038609766840287252/airport.png"
            },

            "description": "***Information about airport***",
            "color": 16777215,

            "fields": [
                {
                    "name": "IATA code",
                    "value": airportData.iata_code
                },
                {
                    
                    "name": "Elevation",
                    "value": `${airportData.elevation_ft}ft / ${Math.round(airportData.elevation_ft * 0.304)}m`
                },


                {
                    "name": "Runways",
                    "value": (airportData.runways).length * 2
                },

                {
                    "name": "Wikipedia",
                    "value": airportData.wikipedia_link
                },
            ]
        }
    };

    function pushAirportCloudsInformation(weather) {
        
    }

    const weatherEmbedTemplate = {
        "embed": {
            "description": "***Information about weather***",
            "thumbnail": {
                "url": "https://media.discordapp.net/attachments/1038217845085061153/1038609859450503198/cloudy-day.png"
            },

            "color": 16777215,

            "fields": [
                {
                    "name": "RAW",
                    "value": weatherData.raw_text,
                },
                {
                    "name": "Pressure",
                    "value": `${weatherData.barometer.hpa}hPa / ${weatherData.barometer.hg}hgIn`,
                    "inline": true,
                },
                {
                    "name": "Humidity",
                    "value": `${weatherData.humidity.percent}%`,
                    "inline": true,
                },
                {
                    "name": "Temperature",
                    "value": `${weatherData.temperature.celsius}°C`,
                    "inline": true
                },
                {
                    
                    "name": "Dew point",
                    "value": `${weatherData.dewpoint.celsius}°C`,
                    "inline": true,
                },
                {
                    "name": "Visibility",
                    "value": `${weatherData.visibility.meters} m`,
                    "inline": true
                },
                {
                    "name": "Wind",
                    "value": `${weatherData.wind.degrees}° / ${weatherData.wind.speed_kts}kts`,
                    "inline": true
                },
                {
                    "name": "Wind chill",
                    "value": `${weatherData.windchill.celsius}°C`,
                    "inline": true

                },
                {
                    "name": "Clouds",
                    "value": `${getAirportClouds(weatherData.clouds)}`
                },
                {
                    "name": "Flight category",
                    "value": weatherData.flight_category,
                    "inline": true
                },
            ]
        }
    };

    const runwaysEmbedTemplate = {
        "embed": {
            "description": "***Information about runways***",
            "thumbnail": {
                "url": "https://media.discordapp.net/attachments/1038217845085061153/1038609953612644402/runway.png"
            },

            "color": 16777215,

            "fields": [],

            "footer": {
                "text": `Generated at ${currentDate}`
            }
        }
    };

    for (const runway of airportData.runways) {
        function getRunwayAvailabilityStatus(runway) {
            if (runwaysInfo[runway].status === 'headwind') {
                return '🟩';
            }

            if (runwaysInfo[runway].status === 'crosswind') {
                return '🟩 ⚠️';
            }

            if (runwaysInfo[runway].status === 'tailwind') {
                if (runwaysInfo[runway].headtailwind <= 5) {
                    return '🟩 ⚠️';
                }

                return '🟥';
            }

            return null;
        }

        function getRunwayWindInformation(runway) {
            if (runwaysInfo[runway].status === 'headwind' || 'tailwind') {
                return `${Math.round(runwaysInfo[runway].headtailwind)}kts`;
            }

            if (runwaysInfo[runway].status === 'crosswind') {
                return `${Math.round(runwaysInfo[runway].crosswind)}kts from the ${runwaysInfo[runway].crosswindSide}`
            }

            return null;
        }

        runwaysEmbedTemplate.embed.fields.push(
        {
            "name": `RWY ${runway.le_ident} ${getRunwayAvailabilityStatus(runway.le_ident)}`,
            "value": `
                *Wind: ${runwaysInfo[runway.le_ident].status}, ${getRunwayWindInformation(runway.le_ident)}*

                Elevation: ${runway.le_elevation_ft}ft / ${Math.round(runway.le_elevation_ft * 0.304)}m
                ILS: ${runway.le_ils !== undefined ? `${runway.le_ils.freq} / ${runway.le_ils.course}°` : `n/a`}
            `
        },
        {
            "name": `RWY ${runway.he_ident} ${getRunwayAvailabilityStatus(runway.he_ident)}`,
            "value": `
                *Wind: ${runwaysInfo[runway.he_ident].status}, ${getRunwayWindInformation(runway.he_ident)}*

                Elevation: ${runway.he_elevation_ft}ft / ${Math.round(runway.he_elevation_ft * 0.304)}m
                ILS: ${runway.he_ils !== undefined ? `${runway.he_ils.freq} / ${runway.he_ils.course}°` : `n/a`}
            `
        })
    }

    interaction.createMessage(informationEmbedTemplate);
    client.createMessage(interaction.channel.id, weatherEmbedTemplate);
    client.createMessage(interaction.channel.id, runwaysEmbedTemplate);

    return;
}

client.connect();