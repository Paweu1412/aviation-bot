import { Client } from 'eris';
import fetch from 'node-fetch-commonjs';

import * as dotenv from 'dotenv';
dotenv.config();

const client = new Client(process.env.DISCORD_BOT_TOKEN);

import { getActiveRunways } from './hooks/activeRunways.js';

const airportDbToken = process.env.AIRPORT_DB_TOKEN;
const checkWxApiToken = process.env.CHECK_WX_API_TOKEN;

client.on('ready', async () => {
    try {
        await client.createCommand({
            name: 'info',
            type: 1,
            description: 'Pobierz informacje pogodowe oraz sugerowany pas operacyjny o podanym ICAO',
            options: [{
                name: 'icao',
                type: 3,
                description: 'Kod ICAO lotniska (np. EPKK)',
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
                "description": "Podanego lotniska nie ma w bazie danych!"
            }
        });
    }

    const runwaysInfo = getActiveRunways(weatherData, airportData);
    if (!runwaysInfo) { return; }
    
    const date = new Date();

    let day = date.getDate();
    let month = date.getMonth()+1;
    let year = date.getFullYear();
    let hour = date.getHours();
    let minute = date.getMinutes();

    let currentDate = `${hour}:${minute} ${day}/${month}/${year}`;

    const informationEmbedTemplate = {
        "embed": {
            "title": airportData.name,
            "thumbnail": {
                "url": "https://media.discordapp.net/attachments/1038217845085061153/1038609766840287252/airport.png"
            },

            "description": "***Informacje o lotnisku***",
            "color": 16777215,

            "fields": [
                {
                    "name": "Kod IATA",
                    "value": airportData.iata_code
                },
                {
                    
                    "name": "Elewacja",
                    "value": `${airportData.elevation_ft}ft / ${Math.round(airportData.elevation_ft * 0.304)}m`
                },


                {
                    "name": "Ilość pasów",
                    "value": (airportData.runways).length * 2
                },

                {
                    "name": "Wikipedia",
                    "value": airportData.wikipedia_link
                },
            ]
        }
    };

    const weatherEmbedTemplate = {
        "embed": {
            "description": "***Informacje o pogodzie***",
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
                    "name": "Ciśnienie",
                    "value": `${weatherData.barometer.hpa}hPa`,
                    "inline": true,
                },
                {
                    "name": "Wilgotność powietrza",
                    "value": `${weatherData.humidity.percent}%`,
                    "inline": true,
                },
                {
                    "name": "Temperatura powietrza",
                    "value": `${weatherData.temperature.celsius}°C`,
                    "inline": true
                },
                {
                    
                    "name": "Punkt rosy",
                    "value": `${weatherData.dewpoint.celsius}°C`,
                    "inline": true,
                },
                {
                    "name": "Widoczność",
                    "value": `${weatherData.visibility.meters} m`,
                    "inline": true
                },
                {
                    "name": "Wiatr",
                    "value": `${weatherData.wind.degrees}° / ${weatherData.wind.speed_kts}kts`,
                    "inline": true

                }
            ]
        }
    };

    const runwaysEmbedTemplate = {
        "embed": {
            "description": "***Informacje o pasach***",
            "thumbnail": {
                "url": "https://media.discordapp.net/attachments/1038217845085061153/1038609953612644402/runway.png"
            },

            "color": 16777215,

            "fields": [],

            "footer": {
                "text": `Wygenerowano ${currentDate}`
            }
        }
    };

    for (const runway of airportData.runways) {
        runwaysEmbedTemplate.embed.fields.push(
        {
            "name": `Pas ${runway.le_ident} ${runwaysInfo[runway.le_ident].status === 'headwind' ? '🟩' : (runwaysInfo[runway.le_ident].status === 'crosswind' ? '🟩 ⚠️' : '🟥')}`,
            "value": `
                *Wiatr: ${runwaysInfo[runway.le_ident].status}, ${runwaysInfo[runway.le_ident].status === ('headwind' || 'tailwind') ? runwaysInfo[runway.le_ident].headtailwind : runwaysInfo[runway.le_ident].crosswind}kts ${runwaysInfo[runway.le_ident].status === 'crosswind' ? `ze strony ${runwaysInfo[runway.le_ident].crosswindSide === 'right' ? 'prawej' : 'lewej'}` : ''}*\n
                Elewacja: ${runway.le_elevation_ft}ft / ${Math.round(runway.le_elevation_ft * 0.304)}m
                Heading: ${runway.le_heading_degT}°
                Przesunięcie progu: ${runway.le_displaced_threshold_ft !== '' ? `${runway.le_displaced_threshold_ft}ft / ${Math.round(runway.le_displaced_threshold_ft * 0.304)}m` : 'brak'}
                ILS: ${runway.le_ils !== undefined ? `${runway.le_ils.freq} / ${runway.le_ils.course}°` : `brak`}
            `
        },
        {
            "name": `Pas ${runway.he_ident} ${runwaysInfo[runway.he_ident].status === 'headwind' ? '🟩' : (runwaysInfo[runway.he_ident].status === 'crosswind' ? '🟩 ⚠️' : '🟥')}`,
            "value": `
                *Wiatr: ${runwaysInfo[runway.he_ident].status}, ${runwaysInfo[runway.he_ident].status === ('headwind' || 'tailwind') ? runwaysInfo[runway.he_ident].headtailwind : runwaysInfo[runway.he_ident].crosswind}kts ${runwaysInfo[runway.he_ident].status === 'crosswind' ? `ze strony ${runwaysInfo[runway.he_ident].crosswindSide === 'right' ? 'prawej' : 'lewej'}` : ''}*\n
                Elewacja: ${runway.he_elevation_ft}ft / ${Math.round(runway.he_elevation_ft * 0.304)}m
                Heading: ${runway.he_heading_degT}°
                Przesunięcie progu: ${runway.he_displaced_threshold_ft !== '' ? `${runway.he_displaced_threshold_ft}ft / ${Math.round(runway.he_displaced_threshold_ft * 0.304)}m` : 'brak'}
                ILS: ${runway.he_ils !== undefined ? `${runway.he_ils.freq} / ${runway.he_ils.course}°` : `brak`}
            `
        })
    }

    interaction.createMessage(informationEmbedTemplate);
    client.createMessage(interaction.channel.id, weatherEmbedTemplate);
    client.createMessage(interaction.channel.id, runwaysEmbedTemplate);

    return;
}

client.connect();