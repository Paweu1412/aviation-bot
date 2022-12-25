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
        await client.editStatus('online', {name: 'discord.gg/JB2ubrPDzA'});

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

client.on('interactionCreate', async (interaction) => {
    try {
        if (!interaction) { return null; }
    
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
                .then(async airportData => {
                    await sendAirportInformation(interaction, weatherData, airportData);
                });
        }
    } catch (err) {
        console.error(err);
    }
});

async function sendAirportInformation(interaction, weatherData, airportData) {
    let interactionMemberUsername = interaction.member.user.username;
    let interactionMemberGuildName = interaction.member.guild.name;

    if (!airportData.name || !weatherData) {
        return interaction.createMessage({
            "embed": {
                "color": 16777215,
                "description": "Not in database"
            }
        });
    }

    const runwaysInfo = getRunwaysWeather(weatherData, airportData);
    if (!runwaysInfo) { return null; }

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
                "url": "https://media.discordapp.net/attachments/1045000837241524264/1045001174383857676/airport.png"
            },

            "description": "***Airport information***",
            "color": 16777215,

            "fields": [
                {
                    "name": "IATA code",
                    "value": airportData.iata_code ? airportData.iata_code : 'n/a',
                },
                {
                    
                    "name": "Elevation",
                    "value": airportData.elevation_ft ? `${airportData.elevation_ft}ft / ${Math.round(airportData.elevation_ft * 0.304)}m` : 'n/a',
                },
                {
                    "name": "Runways",
                    "value": airportData.runways ? ((airportData.runways).length * 2) : 'n/a',
                },
                {
                    "name": "Wikipedia",
                    "value": airportData.wikipedia_link ? airportData.wikipedia_link : 'n/a',
                },
            ]
        }
    };

    function getCloudsInformation() {
        if (!weatherData) { return null; }

        if (!weatherData.clouds) { return '' }

        let callbackInformation = '';

        for (let i = 0; i < weatherData.clouds.length; i++) {
            let returnString = '';

            if (weatherData.clouds[i]) {
                if (weatherData.clouds[i].code && weatherData.clouds[i].feet) {
                    returnString = `${weatherData.clouds[i].code} / ${weatherData.clouds[i].feet}ft`;
                }
    
                if (weatherData.clouds[i].code && (!weatherData.clouds[i].feet)) {
                    returnString = `${weatherData.clouds[i].code} / -`;
                }
    
                if ((!weatherData.clouds[i].code) && weatherData.clouds[i].feet) {
                    returnString = `- / ${weatherData.clouds[i].feet}`;
                }
            }

            callbackInformation += `${returnString}\n`
        }

        return callbackInformation !== '' ? callbackInformation : 'n/a';
    }

    const weatherEmbedTemplate = {
        "embed": {
            "description": "***Weather information***",
            "thumbnail": {
                "url": "https://media.discordapp.net/attachments/1045000837241524264/1045001175008821319/cloudy-day.png"
            },

            "color": 16777215,

            "fields": [
                {
                    "name": "RAW",
                    "value": weatherData.raw_text ? weatherData.raw_text : 'n/a',
                },
                {
                    "name": "Pressure",
                    "value": weatherData.barometer ? `${weatherData.barometer.hpa}hPa / ${weatherData.barometer.hg}hgIn` : 'n/a',
                    "inline": true,
                },
                {
                    "name": "Humidity",
                    "value": weatherData.humidity ? `${weatherData.humidity.percent}%` : 'n/a',
                    "inline": true,
                },
                {
                    "name": "Temperature",
                    "value": weatherData.temperature ? `${weatherData.temperature.celsius}°C` : 'n/a',
                    "inline": true
                },
                {
                    
                    "name": "Dew point",
                    "value": weatherData.dewpoint ? `${weatherData.dewpoint.celsius}°C` : 'n/a',
                    "inline": true,
                },
                {
                    "name": "Visibility",
                    "value": weatherData.visibility ? `${weatherData.visibility.meters} m` : 'n/a',
                    "inline": true
                },
                {
                    "name": "Wind",
                    "value": weatherData.wind ? `${weatherData.wind.degrees}° / ${weatherData.wind.speed_kts}kts` : 'n/a',
                    "inline": true
                },
                {
                    "name": "Wind chill",
                    "value": weatherData.windchill ? `${weatherData.windchill.celsius}°C` : 'n/a',
                    "inline": true

                },
                {
                    "name": "Flight category",
                    "value": weatherData.flight_category ? weatherData.flight_category : 'n/a',
                    "inline": true
                },
                {
                    "name": "Clouds",
                    "value": getCloudsInformation(),
                    "inline": true
                },
                {
                    "name": "Observed",
                    "value": weatherData.observed,
                    "inline": true
                },
            ]
        }
    };

    const runwaysEmbedTemplate = {
        "embed": {
            "description": "***Runways information***",
            "thumbnail": {
                "url": "https://media.discordapp.net/attachments/1045000837241524264/1045001174685843526/runway.png"
            },

            "color": 16777215,

            "fields": [],

            "footer": {
                "text": `🟩 means the runway is safe\n🟩 ⚠️ means the runway is relatively safe, to be assessed by yourself\n🟥 means the runway is unsafe\n\nGenerated at ${currentDate}`
            }
        }
    };

    for (const runway of airportData.runways) {
        function getRunwayAvailabilityStatus(runway) {
            if (runwaysInfo[runway].status === 'headwind') {
                return '🟩';
            }

            if (runwaysInfo[runway].status === 'crosswind') {
                if (runwaysInfo[runway].crosswind <= 10) {
                    return '🟩';
                }
                
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
            switch (runwaysInfo[runway].status) {
                case 'headwind':
                    return `${Math.round(runwaysInfo[runway].headtailwind)}kts`;

                case 'tailwind':
                    return `${Math.round(runwaysInfo[runway].headtailwind)}kts`;

                case 'crosswind':
                    return `${Math.round(runwaysInfo[runway].crosswind)}kts from the ${runwaysInfo[runway].crosswindSide}`
                
                default:
                    return null;
            }
        }

        runwaysEmbedTemplate.embed.fields.push(
        {
            "name": `RWY ${runway.le_ident} ${getRunwayAvailabilityStatus(runway.le_ident)}`,
            "value": `
                *Wind: ${runwaysInfo[runway.le_ident].status}, ${getRunwayWindInformation(runway.le_ident)}*

                Elevation: ${runway.le_elevation_ft ? `${runway.le_elevation_ft}ft / ${Math.round(runway.le_elevation_ft * 0.304)}m` : 'n/a'}
                ILS: ${runway.le_ils !== undefined ? `${runway.le_ils.freq} / ${runway.le_ils.course}°` : 'n/a'}
            `
        },
        {
            "name": `RWY ${runway.he_ident} ${getRunwayAvailabilityStatus(runway.he_ident)}`,
            "value": `
                *Wind: ${runwaysInfo[runway.he_ident].status}, ${getRunwayWindInformation(runway.he_ident)}*

                Elevation: ${runway.he_elevation_ft ? `${runway.he_elevation_ft}ft / ${Math.round(runway.he_elevation_ft * 0.304)}m` : 'n/a'}
                ILS: ${runway.he_ils !== undefined ? `${runway.he_ils.freq} / ${runway.he_ils.course}°` : 'n/a'}
            `
        })
    }

    await interaction.createMessage(informationEmbedTemplate);
    await client.createMessage(interaction.channel.id, weatherEmbedTemplate);
    await client.createMessage(interaction.channel.id, runwaysEmbedTemplate);

    await client.createMessage('1044041529557274744', `@everyone *${interactionMemberUsername}* z serwera *${interactionMemberGuildName}* właśnie wykonał polecenie /info!`);
    
    return;
}

client.on('messageCreate', async (message) => {
    if (!message.content.includes('number of servers bot')) { return; }
    if (message.channel.id != 1044041529557274744) { return; }

    let numberOfServers = await client.guilds.size;

    await client.createMessage('1044041529557274744', `Liczba serwerów: ${numberOfServers} [${100 - numberOfServers}]`);
});

client.on('guildCreate', async (guild) => {
    await client.createMessage('1044041529557274744', `Paffsowy bot właśnie dołączył na serwer ${guild.name} / ${guild.memberCount}`);
});

client.on('guildDelete', async (guild) => {
    await client.createMessage('1044041529557274744', `Paffsowy bot właśnie został usunięty z serwera ${guild.name} / ${guild.memberCount}`);
});

client.connect();