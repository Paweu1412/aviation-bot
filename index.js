import { Client, Collection, Interaction } from 'eris';
import MessageEmbed from 'discord-eris-embeds';
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
                console.log(getActiveRunways(weatherData, airportData));
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

    /* const data = {
        "embed": {
            "title": "Aktualne informacje pogodowe",
            "description": airportData.name,
            "color": 16777215,

            "footer": {
                "text": `Wygenerowano ${currentDate}`
            },

            "image": {
            "url": "https://cdn.discordapp.com/embed/avatars/0.png"
            },
            "author": {
            "name": "author name",
            "url": "https://discordapp.com",
            "icon_url": "https://cdn.discordapp.com/embed/avatars/0.png"
            },
            "fields": [
            {
                "name": "🤔",
                "value": "some of these properties have certain limits..."
            },
            {
                "name": "😱",
                "value": "try exceeding some of them!"
            },
            {
                "name": "🙄",
                "value": "an informative error should show up, and this view will remain as-is until all issues are fixed"
            },
            {
                "name": "<:thonkang:219069250692841473>",
                "value": "these last two",
                "inline": true
            },
            {
                "name": "<:thonkang:219069250692841473>",
                "value": "are inline fields",
                "inline": true
            }]
        }
    };*/

    return interaction.createMessage(data);
}

client.connect();