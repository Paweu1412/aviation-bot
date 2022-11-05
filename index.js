import { Client, Collection, Interaction } from 'eris';
import MessageEmbed from 'discord-eris-embeds';
import fetch from 'node-fetch-commonjs';
import textToImage from 'text-to-image';
import * as fs from 'fs';

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

function isEmpty(obj) {
    return Object.keys(obj).length === 0;
}

function sendAirportInformation(interaction, weatherData, airportData) {
    if (isEmpty(airportData) === true) { return; }
    if (isEmpty(weatherData) === true) { return; }

    const date = new Date();

    let day = date.getDay();
    let month = date.getMonth();
    let year = date.getFullYear();
    let hour = date.getHours();
    let minute = date.getMinutes();

    let currentDate = `${hour}:${minute} ${day}/${month}/${year}`;

    const informationEmbedTemplate = {
        "embed": {
            "title": airportData.name,
            "description": "***Informacje o lotnisku***",
            "color": 16777215,

            /*"thumbnail": {
                "url": 'http://localhost//icao_code.png',
            }, */

            "fields": [
                {
                    "name": "Kod IATA",
                    "value": airportData.iata_code
                },
                {
                    
                    "name": "Wysokość elewacji",
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
            "color": 16777215,

            /*"thumbnail": {
                "url": 'http://localhost//icao_code.png',
            }, */

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
            "color": 16777215,

            "fields": []

            /*"thumbnail": {
                "url": 'http://localhost//icao_code.png',
            }, */
        }
    };

    for (const runway of airportData.runways) {
        runwaysEmbedTemplate.embed.fields.push(
        {
            "name": `Pas ${runway.le_ident}`,
            "value": `
                Elewacja: ${runway.le_elevation_ft} 
                Heading: ${runway.le_heading_degT} 
                Przesunięcie progu: ${runway.le_displaced_threshold_ft !== '' ? `${runway.le_displaced_threshold_ft}ft / ${Math.round(runway.le_displaced_threshold_ft * 0.304)}m` : 'nd'}
            `
        },
        {
            "name": `Pas ${runway.he_ident}`,
            "value": `
                Elewacja: ${runway.he_elevation_ft} 
                Heading: ${runway.he_heading_degT} 
                Przesunięcie progu: ${runway.he_displaced_threshold_ft !== '' ? `${runway.he_displaced_threshold_ft}ft / ${Math.round(runway.he_displaced_threshold_ft * 0.304)}m` : 'nd'}
            `
        })
    }

    interaction.createMessage(informationEmbedTemplate);
    client.createMessage(interaction.channel.id, weatherEmbedTemplate);
    client.createMessage(interaction.channel.id, runwaysEmbedTemplate);

    return;
}

client.connect();